import "server-only";
import { env, isConfigured } from "@/lib/env";

/**
 * Instagram publishing via the Meta Graph API (Content Publishing). Two-step
 * flow: create a media container, then publish it. Carousels create N child
 * containers, then a CAROUSEL parent, then publish. Requires an Instagram
 * Business/Creator account (INSTAGRAM_BUSINESS_ID) + a long-lived token
 * (INSTAGRAM_ACCESS_TOKEN); image URLs must be public (Cloudinary already is).
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

/** Compose the final Instagram caption (body + hashtag block), within limits. */
export function composeCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags.slice(0, IG_HASHTAG_MAX).join(" ");
  const full = tags ? `${caption.trim()}\n\n${tags}` : caption.trim();
  return full.slice(0, IG_CAPTION_MAX);
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

/** POST to a Graph edge with form-encoded params; throws with the API message. */
async function graphPost(path: string, params: Record<string, string>): Promise<{ id: string }> {
  const body = new URLSearchParams({ ...params, access_token: env.instagramAccessToken });
  const res = await fetch(`${graphBase()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
  };
  if (!res.ok || !json.id) {
    const e = json.error;
    const detail = e
      ? `${e.message ?? "Graph API error"}${e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""})` : ""}${e.fbtrace_id ? ` [trace ${e.fbtrace_id}]` : ""}`
      : `Graph API error (${res.status})`;
    throw new Error(detail);
  }
  return { id: json.id };
}

async function fetchPermalink(mediaId: string): Promise<string | null> {
  try {
    const url = `${graphBase()}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(
      env.instagramAccessToken,
    )}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as { permalink?: string };
    return json.permalink ?? null;
  } catch {
    return null;
  }
}

export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const images = input.imageUrls.filter(Boolean);
  if (images.length === 0) {
    return { ok: false, error: "No image to publish." };
  }
  const caption = composeCaption(input.caption, input.hashtags);

  // Keyless fallback — pretend-publish so the pipeline is testable end-to-end.
  if (!isConfigured.instagram()) {
    return {
      ok: true,
      externalId: `mock_${Date.now()}`,
      permalink: null,
      mock: true,
    };
  }

  const igUserId = env.instagramBusinessId;
  try {
    let creationId: string;
    if (images.length === 1) {
      const container = await graphPost(`${igUserId}/media`, {
        image_url: images[0],
        caption,
      });
      creationId = container.id;
    } else {
      // Carousel: children first, then a CAROUSEL parent with the caption.
      const childIds: string[] = [];
      for (const url of images) {
        const child = await graphPost(`${igUserId}/media`, {
          image_url: url,
          is_carousel_item: "true",
        });
        childIds.push(child.id);
      }
      const parent = await graphPost(`${igUserId}/media`, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption,
      });
      creationId = parent.id;
    }

    const published = await graphPost(`${igUserId}/media_publish`, {
      creation_id: creationId,
    });
    const permalink = await fetchPermalink(published.id);
    return { ok: true, externalId: published.id, permalink, mock: false };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Instagram publish failed.";
    console.error("[social] Instagram publish failed:", error);
    return { ok: false, error };
  }
}
