import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, requirePermission } from "@/lib/auth";
import { cloudinaryEnabled } from "@/lib/cloudinary";
import { signMarketingUpload } from "@/lib/affiliate/marketing-upload";
import { checkMarketingFile } from "@/lib/affiliate/marketing-upload-rules";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(100),
  size: z.number().int().nonnegative(),
});

/**
 * Marketing-kit upload, step 1: returns a short-lived signature so the browser
 * uploads the file DIRECTLY to Cloudinary. File bytes never pass through this
 * function (Vercel's ~4.5 MB body cap would break videos/PDFs). Takes only the
 * file's name/type/size for a pre-flight check; the signature itself restricts
 * folder + formats, and `verifyMarketingUpload` re-checks the stored file.
 */
export async function POST(request: Request) {
  try {
    await requirePermission("affiliates");
  } catch {
    const session = await auth().catch(() => null);
    return session?.user
      ? NextResponse.json({ error: "You don't have permission to upload marketing files." }, { status: 403 })
      : NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }
  if (!cloudinaryEnabled) {
    return NextResponse.json(
      { error: "Cloudinary isn't configured — paste a file URL instead." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Could not read the file details." }, { status: 400 });
  const problem = checkMarketingFile(parsed.data);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const signed = signMarketingUpload();
  if (!signed) return NextResponse.json({ error: "Could not sign the upload." }, { status: 500 });
  return NextResponse.json(signed);
}
