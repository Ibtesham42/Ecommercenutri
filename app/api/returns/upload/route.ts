import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadImage, cloudinaryEnabled } from "@/lib/cloudinary";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — allows short video proof

/**
 * Customer-facing proof upload for a return request (images + short video). Any
 * signed-in user may upload; files go to the `nutriyet/returns` Cloudinary folder.
 * Keyless fallback: returns 400 so the UI offers a URL-paste field instead.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  if (!cloudinaryEnabled) {
    return NextResponse.json(
      { error: "Uploads aren't configured — paste an image/video URL instead." },
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
  if (!/^(image|video)\//.test(file.type)) {
    return NextResponse.json({ error: "Only images or videos are allowed." }, { status: 415 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;
    const url = await uploadImage(dataUri, "nutriyet/returns");
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[returns/upload] failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
