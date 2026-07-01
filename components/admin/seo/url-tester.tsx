"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchUrlPreview } from "@/lib/actions/admin/seo";
import { PLATFORMS, PlatformPreview, type PlatformKey } from "./social-previews";
import type { PreviewData } from "@/lib/seo-preview";

/**
 * Bonus: enter any page URL/path on this site and preview its REAL share card
 * (its actual title / Open Graph / Twitter tags) across every platform.
 */
export function UrlTester({ siteUrl }: { siteUrl: string }) {
  const [path, setPath] = useState(siteUrl);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PreviewData | null>(null);
  const [platform, setPlatform] = useState<PlatformKey>("google");

  async function run() {
    if (!path.trim()) return;
    setLoading(true);
    const res = await fetchUrlPreview(path.trim());
    setLoading(false);
    if (res.ok) setData(res.data ?? null);
    else {
      toast.error(res.error);
      setData(null);
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">Preview URL Tester</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Fetch any page on your site and see exactly how it will look when shared.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={`${siteUrl}/products/…`}
        />
        <Button onClick={run} disabled={loading} className="shrink-0 gap-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Test
        </Button>
      </div>

      {data && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlatform(p.key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  platform === p.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-accent",
                )}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
          <div className="grid place-items-center rounded-lg bg-muted/40 p-4">
            <PlatformPreview platform={platform} data={data} />
          </div>
        </div>
      )}
    </div>
  );
}
