import { describe, expect, it } from "vitest";
import { jnvSaveErrorMessage } from "@/lib/jnv/save-error";
import { jnvUploadSizeError, resolveJnvUploadLimits } from "@/lib/jnv/upload-limits";
import { parseCloudinaryUploadResponse } from "@/lib/cloudinary-upload-response";

const MB = 1024 * 1024;

describe("jnvSaveErrorMessage", () => {
  it("recognises a read-only database (Prisma's real 25006 error text)", () => {
    const err = new Error(
      'Error occurred during query execution: ConnectorError(... PostgresError { code: "25006", message: "cannot execute INSERT in a read-only transaction" ...',
    );
    expect(jnvSaveErrorMessage(err)).toMatch(/read-only maintenance/);
  });

  it("recognises an unreachable database", () => {
    expect(jnvSaveErrorMessage(Object.assign(new Error("x"), { code: "P1001" }))).toMatch(/reach the database/);
  });

  it("never leaks raw DB details for anything else", () => {
    const msg = jnvSaveErrorMessage(new Error('relation "secret_table" does not exist'));
    expect(msg).toBe("Couldn't save the resource. Please try again.");
    expect(jnvSaveErrorMessage(undefined)).toBe("Couldn't save the resource. Please try again.");
  });
});

describe("JNV upload limits", () => {
  it("defaults to the previous 100 MB cap for everything", () => {
    expect(resolveJnvUploadLimits({})).toEqual({ mediaMb: 100, documentMb: 100 });
  });

  it("reads separate media/document caps and ignores junk values", () => {
    expect(resolveJnvUploadLimits({ JNV_MAX_MEDIA_UPLOAD_MB: "200", JNV_MAX_DOCUMENT_UPLOAD_MB: "10" })).toEqual({
      mediaMb: 200,
      documentMb: 10,
    });
    expect(resolveJnvUploadLimits({ JNV_MAX_MEDIA_UPLOAD_MB: "abc", JNV_MAX_DOCUMENT_UPLOAD_MB: "-5" })).toEqual({
      mediaMb: 100,
      documentMb: 100,
    });
  });

  it("applies the document cap to PDFs and the media cap to video", () => {
    const limits = { mediaMb: 100, documentMb: 10 };
    expect(jnvUploadSizeError({ name: "notes.pdf", type: "application/pdf", size: 9 * MB }, limits)).toBeNull();
    expect(jnvUploadSizeError({ name: "notes.pdf", type: "application/pdf", size: 11 * MB }, limits)).toMatch(
      /max 10 MB for documents/,
    );
    expect(jnvUploadSizeError({ name: "lesson.mp4", type: "video/mp4", size: 50 * MB }, limits)).toBeNull();
    expect(jnvUploadSizeError({ name: "lesson.mp4", type: "video/mp4", size: 101 * MB }, limits)).toMatch(
      /max 100 MB for video/,
    );
  });
});

describe("parseCloudinaryUploadResponse", () => {
  it("returns the upload info on success", () => {
    const res = parseCloudinaryUploadResponse(200, JSON.stringify({ secure_url: "https://res.cloudinary.com/x/a.pdf", bytes: 5 }));
    expect(res).toEqual({ ok: true, info: { secure_url: "https://res.cloudinary.com/x/a.pdf", bytes: 5 } });
  });

  it("translates Cloudinary's plan size limit into the admin-facing limit", () => {
    const img = parseCloudinaryUploadResponse(
      400,
      JSON.stringify({ error: { message: "File size too large. Got 15000000. Maximum is 10485760." } }),
    );
    expect(img).toEqual({ ok: false, error: "File size exceeds the 10 MB limit.", retryable: false });
    const vid = parseCloudinaryUploadResponse(
      400,
      JSON.stringify({ error: { message: "File size too large. Got 150000000. Maximum is 104857600." } }),
    );
    expect(vid).toMatchObject({ ok: false, error: "Video size exceeds the 100 MB limit." });
  });

  it("maps format, signature, stale and rate-limit errors to clear messages", () => {
    const err = (status: number, message: string) =>
      parseCloudinaryUploadResponse(status, JSON.stringify({ error: { message } }));
    expect(err(400, "Image file format bmp not allowed")).toMatchObject({ error: /Unsupported file format/ });
    expect(err(400, "Invalid image file")).toMatchObject({ error: /Unsupported file format/ });
    expect(err(401, "Invalid Signature 1234. String to sign - 'folder=x'.")).toMatchObject({
      error: /contact support/,
      retryable: false,
    });
    expect(err(400, "Stale request - reported time is 2026-01-01")).toMatchObject({ error: /took too long/ });
    expect(err(420, "Rate Limit Exceeded")).toMatchObject({ retryable: true });
    expect(err(400, "Some new Cloudinary message")).toMatchObject({ error: "Upload failed: Some new Cloudinary message" });
  });

  it("treats gateway errors and dropped connections as retryable", () => {
    expect(parseCloudinaryUploadResponse(502, "<html>Bad gateway</html>")).toMatchObject({ ok: false, retryable: true, error: /contact support/ });
    expect(parseCloudinaryUploadResponse(0, "")).toMatchObject({ ok: false, retryable: true, error: /Network connection lost/ });
    expect(parseCloudinaryUploadResponse(413, "<html>Request Entity Too Large</html>")).toMatchObject({ ok: false, error: /HTTP 413/ });
  });

  it("treats a 2xx without a secure_url as a failure", () => {
    expect(parseCloudinaryUploadResponse(200, "{}").ok).toBe(false);
  });
});
