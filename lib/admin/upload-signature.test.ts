import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/admin/upload-signature: fresh-DB admin check, 401 vs 403, and the
 * signature pins `allowed_formats` per kind so Cloudinary rejects other types.
 */

const signUpload = vi.fn((folder: string, extra?: Record<string, string>) => ({
  cloudName: "demo",
  apiKey: "key",
  timestamp: 1,
  signature: "sig",
  folder,
  ...extra,
}));
vi.mock("@/lib/cloudinary", () => ({
  cloudinaryEnabled: true,
  signUpload,
  // Same logic as the real lib/cloudinary.ts#safeFolder.
  safeFolder: (f?: string | null) => {
    const c = (f ?? "").toLowerCase().replace(/[^a-z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "");
    return c ? `nutriyet/${c}` : "nutriyet";
  },
}));
const getAdminUser = vi.fn();
const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ getAdminUser, auth }));

const { POST } = await import("@/app/api/admin/upload-signature/route");
const sign = (body: unknown) =>
  POST(new Request("http://x/api/admin/upload-signature", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  getAdminUser.mockResolvedValue({ id: "a1", role: "ADMIN", permissions: ["appearance"] });
  auth.mockResolvedValue({ user: { id: "a1" } });
});

describe("upload-signature route", () => {
  it("returns 401 with a session-expired message when signed out", async () => {
    getAdminUser.mockResolvedValue(null);
    auth.mockResolvedValue(null);
    const res = await sign({ folder: "banners", kind: "image" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/session has expired/);
    expect(signUpload).not.toHaveBeenCalled();
  });

  it("returns 403 for a signed-in non-admin / deactivated admin", async () => {
    getAdminUser.mockResolvedValue(null);
    const res = await sign({ folder: "banners", kind: "image" });
    expect(res.status).toBe(403);
    expect(signUpload).not.toHaveBeenCalled();
  });

  it("pins the folder and allowed formats for the kind", async () => {
    const res = await sign({ folder: "banners", kind: "video" });
    expect(res.status).toBe(200);
    expect(signUpload).toHaveBeenCalledWith("nutriyet/banners", { allowed_formats: "mp4,webm,mov" });
    const body = await res.json();
    expect(body.allowed_formats).toBe("mp4,webm,mov");
    expect(body).not.toHaveProperty("apiSecret");
  });

  it("defaults an unknown kind to images+videos (never unrestricted)", async () => {
    await sign({ folder: "../../etc", kind: "anything" });
    const [folder, extra] = signUpload.mock.calls[0];
    expect(folder).toBe("nutriyet/etc");
    expect(extra?.allowed_formats).toContain("jpg");
    expect(extra?.allowed_formats).toContain("mp4");
  });

  it("only lets JNV admins request an unrestricted document signature", async () => {
    expect((await sign({ folder: "jnv", kind: "file" })).status).toBe(403);
    getAdminUser.mockResolvedValue({ id: "a1", role: "ADMIN", permissions: ["jnv"] });
    expect((await sign({ folder: "jnv", kind: "file" })).status).toBe(200);
    getAdminUser.mockResolvedValue({ id: "s1", role: "SUPER_ADMIN", permissions: [] });
    expect((await sign({ folder: "jnv", kind: "file" })).status).toBe(200);
    expect(signUpload).toHaveBeenLastCalledWith("nutriyet/jnv");
  });
});
