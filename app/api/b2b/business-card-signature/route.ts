import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { cloudinaryEnabled, signUpload, safeFolder } from "@/lib/cloudinary";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ALLOWED_FORMATS = "jpg,jpeg,png,pdf";

async function clientId(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "anon";
}

/**
 * Signature for the optional B2B visiting/business-card upload. The B2B form
 * has no login, so this is IP rate-limited, and `allowed_formats` is signed
 * into the request so Cloudinary itself rejects anything outside JPG/PNG/PDF
 * before accepting any bytes (invariant #5 — direct browser→Cloudinary upload).
 */
export async function POST() {
  const rl = await checkRateLimit(limiters.b2bUpload, `b2b-card:${await clientId()}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a moment and try again." },
      { status: 429 },
    );
  }
  if (!cloudinaryEnabled) {
    return NextResponse.json({ error: "File uploads aren't available right now." }, { status: 400 });
  }
  const signed = signUpload(safeFolder("b2b-cards"), { allowed_formats: ALLOWED_FORMATS });
  if (!signed) {
    return NextResponse.json({ error: "Could not sign the upload." }, { status: 500 });
  }
  return NextResponse.json(signed);
}
