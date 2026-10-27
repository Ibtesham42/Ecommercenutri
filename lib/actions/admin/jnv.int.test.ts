import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * JNV resource save against a real local Postgres: a normal save writes the
 * expected row, and a READ-ONLY database (the state production was in during
 * the 2026-10 Neon freeze) comes back as `{ ok: false }` with a clear message
 * instead of throwing. Read-only is set per SESSION on a single pooled
 * connection — the test database's own settings are never changed.
 */

// One connection, so the session-level SET below applies to every query.
process.env.DATABASE_URL = process.env.DATABASE_URL!.replace(/connection_limit=\d+/, "connection_limit=1");
if (!/connection_limit=1\b/.test(process.env.DATABASE_URL)) {
  process.env.DATABASE_URL += (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=1";
}

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: () => unknown) => fn }));
const requirePermission = vi.fn();
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("@/lib/cloudinary", () => ({
  isTrustedCloudinaryUrl: (url: string) => url.startsWith("https://res.cloudinary.com/test-cloud/"),
  destroyAssetByUrl: vi.fn(),
}));

const ctx = hasLocalDb
  ? {
      prisma: (await import("@/lib/prisma")).prisma,
      actions: await import("@/lib/actions/admin/jnv"),
    }
  : null;

describe.skipIf(!ctx)("JNV resource save (integration)", () => {
  if (!ctx) return;
  const { prisma } = ctx;
  const { createJnvResource, updateJnvResource } = ctx.actions;
  const ids = { folder: "", admin: "" };
  const fileUrl = "https://res.cloudinary.com/test-cloud/image/upload/v1/nutriyet/jnv/class-6/jnv-int-dummy.pdf";

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: "admin@jnv-int.test" } });
    await prisma.jnvFolder.deleteMany({ where: { name: "jnv-int-test-folder" } });
    const admin = await prisma.user.create({ data: { email: "admin@jnv-int.test", role: "SUPER_ADMIN" } });
    const folder = await prisma.jnvFolder.create({ data: { classLevel: 6, name: "jnv-int-test-folder" } });
    Object.assign(ids, { admin: admin.id, folder: folder.id });
    requirePermission.mockResolvedValue({ id: admin.id });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe("SET default_transaction_read_only = off");
    await prisma.jnvFolder.deleteMany({ where: { name: "jnv-int-test-folder" } }); // cascades its resources
    await prisma.user.deleteMany({ where: { email: "admin@jnv-int.test" } });
    await prisma.$disconnect();
  });

  const input = () => ({
    folderId: ids.folder,
    classLevel: 6,
    title: "Dummy worksheet",
    fileUrl,
    fileKind: "PDF",
    mimeType: "application/pdf",
    fileSize: 2048,
  });

  it("saves a resource row with the uploaded file's metadata", async () => {
    const res = await createJnvResource(input());
    expect(res.ok).toBe(true);
    const row = await prisma.jnvResource.findUniqueOrThrow({ where: { id: (res as { data: { id: string } }).data.id } });
    expect(row).toMatchObject({
      folderId: ids.folder,
      classLevel: 6,
      title: "Dummy worksheet",
      fileUrl,
      fileKind: "PDF",
      mimeType: "application/pdf",
      fileSize: 2048,
      uploadedById: ids.admin,
    });
  });

  it("returns a read-only error (not a throw) when the database refuses writes", async () => {
    const existing = await prisma.jnvResource.findFirstOrThrow({ where: { folderId: ids.folder } });
    const before = await prisma.jnvResource.count({ where: { folderId: ids.folder } });

    await prisma.$executeRawUnsafe("SET default_transaction_read_only = on");
    try {
      const created = await createJnvResource({ ...input(), title: "Should not save" });
      expect(created).toEqual({ ok: false, error: expect.stringMatching(/read-only maintenance/) });

      const updated = await updateJnvResource({ id: existing.id, title: "Should not rename" });
      expect(updated).toEqual({ ok: false, error: expect.stringMatching(/read-only maintenance/) });
    } finally {
      await prisma.$executeRawUnsafe("SET default_transaction_read_only = off");
    }

    expect(await prisma.jnvResource.count({ where: { folderId: ids.folder } })).toBe(before);
    expect((await prisma.jnvResource.findUniqueOrThrow({ where: { id: existing.id } })).title).toBe("Dummy worksheet");
  });
});
