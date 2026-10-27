/**
 * Interpret Cloudinary's response to a direct browser upload. Kept in a plain
 * module (not the "use client" uploader) so it's unit-testable.
 *
 * Cloudinary's own JSON error text is the most useful thing to show (e.g.
 * "File size too large. Got 15000000. Maximum is 10485760."); a non-JSON body
 * (proxy/gateway error page) still reports the HTTP status instead of a bare
 * "failed".
 */
export function parseCloudinaryUploadResponse<T extends { secure_url?: string }>(
  status: number,
  responseText: string,
): { ok: true; info: T & { secure_url: string } } | { ok: false; error: string } {
  let body: (T & { error?: { message?: string } }) | null = null;
  try {
    body = JSON.parse(responseText);
  } catch {
    /* non-JSON body */
  }
  if (status >= 200 && status < 300 && body?.secure_url) {
    return { ok: true, info: body as T & { secure_url: string } };
  }
  const message = body?.error?.message?.trim();
  if (message) return { ok: false, error: `Upload failed: ${message}` };
  return { ok: false, error: `Cloudinary upload failed (HTTP ${status || "no response"}).` };
}
