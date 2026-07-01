"use client";

/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import type { PreviewData } from "@/lib/seo-preview";

export type { PreviewData };

export const PLATFORMS = [
  { key: "google", label: "Google Search", emoji: "🔎" },
  { key: "discover", label: "Google Discover", emoji: "📱" },
  { key: "whatsapp", label: "WhatsApp", emoji: "📱" },
  { key: "facebook", label: "Facebook", emoji: "📘" },
  { key: "linkedin", label: "LinkedIn", emoji: "💼" },
  { key: "twitter", label: "X (Twitter)", emoji: "🐦" },
  { key: "telegram", label: "Telegram", emoji: "✈️" },
  { key: "discord", label: "Discord", emoji: "💬" },
  { key: "instagram", label: "Instagram DM", emoji: "📸" },
  { key: "gmail", label: "Gmail", emoji: "📧" },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]["key"];

function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("grid place-items-center bg-muted text-[10px] text-muted-foreground", className)}>
        No image
      </div>
    );
  }
  return <img src={src} alt={alt} className={cn("object-cover", className)} />;
}

function Favicon({ src }: { src: string }) {
  return src ? (
    <img src={src} alt="" className="size-4 shrink-0 rounded-sm object-cover" />
  ) : (
    <span className="grid size-4 shrink-0 place-items-center rounded-sm bg-primary/15 text-[8px] font-bold text-primary">
      N
    </span>
  );
}

/** Renders the share card for a single platform, styled to resemble the real UI. */
export function PlatformPreview({ platform, data }: { platform: PlatformKey; data: PreviewData }) {
  const { title, description, image, siteName, domain, favicon } = data;
  const host = domain || "nutriyet.in";

  switch (platform) {
    case "google":
      return (
        <div className="max-w-xl rounded-xl border bg-white p-4 text-left dark:bg-zinc-900">
          <div className="mb-1 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full border bg-white dark:bg-zinc-800">
              <Favicon src={favicon} />
            </span>
            <div className="leading-tight">
              <div className="text-[13px] text-zinc-800 dark:text-zinc-200">{siteName}</div>
              <div className="text-xs text-zinc-500">{host} › </div>
            </div>
          </div>
          <div className="text-[20px] leading-6 text-[#1a0dab] hover:underline dark:text-[#8ab4f8]">
            {title || "Page title"}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">
            {description || "Meta description preview…"}
          </p>
        </div>
      );

    case "discover":
      return (
        <div className="max-w-sm overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-zinc-900">
          <Img src={image} alt="" className="h-44 w-full" />
          <div className="p-3">
            <p className="text-[17px] font-medium leading-6 text-zinc-900 dark:text-zinc-100 line-clamp-3">
              {title || "Page title"}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <Favicon src={favicon} /> {siteName}
            </div>
          </div>
        </div>
      );

    case "whatsapp":
      return (
        <div className="max-w-[320px] rounded-lg rounded-tl-none bg-[#dcf8c6] p-1.5 shadow-sm dark:bg-[#075e54]">
          <div className="overflow-hidden rounded-md bg-white dark:bg-zinc-800">
            <Img src={image} alt="" className="h-40 w-full" />
            <div className="p-2">
              <p className="line-clamp-2 text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-zinc-500">{description}</p>
              <p className="mt-1 text-[11px] uppercase text-zinc-400">{host}</p>
            </div>
          </div>
          <p className="px-1 pt-1 text-[12px] text-zinc-700 dark:text-zinc-200">https://{host}</p>
        </div>
      );

    case "facebook":
      return (
        <div className="max-w-[500px] overflow-hidden rounded-lg border bg-white dark:bg-zinc-900">
          <Img src={image} alt="" className="aspect-[1.91/1] w-full" />
          <div className="border-t bg-[#f2f3f5] px-3 py-2 dark:bg-zinc-800">
            <div className="text-[12px] uppercase tracking-wide text-zinc-500">{host}</div>
            <div className="mt-0.5 line-clamp-2 text-[16px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
            <div className="mt-0.5 line-clamp-1 text-[14px] text-zinc-500">{description}</div>
          </div>
        </div>
      );

    case "linkedin":
      return (
        <div className="max-w-[500px] overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-zinc-900">
          <Img src={image} alt="" className="aspect-[1.91/1] w-full" />
          <div className="px-3 py-2">
            <div className="line-clamp-2 text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
            <div className="mt-0.5 text-[12px] text-zinc-500">{host}</div>
          </div>
        </div>
      );

    case "twitter":
      return data.twitterCard === "summary" ? (
        <div className="flex max-w-[500px] overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900">
          <Img src={image} alt="" className="size-[130px] shrink-0" />
          <div className="min-w-0 flex-1 px-3 py-2">
            <div className="text-[13px] text-zinc-500">{host}</div>
            <div className="mt-0.5 line-clamp-2 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
            <div className="mt-0.5 line-clamp-2 text-[14px] text-zinc-500">{description}</div>
          </div>
        </div>
      ) : (
        <div className="max-w-[500px] overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900">
          <div className="relative">
            <Img src={image} alt="" className="aspect-[1.91/1] w-full" />
            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[12px] text-white line-clamp-1 max-w-[90%]">
              {title}
            </span>
          </div>
          <div className="px-3 py-1.5 text-[13px] text-zinc-500">{host}</div>
        </div>
      );

    case "telegram":
      return (
        <div className="max-w-[340px] rounded-lg rounded-tl-none bg-white p-2 shadow-sm dark:bg-zinc-800">
          <div className="border-l-4 border-[#3390ec] pl-2">
            <div className="text-[13px] font-semibold text-[#3390ec]">{siteName}</div>
            <div className="line-clamp-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{title}</div>
            <div className="line-clamp-2 text-[12px] text-zinc-500">{description}</div>
            <Img src={image} alt="" className="mt-1.5 h-36 w-full rounded-md" />
          </div>
        </div>
      );

    case "discord":
      return (
        <div className="max-w-[440px] rounded border-l-4 border-[#5865f2] bg-[#2b2d31] p-3">
          <div className="mb-1 flex items-center gap-2 text-[12px] text-zinc-400">
            <Favicon src={favicon} /> {siteName}
          </div>
          <div className="line-clamp-1 text-[15px] font-semibold text-[#00a8fc]">{title}</div>
          <div className="mt-0.5 line-clamp-3 text-[13px] text-zinc-300">{description}</div>
          <Img src={image} alt="" className="mt-2 h-44 w-full rounded" />
        </div>
      );

    case "instagram":
      return (
        <div className="max-w-[300px] overflow-hidden rounded-2xl rounded-tl-md border bg-white dark:bg-zinc-900">
          <Img src={image} alt="" className="aspect-square w-full" />
          <div className="px-3 py-2">
            <div className="line-clamp-2 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
            <div className="mt-0.5 line-clamp-1 text-[12px] text-zinc-500">{description}</div>
            <div className="mt-1 text-[11px] text-zinc-400">{host}</div>
          </div>
        </div>
      );

    case "gmail":
      return (
        <div className="max-w-[520px] rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {(siteName[0] || "N").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="line-clamp-1 text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{siteName}</div>
                <div className="text-[12px] text-zinc-400">now</div>
              </div>
              <div className="line-clamp-1 text-[13px] text-zinc-700 dark:text-zinc-200">{title}</div>
              <div className="line-clamp-1 text-[12px] text-zinc-500">{description}</div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
