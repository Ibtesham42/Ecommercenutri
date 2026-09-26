import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

// Brand-default Open Graph image, served as a normal route (like brand-icon/
// brand-apple-icon) so `generateMetadata`'s `openGraph.images` stays
// authoritative and an admin-uploaded SEO/share image can override it. A file
// at the Next.js convention path `app/opengraph-image.tsx` would instead be
// auto-injected by Next's metadata resolution and silently win over any
// dynamic `openGraph.images` for every route under this segment — which is
// exactly what happened here (see CLAUDE.md invariant on favicon/OG images).
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #003e32 0%, #00835b 60%, #00a071 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#ffffff",
              color: "#00835b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{siteConfig.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>
            {siteConfig.tagline}
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.85)", maxWidth: 900 }}>
            India&apos;s AI-powered health &amp; nutrition marketplace.
          </div>
        </div>

        <div style={{ fontSize: 26, color: "rgba(255,255,255,0.8)" }}>
          {siteConfig.domain}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
