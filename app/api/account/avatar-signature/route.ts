import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cloudinaryEnabled, signUpload, safeFolder } from "@/lib/cloudinary";

export const runtime = "nodejs";

/**
 * Signature for the account avatar: the browser uploads DIRECTLY to Cloudinary
 * (never through serverless — invariant #5). User-scoped sibling of the
 * admin upload-signature route, locked to the avatars folder.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!cloudinaryEnabled) {
    return NextResponse.json({ error: "Photo uploads aren't available right now." }, { status: 400 });
  }
  const signed = signUpload(safeFolder("avatars"));
  if (!signed) {
    return NextResponse.json({ error: "Could not sign the upload." }, { status: 500 });
  }
  return NextResponse.json(signed);
}
