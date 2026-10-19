import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Marketing-kit uploads: the browser uploads straight to Cloudinary with a
 * server-issued signature; the server never receives file bytes, signs only the
 * marketing folder + allowed formats, and re-verifies what was stored.
 */

const resource = vi.fn();
const destroy = vi.fn();
const signUpload = vi.fn((folder: string, extra: Record<string, string>) => ({
  cloudName: "demo",
  apiKey: "key",
  timestamp: 1,
  signature: "sig",
  folder,
  ...extra,
}));
vi.mock("@/lib/env", () => ({ env: { cloudinaryCloudName: "demo" }, isConfigured: { cloudinary: () => true } }));
vi.mock("@/lib/cloudinary", () => ({
  cloudinaryEnabled: true,
  cloudinary: { api: { resource }, uploader: { destroy } },
  signUpload,
  publicIdFromUrl: (url: string) => {
    if (!url.includes("res.cloudinary.com/demo/")) return null;
    const id = url.replace(/^.*\/upload\/(v\d+\/)?/, "").replace(/\.[a-z0-9]+$/i, "");
    return id.startsWith("nutriyet/") ? id : null;
  },
}));
const requirePermission = vi.fn();
vi.mock("@/lib/auth", () => ({ requirePermission }));

const { POST } = await import("@/app/api/admin/affiliate-asset/route");
const { verifyMarketingUpload } = await import("@/lib/affiliate/marketing-upload");
const { checkMarketingFile, MARKETING_UPLOAD_MAX_BYTES } = await import("@/lib/affiliate/marketing-upload-rules");

const sign = (body: unknown) =>
  POST(new Request("http://x/api/admin/affiliate-asset", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ email: "ops@local.test" });
});

describe("file pre-flight rules", () => {
  it("accepts the supported types within the size cap", () => {
    expect(checkMarketingFile({ name: "banner.png", type: "image/png", size: 1000 })).toBeNull();
    expect(checkMarketingFile({ name: "reel.mp4", type: "video/mp4", size: 20 * 1024 * 1024 })).toBeNull();
    expect(checkMarketingFile({ name: "catalogue.pdf", type: "application/pdf", size: 5_000_000 })).toBeNull();
  });
  it("rejects other types, spoofed extensions, empty and oversized files", () => {
    expect(checkMarketingFile({ name: "x.exe", type: "application/octet-stream", size: 10 })).toMatch(/Use a JPG/);
    expect(checkMarketingFile({ name: "x.svg", type: "image/svg+xml", size: 10 })).toMatch(/Use a JPG/);
    expect(checkMarketingFile({ name: "x.exe", type: "image/png", size: 10 })).toMatch(/Use a JPG/);
    expect(checkMarketingFile({ name: "x.png", type: "image/png", size: 0 })).toMatch(/empty/);
    expect(checkMarketingFile({ name: "x.mp4", type: "video/mp4", size: MARKETING_UPLOAD_MAX_BYTES + 1 })).toMatch(/too large/);
  });
});

describe("signing endpoint", () => {
  it("requires the affiliates permission", async () => {
    requirePermission.mockRejectedValue(new Error("FORBIDDEN"));
    expect((await sign({ name: "a.png", type: "image/png", size: 10 })).status).toBe(403);
    expect(signUpload).not.toHaveBeenCalled();
  });

  it("signs only the marketing folder and allowed formats; secret never leaves the server", async () => {
    const res = await sign({ name: "a.png", type: "image/png", size: 10 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(signUpload).toHaveBeenCalledWith("nutriyet/marketing", {
      allowed_formats: "jpg,jpeg,png,webp,gif,mp4,mov,webm,pdf",
    });
    expect(json).toMatchObject({ folder: "nutriyet/marketing", signature: "sig" });
    expect(JSON.stringify(json)).not.toMatch(/secret/i);
  });

  it("refuses disallowed or oversized files before signing", async () => {
    expect((await sign({ name: "a.svg", type: "image/svg+xml", size: 10 })).status).toBe(400);
    expect((await sign({ name: "a.mp4", type: "video/mp4", size: MARKETING_UPLOAD_MAX_BYTES + 1 })).status).toBe(400);
    expect(signUpload).not.toHaveBeenCalled();
  });

  it("never accepts file bytes (the old proxy upload is gone)", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["x".repeat(1000)], { type: "image/png" }), "a.png");
    const res = await POST(new Request("http://x/api/admin/affiliate-asset", { method: "POST", body: fd }));
    expect(res.status).toBe(400);
    expect(signUpload).not.toHaveBeenCalled();
  });
});

describe("post-upload verification", () => {
  const url = "https://res.cloudinary.com/demo/video/upload/v1/nutriyet/marketing/reel.mp4";

  it("accepts a stored file within limits", async () => {
    resource.mockResolvedValue({ bytes: 10_000_000, format: "mp4" });
    expect(await verifyMarketingUpload(url)).toBeNull();
    expect(resource).toHaveBeenCalledWith("nutriyet/marketing/reel", { resource_type: "video" });
    expect(destroy).not.toHaveBeenCalled();
  });

  it("deletes and rejects an oversized or wrong-format upload", async () => {
    resource.mockResolvedValue({ bytes: MARKETING_UPLOAD_MAX_BYTES + 1, format: "mp4" });
    expect(await verifyMarketingUpload(url)).toMatch(/too large/);
    expect(destroy).toHaveBeenCalledWith("nutriyet/marketing/reel", { resource_type: "video", invalidate: true });

    resource.mockResolvedValue({ bytes: 100, format: "svg" });
    expect(await verifyMarketingUpload(url.replace("video", "image").replace(".mp4", ".svg"))).toMatch(/isn't allowed/);
  });

  it("fails closed when the stored file can't be checked", async () => {
    resource.mockRejectedValue(new Error("rate limited"));
    expect(await verifyMarketingUpload(url)).toMatch(/couldn't verify/);
  });

  it("leaves pasted external URLs and other folders alone (existing behaviour)", async () => {
    expect(await verifyMarketingUpload("https://example.com/banner.png")).toBeNull();
    expect(await verifyMarketingUpload("https://res.cloudinary.com/demo/image/upload/v1/nutriyet/hero/a.jpg")).toBeNull();
    expect(resource).not.toHaveBeenCalled();
  });
});
