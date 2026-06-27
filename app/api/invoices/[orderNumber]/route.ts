import { prisma } from "@/lib/prisma";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { getInvoiceData } from "@/lib/invoices";
import { renderInvoiceBuffer } from "@/lib/pdf/invoice-pdf";

// react-pdf needs the Node runtime; the PDF is generated per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, userId: true },
  });
  if (!order) return new Response("Not found", { status: 404 });

  // Owner, or an admin with the orders permission.
  if (order.userId !== user.id) {
    try {
      await requirePermission("orders");
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const data = await getInvoiceData(order.id);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await renderInvoiceBuffer(data);
  const download = new URL(req.url).searchParams.get("download") === "1";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${data.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
