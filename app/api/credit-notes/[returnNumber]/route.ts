import { prisma } from "@/lib/prisma";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { getCreditNoteData } from "@/lib/credit-notes";
import { renderCreditNoteBuffer } from "@/lib/pdf/credit-note-pdf";

// react-pdf needs the Node runtime; the PDF is generated per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ returnNumber: string }> },
) {
  const { returnNumber } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ret = await prisma.returnRequest.findUnique({
    where: { returnNumber },
    select: { id: true, userId: true, creditNote: { select: { id: true } } },
  });
  if (!ret) return new Response("Not found", { status: 404 });
  if (!ret.creditNote) return new Response("No credit note yet", { status: 404 });

  // Owner, or an admin with the returns permission.
  if (ret.userId !== user.id) {
    try {
      await requirePermission("returns");
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const data = await getCreditNoteData(ret.id);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await renderCreditNoteBuffer(data);
  const download = new URL(req.url).searchParams.get("download") === "1";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${data.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
