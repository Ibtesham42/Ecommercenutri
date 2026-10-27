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

  it("surfaces Cloudinary's own error message (e.g. plan size limit)", () => {
    const res = parseCloudinaryUploadResponse(
      400,
      JSON.stringify({ error: { message: "File size too large. Got 15000000. Maximum is 10485760." } }),
    );
    expect(res).toEqual({ ok: false, error: "Upload failed: File size too large. Got 15000000. Maximum is 10485760." });
  });

  it("reports the HTTP status for a non-JSON error body", () => {
    expect(parseCloudinaryUploadResponse(413, "<html>Request Entity Too Large</html>")).toEqual({
      ok: false,
      error: "Cloudinary upload failed (HTTP 413).",
    });
    expect(parseCloudinaryUploadResponse(0, "")).toEqual({ ok: false, error: "Cloudinary upload failed (HTTP no response)." });
  });

  it("treats a 2xx without a secure_url as a failure", () => {
    expect(parseCloudinaryUploadResponse(200, "{}").ok).toBe(false);
  });
});
