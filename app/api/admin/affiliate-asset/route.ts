import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { uploadImage, cloudinaryEnabled } from "@/lib/cloudinary";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

/** Marketing-kit asset upload (images, video, PDF) → Cloudinary. */
export async function POST(request: Request) {
  try {
    await requirePermission("affiliates");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (!cloudinaryEnabled) {
    return NextResponse.json(
      { error: "Cloudinary isn't configured — paste a file URL instead." },
      { status: 400 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 25 MB)." }, { status: 413 });
  }
  if (!/^(image|video)\/|^application\/pdf/.test(file.type)) {
    return NextResponse.json({ error: "Use an image, video or PDF." }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;
    const url = await uploadImage(dataUri, "nutriyet/marketing");
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[affiliate-asset] upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
