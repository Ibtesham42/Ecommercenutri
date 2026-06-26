import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { uploadImage, cloudinaryEnabled } from "@/lib/cloudinary";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Keep folders to a safe, predictable set under the nutriyet namespace. */
function safeFolder(folder?: string | null): string {
  const cleaned = (folder ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, "")
    .replace(/^\/+|\/+$/g, "");
  return cleaned ? `nutriyet/${cleaned}` : "nutriyet";
}

/**
 * Admin image upload via multipart FormData. Using a Route Handler (instead of a
 * Server Action that takes a base64 string) avoids the action argument-encoding
 * limits — large image strings otherwise trigger "Maximum array nesting
 * exceeded" / body-size errors. The file is streamed, buffered, and handed to
 * Cloudinary as a data URI.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  if (!cloudinaryEnabled) {
    return NextResponse.json(
      { error: "Cloudinary isn't configured — paste an image URL instead." },
      { status: 400 },
    );
  }

  let file: File | null = null;
  let folder: string | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
    const fld = form.get("folder");
    folder = typeof fld === "string" ? fld : null;
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 10 MB)." }, { status: 413 });
  }
  // Allowlist image/video types only (defense-in-depth; admins upload media).
  if (!/^(image|video)\//.test(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
    const url = await uploadImage(dataUri, safeFolder(folder));
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[admin/upload] failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
