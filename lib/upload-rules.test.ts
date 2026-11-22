import { describe, expect, it } from "vitest";
import { allowedFormatsFor, checkMediaFile, kindFromAccept, mediaRequirements } from "@/lib/upload-rules";

const MB = 1024 * 1024;

describe("checkMediaFile", () => {
  it("accepts recompressible images up to 15 MB and as-is images up to 10 MB", () => {
    expect(checkMediaFile({ name: "banner.jpg", type: "image/jpeg", size: 14 * MB }, "image")).toBeNull();
    expect(checkMediaFile({ name: "banner.png", type: "image/png", size: 15 * MB }, "image")).toBeNull();
    expect(checkMediaFile({ name: "banner.jpg", type: "image/jpeg", size: 16 * MB }, "image")).toBe(
      "File size exceeds the 15 MB limit.",
    );
    expect(checkMediaFile({ name: "anim.gif", type: "image/gif", size: 9 * MB }, "image")).toBeNull();
    expect(checkMediaFile({ name: "anim.gif", type: "image/gif", size: 11 * MB }, "image")).toBe(
      "File size exceeds the 10 MB limit.",
    );
  });

  it("accepts videos up to 100 MB", () => {
    expect(checkMediaFile({ name: "hero.mp4", type: "video/mp4", size: 99 * MB }, "video")).toBeNull();
    expect(checkMediaFile({ name: "hero.mov", type: "video/quicktime", size: 50 * MB }, "media")).toBeNull();
    expect(checkMediaFile({ name: "hero.mp4", type: "video/mp4", size: 101 * MB }, "video")).toBe(
      "Video size exceeds the 100 MB limit.",
    );
  });

  it("never trusts the extension or the MIME type alone", () => {
    expect(checkMediaFile({ name: "evil.exe", type: "image/png", size: 10 }, "image")).toMatch(/Unsupported file format/);
    expect(checkMediaFile({ name: "photo.png", type: "application/x-msdownload", size: 10 }, "image")).toMatch(
      /Unsupported file format/,
    );
    expect(checkMediaFile({ name: "clip.avi", type: "video/x-msvideo", size: 10 }, "video")).toMatch(
      /Unsupported video format/,
    );
    expect(checkMediaFile({ name: "scan.tiff", type: "image/tiff", size: 10 }, "image")).toMatch(/Unsupported file format/);
  });

  it("falls back to the extension when the OS reports no MIME (e.g. .mov on Windows)", () => {
    expect(checkMediaFile({ name: "clip.mov", type: "", size: 10 * MB }, "video")).toBeNull();
    expect(checkMediaFile({ name: "clip.mov", type: "", size: 10 * MB }, "image")).toMatch(/Unsupported file format/);
  });

  it("rejects a video in an image-only field and vice versa", () => {
    expect(checkMediaFile({ name: "a.mp4", type: "video/mp4", size: 10 }, "image")).toMatch(/Unsupported file format/);
    expect(checkMediaFile({ name: "a.jpg", type: "image/jpeg", size: 10 }, "video")).toMatch(/Unsupported video format/);
  });

  it("rejects empty files", () => {
    expect(checkMediaFile({ name: "a.jpg", type: "image/jpeg", size: 0 }, "image")).toMatch(/empty/);
  });
});

describe("kinds, signing formats and hints", () => {
  it("infers the kind from legacy accept strings", () => {
    expect(kindFromAccept(undefined)).toBe("image");
    expect(kindFromAccept("image/*")).toBe("image");
    expect(kindFromAccept("video/mp4,video/webm,video/quicktime")).toBe("video");
    expect(kindFromAccept("image/*,video/*")).toBe("media");
    expect(kindFromAccept("image/png,image/svg+xml,image/x-icon,.png,.svg,.ico")).toBe("image");
  });

  it("signs only the formats a kind allows", () => {
    expect(allowedFormatsFor("image").split(",")).not.toContain("mp4");
    expect(allowedFormatsFor("video").split(",")).toEqual(["mp4", "webm", "mov"]);
    expect(allowedFormatsFor("media").split(",")).toEqual(expect.arrayContaining(["jpg", "png", "mp4"]));
  });

  it("states the limits in the hint", () => {
    expect(mediaRequirements("image")).toMatch(/max 15 MB/);
    expect(mediaRequirements("video", { maxDurationSec: 15 })).toMatch(/100 MB · max 15s/);
  });
});
