import "server-only";
import { env, isConfigured } from "@/lib/env";

/**
 * Instagram publishing via the Meta Graph API (Content Publishing). Two-step
 * flow: create a media container, WAIT for Meta to finish ingesting it, then
 * publish. Carousels create N child containers, wait for each, then a CAROUSEL
 * parent, then publish. Requires an Instagram Business/Creator account
 * (INSTAGRAM_BUSINESS_ID) + a long-lived token (INSTAGRAM_ACCESS_TOKEN); image
 * URLs must be public (Cloudinary already is).
 *
 * Why the wait matters: publishing a container before Meta has ingested the
 * image fails with "Media ID is not available" (code 9007 / subcode 2207027).
 * We poll `GET /{creation_id}?fields=status_code` with exponential backoff until
 * it reports FINISHED, and only then call media_publish.
 *
 * Robustness: every image URL is validated (reachable, JPEG/PNG, within size)
 * and normalized to an Instagram-safe Cloudinary rendition. Invalid images are
 * skipped rather than failing the whole post; if a carousel can't be built we
 * fall back to a single-image post so something still ships.
 *
 * Keyless philosophy: when not configured, returns a "mock published" success so
 * the whole draft → schedule → publish flow works end-to-end without credentials.
 */

export type PublishResult =
  | { ok: true; externalId: string; permalink: string | null; mock: boolean }
  | { ok: false; error: string };

export type PublishInput = {
  caption: string;
  hashtags: string[];
  imageUrls: string[]; // [0] = cover; more => carousel
};

const IG_CAPTION_MAX = 2200;
const IG_HASHTAG_MAX = 30;

// Instagram image constraints (Content Publishing API).
const IG_MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB hard limit
const IG_IMAGE_WIDTH = 1080; // recommended feed width; c_limit never upscales
const IG_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

// Container-status polling (Meta ingests the image asynchronously).
const POLL_MAX_ATTEMPTS = 12;
const POLL_BASE_DELAY_MS = 1500;
const POLL_MAX_DELAY_MS = 8000;

/** Compose the final Instagram caption (body + hashtag block), within limits. */
export function composeCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags.slice(0, IG_HASHTAG_MAX).join(" ");
  const full = tags ? `${caption.trim()}\n\n${tags}` : caption.trim();
  return full.slice(0, IG_CAPTION_MAX);
}

/**
 * Normalize a URL to an Instagram-safe rendition. For Cloudinary URLs this
 * forces JPEG, caps the width at 1080 (c_limit never upscales) and lets
 * Cloudinary pick a sane quality — guaranteeing a supported format and a file
 * size well under Instagram's 8 MB ceiling. Non-Cloudinary URLs are returned
 * unchanged (they must already be a public JPEG/PNG).
 */
export function toInstagramImageUrl(url: string): string {
  const clean = (url ?? "").trim();
  if (!clean.includes("res.cloudinary.com") || !clean.includes("/upload/")) {
    return clean;
  }
  const transform = `f_jpg,q_auto:good,w_${IG_IMAGE_WIDTH},c_limit`;
  return clean
    .replace("/upload/", `/upload/${transform}/`)
    .replace(/\.(png|webp|avif|gif|tiff?|heic)(\?|$)/i, ".jpg$2");
}

/**
 * Verify an image URL is publicly reachable and is a supported Instagram image
 * (HTTP 200, JPEG/PNG content-type, within the 8 MB limit). Best-effort: if a
 * host rejects HEAD we retry with a ranged GET; a network error means "invalid"
 * so the caller can skip it. Returns the reason on failure for logging.
 */
async function validateImageUrl(
  url: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const check = (
    status: number,
    contentType: string | null,
    contentLength: string | null,
  ): { ok: true } | { ok: false; reason: string } => {
    if (status !== 200) return { ok: false, reason: `HTTP ${status}` };
    const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
    if (type && !IG_CONTENT_TYPES.has(type)) {
      return { ok: false, reason: `unsupported type ${type}` };
    }
    const bytes = contentLength ? Number(contentLength) : NaN;
    if (Number.isFinite(bytes) && bytes > IG_MAX_IMAGE_BYTES) {
      return { ok: false, reason: `too large (${Math.round(bytes / 1024 / 1024)} MB)` };
    }
    return { ok: true };
  };

  try {
    const head = await fetch(url, { method: "HEAD" });
    const headResult = check(
      head.status,
      head.headers.get("content-type"),
      head.headers.get("content-length"),
    );
    // A 200 with a supported type is conclusive; otherwise fall through to GET
    // (some CDNs 405 HEAD or omit content-type on HEAD).
    if (headResult.ok) return headResult;
    if (head.status !== 200 && head.status !== 405 && head.status !== 403) {
      return headResult;
    }
  } catch {
    // HEAD unsupported/blocked — try a ranged GET below.
  }

  try {
    const get = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    // 206 (partial) or 200 both mean the asset is reachable.
    const status = get.status === 206 ? 200 : get.status;
    const result = check(
      status,
      get.headers.get("content-type"),
      get.headers.get("content-length"),
    );
    // Drain the (tiny) body so the socket can be reused.
    await get.arrayBuffer().catch(() => undefined);
    return result;
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unreachable" };
  }
}

function graphBase(): string {
  // IGAA… tokens are "Instagram API with Instagram Login" and must use
  // graph.instagram.com; classic Facebook-Login (EAA…) tokens use graph.facebook.com.
  const host =
    env.instagramApiBase.trim() ||
    (env.instagramAccessToken.startsWith("IG")
      ? "https://graph.instagram.com"
      : "https://graph.facebook.com");
  return `${host.replace(/\/$/, "")}/${env.instagramApiVersion}`;
}

type GraphError = {
  message?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

/** Human-readable one-liner for a Graph API error (shown to the admin). */
function formatGraphError(status: number, e: GraphError | undefined): string {
  if (!e) return `Graph API error (HTTP ${status}).`;
  const parts: string[] = [e.message ?? "Graph API error"];
  if (e.code != null) {
    parts.push(`(code ${e.code}${e.error_subcode != null ? `/${e.error_subcode}` : ""})`);
  }
  if (e.fbtrace_id) parts.push(`[trace ${e.fbtrace_id}]`);
  return parts.join(" ");
}

type GraphResponse = {
  status: number;
  ok: boolean;
  json: Record<string, unknown>;
  error?: GraphError;
};

/** Low-level Graph request with full response logging. */
async function graphRequest(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string>,
): Promise<GraphResponse> {
  const search = new URLSearchParams({ ...params, access_token: env.instagramAccessToken });
  const url = `${graphBase()}/${path}`;
  let res: Response;
  if (method === "POST") {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: search,
    });
  } else {
    res = await fetch(`${url}?${search.toString()}`, { method: "GET" });
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const error = (json.error as GraphError | undefined) ?? undefined;

  // Log the full Graph response (never the access token) so failures are
  // diagnosable from the server logs — body, HTTP status, code, subcode, trace.
  const redactedPath = path.replace(env.instagramAccessToken, "***");
  console.info(
    `[social][ig] ${method} ${redactedPath} → HTTP ${res.status}` +
      (error
        ? ` error{code:${error.code ?? "?"} subcode:${error.error_subcode ?? "?"} trace:${error.fbtrace_id ?? "?"} msg:${error.message ?? "?"}}`
        : ` body:${JSON.stringify(json)}`),
  );

  return { status: res.status, ok: res.ok, json, error };
}

/** POST to a Graph edge, returning the created object id; throws on error. */
async function graphPost(path: string, params: Record<string, string>): Promise<string> {
  const res = await graphRequest("POST", path, params);
  const id = res.json.id as string | undefined;
  if (!res.ok || !id) {
    throw new Error(formatGraphError(res.status, res.error));
  }
  return id;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll a media container until Meta reports it FINISHED (ready to publish).
 * This is the fix for "Media ID is not available" (9007/2207027): publishing
 * before ingestion completes fails. Exponential backoff, capped attempts.
 * Throws if the container errors, expires, or never finishes in time.
 */
async function waitForContainer(creationId: string): Promise<void> {
  let delay = POLL_BASE_DELAY_MS;
  let lastStatus = "UNKNOWN";
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(delay);
    const res = await graphRequest("GET", creationId, { fields: "status_code,status" });
    const statusCode = (res.json.status_code as string | undefined) ?? "";
    lastStatus = statusCode || (res.json.status as string | undefined) || lastStatus;

    if (statusCode === "FINISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(
        `Media processing ${statusCode.toLowerCase()} for container ${creationId}` +
          (res.error ? ` — ${formatGraphError(res.status, res.error)}` : "") +
          (res.json.status ? ` (${String(res.json.status)})` : ""),
      );
    }
    // IN_PROGRESS (or a transient read error) — back off and retry.
    delay = Math.min(Math.round(delay * 1.6), POLL_MAX_DELAY_MS);
  }
  throw new Error(
    `Media still processing after ${POLL_MAX_ATTEMPTS} checks (last status: ${lastStatus}). Try again shortly.`,
  );
}

/** Read-only Graph GET for a media object (insights, counts). Best-effort:
 *  returns the parsed body + ok flag, never throws. Only usable when Instagram
 *  is configured (callers guard on isConfigured.instagram()). */
export async function igGraphGet(
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await graphRequest("GET", path, params);
  return { ok: res.ok, status: res.status, json: res.json };
}

async function fetchPermalink(mediaId: string): Promise<string | null> {
  try {
    const res = await graphRequest("GET", mediaId, { fields: "permalink" });
    return (res.json.permalink as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** The account path segment: `me` for Instagram-Login tokens, else the numeric id. */
function igUserPath(): string {
  return !env.instagramApiBase.trim() && env.instagramAccessToken.startsWith("IG")
    ? "me"
    : env.instagramBusinessId;
}

/** Create a container, wait for ingestion, and return the ready creation_id. */
async function createAndWait(
  igUserId: string,
  params: Record<string, string>,
): Promise<string> {
  const creationId = await graphPost(`${igUserId}/media`, params);
  await waitForContainer(creationId);
  return creationId;
}

/** Publish a ready container and resolve its permalink. */
async function publishContainer(
  igUserId: string,
  creationId: string,
): Promise<{ externalId: string; permalink: string | null }> {
  const externalId = await graphPost(`${igUserId}/media_publish`, { creation_id: creationId });
  const permalink = await fetchPermalink(externalId);
  return { externalId, permalink };
}

/** Publish a single image (used directly and as the carousel fallback). */
async function publishSingle(
  igUserId: string,
  imageUrl: string,
  caption: string,
): Promise<{ externalId: string; permalink: string | null }> {
  const creationId = await createAndWait(igUserId, { image_url: imageUrl, caption });
  return publishContainer(igUserId, creationId);
}

export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const rawImages = input.imageUrls.map((u) => (u ?? "").trim()).filter(Boolean);
  if (rawImages.length === 0) {
    return { ok: false, error: "No image to publish." };
  }
  const caption = composeCaption(input.caption, input.hashtags);

  // Keyless fallback — pretend-publish so the pipeline is testable end-to-end.
  if (!isConfigured.instagram()) {
    return { ok: true, externalId: `mock_${Date.now()}`, permalink: null, mock: true };
  }

  // Validate + normalize every image up front; skip any that Instagram would
  // reject so one bad image doesn't sink the whole post.
  const valid: string[] = [];
  for (const raw of rawImages) {
    const igUrl = toInstagramImageUrl(raw);
    const v = await validateImageUrl(igUrl);
    if (v.ok) {
      valid.push(igUrl);
    } else {
      console.warn(`[social][ig] skipping image (${v.reason}): ${igUrl}`);
    }
  }
  if (valid.length === 0) {
    return {
      ok: false,
      error: "No usable image — every candidate failed validation (unreachable or unsupported format/size).",
    };
  }

  const igUserId = igUserPath();

  try {
    // Single image (or only one survived validation).
    if (valid.length === 1) {
      const r = await publishSingle(igUserId, valid[0], caption);
      return { ok: true, externalId: r.externalId, permalink: r.permalink, mock: false };
    }

    // Carousel: build + wait for each child, then the parent, then publish.
    try {
      const childIds: string[] = [];
      for (const url of valid) {
        const childId = await createAndWait(igUserId, {
          image_url: url,
          is_carousel_item: "true",
        });
        childIds.push(childId);
      }
      const parentId = await createAndWait(igUserId, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption,
      });
      const r = await publishContainer(igUserId, parentId);
      return { ok: true, externalId: r.externalId, permalink: r.permalink, mock: false };
    } catch (carouselErr) {
      // Carousel failed — fall back to a single-image post with the cover so
      // the post still ships instead of failing outright.
      const reason = carouselErr instanceof Error ? carouselErr.message : "unknown error";
      console.warn(`[social][ig] carousel failed, falling back to single image: ${reason}`);
      const r = await publishSingle(igUserId, valid[0], caption);
      return { ok: true, externalId: r.externalId, permalink: r.permalink, mock: false };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : "Instagram publish failed.";
    console.error("[social] Instagram publish failed:", error);
    return { ok: false, error };
  }
}
