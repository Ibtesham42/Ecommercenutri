import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: a DB failure while saving a JNV resource (e.g. the database
 * frozen read-only during a migration) used to THROW out of the server action,
 * leaving the admin dialog's Save spinner running forever with no message.
 * The actions must now return `{ ok: false, error }`. Prisma is mocked — no DB.
 */

const prismaMock = {
  jnvFolder: { findUnique: vi.fn() },
  jnvResource: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requirePermission: vi.fn(async () => ({ id: "admin_1" })) }));
vi.mock("@/lib/redis", () => ({ cacheDel: vi.fn() }));
vi.mock("@/lib/queries/jnv", () => ({ invalidateJnvFolder: vi.fn(), invalidateJnvResource: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({
  isTrustedCloudinaryUrl: (url: string) => url.startsWith("https://res.cloudinary.com/"),
  destroyAssetByUrl: vi.fn(),
}));

const { createJnvResource, updateJnvResource } = await import("@/lib/actions/admin/jnv");

const READ_ONLY = new Error(
  'Error occurred during query execution: ConnectorError(... PostgresError { code: "25006", message: "cannot execute INSERT in a read-only transaction" ...',
);

const createInput = {
  folderId: "folder_1",
  classLevel: 6,
  title: "Dummy worksheet",
  fileUrl: "https://res.cloudinary.com/test-cloud/image/upload/v1/nutriyet/jnv/class-6/dummy.pdf",
  fileKind: "PDF",
  mimeType: "application/pdf",
  fileSize: 1024,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  prismaMock.jnvFolder.findUnique.mockResolvedValue({ classLevel: 6 });
  prismaMock.jnvResource.findUnique.mockResolvedValue({ folderId: "folder_1", classLevel: 6 });
});

describe("createJnvResource", () => {
  it("returns a read-only message instead of throwing when the insert fails", async () => {
    prismaMock.jnvResource.create.mockRejectedValue(READ_ONLY);
    const res = await createJnvResource(createInput);
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/read-only maintenance/) });
  });

  it("returns a generic message when the folder lookup itself fails", async () => {
    prismaMock.jnvFolder.findUnique.mockRejectedValue(new Error("boom"));
    expect(await createJnvResource(createInput)).toEqual({
      ok: false,
      error: "Couldn't save the resource. Please try again.",
    });
  });

  it("still saves normally and records the row's class from its folder", async () => {
    prismaMock.jnvResource.create.mockResolvedValue({ id: "res_1", classLevel: 6 });
    expect(await createJnvResource(createInput)).toEqual({ ok: true, data: { id: "res_1" } });
    expect(prismaMock.jnvResource.create.mock.calls[0][0].data).toMatchObject({
      folderId: "folder_1",
      classLevel: 6,
      fileKind: "PDF",
      fileSize: 1024,
      uploadedById: "admin_1",
    });
  });
});

describe("updateJnvResource", () => {
  it("returns an error instead of throwing when the update fails", async () => {
    prismaMock.jnvResource.update.mockRejectedValue(READ_ONLY);
    const res = await updateJnvResource({ id: "res_1", title: "Renamed" });
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/read-only maintenance/) });
  });

  it("still reports a missing resource", async () => {
    prismaMock.jnvResource.findUnique.mockResolvedValue(null);
    expect(await updateJnvResource({ id: "nope", title: "x" })).toEqual({ ok: false, error: "Resource not found." });
  });
});
