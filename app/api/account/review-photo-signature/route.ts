import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cloudinaryEnabled, signUpload, safeFolder } from "@/lib/cloudinary";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Signature for review photos: the browser uploads DIRECTLY to Cloudinary
 * (never through serverless — invariant #5). User-scoped sibling of the
 * account avatar-signature route, locked to the reviews folder.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const rl = await checkRateLimit(limiters.reviewUpload, user.id);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many uploads — please wait a moment and try again." }, { status: 429 });
  }
  if (!cloudinaryEnabled) {
    return NextResponse.json({ error: "Photo uploads aren't available right now." }, { status: 400 });
  }
  const signed = signUpload(safeFolder("reviews"));
  if (!signed) {
    return NextResponse.json({ error: "Could not sign the upload." }, { status: 500 });
  }
  return NextResponse.json(signed);
}
