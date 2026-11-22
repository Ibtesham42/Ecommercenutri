import { NextResponse } from "next/server";
import { auth, getAdminUser } from "@/lib/auth";
import { cloudinaryEnabled, safeFolder, signUpload } from "@/lib/cloudinary";
import { allowedFormatsFor, isMediaKind } from "@/lib/upload-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns a short-lived signature so the browser uploads a file DIRECTLY to
 * Cloudinary (bypassing this serverless function — Vercel's ~4.5 MB body cap).
 *
 * Security: the admin is re-checked against the database (a deactivated admin
 * or a stale JWT can't keep uploading). The signature pins the
 * server-sanitized folder and, for media kinds, `allowed_formats` — Cloudinary
 * inspects the actual bytes and refuses anything else, so a tampered client
 * can't upload other file types. Per-file size is capped by the Cloudinary
 * plan server-side (10 MB image / 100 MB video). `kind: "file"` (JNV teaching
 * documents: PDF/Office/zip) is limited to admins with the `jnv` permission.
 */
export async function POST(request: Request) {
  const admin = await getAdminUser().catch(() => null);
  if (!admin) {
    const session = await auth().catch(() => null);
    return session?.user
      ? NextResponse.json({ error: "You don't have permission to upload media." }, { status: 403 })
      : NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  if (!cloudinaryEnabled) {
    return NextResponse.json(
      { error: "Uploads aren't configured (Cloudinary keys missing) — paste a URL instead." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { folder?: unknown; kind?: unknown };
  const folder = safeFolder(typeof body.folder === "string" ? body.folder : null);

  if (body.kind === "file") {
    if (admin.role !== "SUPER_ADMIN" && !admin.permissions.includes("jnv")) {
      return NextResponse.json({ error: "You don't have permission to upload files here." }, { status: 403 });
    }
    const signed = signUpload(folder);
    return signed
      ? NextResponse.json(signed)
      : NextResponse.json({ error: "Could not sign the upload." }, { status: 500 });
  }

  const kind = isMediaKind(body.kind) ? body.kind : "media";
  const signed = signUpload(folder, { allowed_formats: allowedFormatsFor(kind) });
  if (!signed) {
    return NextResponse.json({ error: "Could not sign the upload." }, { status: 500 });
  }
  return NextResponse.json(signed);
}
