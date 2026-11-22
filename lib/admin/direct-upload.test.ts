import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NETWORK_LOST_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  UploadError,
  isAbortError,
  uploadToCloudinary,
} from "@/lib/admin/direct-upload";

/**
 * Browser → Cloudinary transport, driven with a fake XMLHttpRequest: signature
 * errors, chunking, automatic retry of transient failures, cancel.
 */

type Reply = { status: number; body?: unknown } | "network-error";

class FakeXHR {
  static replies: Reply[] = [];
  static sent: { url: string; headers: Record<string, string>; fields: Record<string, unknown>; fileSize: number }[] = [];
  static hang = false;
  url = "";
  headers: Record<string, string> = {};
  status = 0;
  responseText = "";
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void; onload?: () => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  open(_m: string, url: string) {
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  abort() {
    this.onabort?.();
  }
  send(form: FormData) {
    const fields: Record<string, unknown> = {};
    form.forEach((v, k) => (fields[k] = v));
    const file = form.get("file") as Blob;
    FakeXHR.sent.push({ url: this.url, headers: this.headers, fields, fileSize: file.size });
    if (FakeXHR.hang) return;
    const reply = FakeXHR.replies.shift() ?? { status: 200, body: { secure_url: "https://res.cloudinary.com/demo/x.jpg" } };
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: file.size, total: file.size });
      this.upload.onload?.();
      if (reply === "network-error") return this.onerror?.();
      this.status = reply.status;
      this.responseText = JSON.stringify(reply.body ?? {});
      this.onload?.();
    });
  }
}

const SIG = { cloudName: "demo", apiKey: "key", timestamp: 123, signature: "sig", folder: "nutriyet/banners", allowed_formats: "jpg,png" };
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  FakeXHR.replies = [];
  FakeXHR.sent = [];
  FakeXHR.hang = false;
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify(SIG), { status: 200 }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const MB = 1024 * 1024;
const blob = (bytes: number) => new Blob([new Uint8Array(bytes)]);

describe("uploadToCloudinary", () => {
  it("sends the signed params verbatim and resolves with Cloudinary's info", async () => {
    const progress: number[] = [];
    const info = await uploadToCloudinary(blob(1000), "a.jpg", { folder: "banners", kind: "image", onProgress: (p) => progress.push(p) });
    expect(info.secure_url).toMatch(/res\.cloudinary\.com/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ folder: "banners", kind: "image" });
    const [req] = FakeXHR.sent;
    expect(req.url).toBe("https://api.cloudinary.com/v1_1/demo/auto/upload");
    expect(req.fields).toMatchObject({ api_key: "key", timestamp: "123", signature: "sig", folder: "nutriyet/banners", allowed_formats: "jpg,png" });
    expect(req.headers).toEqual({});
    expect(progress.at(-1)).toBe(100);
  });

  it("reports an expired session / missing permission from the signer", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "x" }), { status: 401 }));
    await expect(uploadToCloudinary(blob(10), "a.jpg")).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "You don't have permission to upload media." }), { status: 403 }));
    await expect(uploadToCloudinary(blob(10), "a.jpg")).rejects.toThrow(/permission/);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(uploadToCloudinary(blob(10), "a.jpg")).rejects.toThrow(NETWORK_LOST_MESSAGE);
    expect(FakeXHR.sent).toHaveLength(0);
  });

  it("uploads large files in chunks with a shared upload id and Content-Range", async () => {
    const total = 25 * MB;
    FakeXHR.replies = [
      { status: 200, body: { done: false } },
      { status: 200, body: { done: false } },
      { status: 200, body: { done: false } },
      { status: 200, body: { done: false } },
      { status: 200, body: { secure_url: "https://res.cloudinary.com/demo/v.mp4", bytes: total } },
    ];
    const info = await uploadToCloudinary(blob(total), "v.mp4", { kind: "video" });
    expect(info.secure_url).toMatch(/v\.mp4$/);
    expect(FakeXHR.sent).toHaveLength(5);
    const ids = new Set(FakeXHR.sent.map((s) => s.headers["X-Unique-Upload-Id"]));
    expect(ids.size).toBe(1);
    expect(FakeXHR.sent[0].headers["Content-Range"]).toBe(`bytes 0-${6 * MB - 1}/${total}`);
    expect(FakeXHR.sent[4].headers["Content-Range"]).toBe(`bytes ${24 * MB}-${total - 1}/${total}`);
    expect(FakeXHR.sent.reduce((n, s) => n + s.fileSize, 0)).toBe(total);
  });

  it("retries a dropped connection and only resends the failed chunk", async () => {
    const total = 21 * MB;
    FakeXHR.replies = [
      { status: 200, body: {} },
      "network-error",
      { status: 200, body: {} },
      { status: 200, body: {} },
      { status: 200, body: { secure_url: "https://res.cloudinary.com/demo/v.mp4" } },
    ];
    const p = uploadToCloudinary(blob(total), "v.mp4", { kind: "video" });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ secure_url: expect.any(String) });
    // chunk 0, chunk 1 (failed), chunk 1 (retry), chunk 2, chunk 3
    expect(FakeXHR.sent.map((s) => s.headers["Content-Range"]?.split(" ")[1].split("-")[0])).toEqual([
      "0",
      String(6 * MB),
      String(6 * MB),
      String(12 * MB),
      String(18 * MB),
    ]);
  });

  it("gives up after repeated network failures with a clear message", async () => {
    FakeXHR.replies = ["network-error", "network-error", "network-error", "network-error"];
    const p = uploadToCloudinary(blob(100), "a.jpg").catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await p;
    expect(err).toBeInstanceOf(UploadError);
    expect(err.message).toBe(NETWORK_LOST_MESSAGE);
    expect(FakeXHR.sent).toHaveLength(4);
  });

  it("does not retry a permanent Cloudinary rejection and shows the real reason", async () => {
    FakeXHR.replies = [{ status: 400, body: { error: { message: "File size too large. Got 15000000. Maximum is 10485760." } } }];
    await expect(uploadToCloudinary(blob(100), "a.jpg")).rejects.toThrow("File size exceeds the 10 MB limit.");
    expect(FakeXHR.sent).toHaveLength(1);
  });

  it("aborts a stalled transfer and retries it", async () => {
    FakeXHR.hang = true;
    const p = uploadToCloudinary(blob(100), "a.jpg").catch((e) => e);
    await vi.advanceTimersByTimeAsync(60_001);
    expect(FakeXHR.sent).toHaveLength(1);
    FakeXHR.hang = false;
    await vi.runAllTimersAsync();
    expect((await p).secure_url).toBeDefined();
    expect(FakeXHR.sent).toHaveLength(2);
  });

  it("cancels cleanly via AbortSignal", async () => {
    FakeXHR.hang = true;
    const ac = new AbortController();
    const p = uploadToCloudinary(blob(100), "a.jpg", { signal: ac.signal }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(0);
    ac.abort();
    expect(isAbortError(await p)).toBe(true);
  });
});
