import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { cloudinaryEnabled, safeFolder, signUpload } from "@/lib/cloudinary";

export const runtime = "nodejs";

/**
 * Returns a short-lived signature so the browser can upload a file DIRECTLY to
 * Cloudinary (bypassing this serverless function). Used for large media — videos
 * in particular — which would otherwise exceed Vercel's ~4.5 MB request-body
 * limit if streamed through the app. Admin-only; the signature covers just the
 * server-sanitized folder + timestamp.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  if (!cloudinaryEnabled) {
    return NextResponse.json(
      { error: "Cloudinary isn't configured — paste a URL instead." },
      { status: 400 },
    );
  }

  let folder: string | null = null;
  try {
    const body = (await request.json().catch(() => ({}))) as { folder?: unknown };
    folder = typeof body.folder === "string" ? body.folder : null;
  } catch {
    /* fall back to the default namespace */
  }

  const signed = signUpload(safeFolder(folder));
  if (!signed) {
    return NextResponse.json({ error: "Could not sign the upload." }, { status: 500 });
  }
  return NextResponse.json(signed);
}
