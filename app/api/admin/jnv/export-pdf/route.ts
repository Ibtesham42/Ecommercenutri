import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { renderJnvContentPdfBuffer } from "@/lib/pdf/jnv-content-pdf";

// react-pdf needs the Node runtime; the PDF is generated per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  meta: z.string().trim().max(200),
  // The teacher may have edited the generated text before exporting — the
  // export renders exactly what's on screen, never re-generates.
  body: z.string().trim().min(1).max(20000),
});

export async function POST(req: Request) {
  try {
    await requirePermission("jnv");
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(parsed.error.issues[0]?.message ?? "Invalid request.", { status: 400 });
  }

  const pdf = await renderJnvContentPdfBuffer(parsed.data);
  const safeName = parsed.data.title.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 80) || "document";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
