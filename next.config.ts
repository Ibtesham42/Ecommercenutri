import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  experimental: {
    // Keep server action bodies generous for image uploads (base64 data URIs).
    serverActions: { bodySizeLimit: "12mb" },
  },
  // @react-pdf/renderer (invoice PDFs) ships native deps (fontkit/yoga) that must
  // not be bundled by Next — load them as external server packages.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Serve the classic /favicon.ico path from the admin-uploaded favicon. Many
  // browsers/crawlers (and Google Search) hit /favicon.ico directly regardless
  // of the <link rel="icon"> tags; without this it 404s. `beforeFiles` runs the
  // rewrite ahead of filesystem resolution.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/favicon.ico", destination: "/api/favicon" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
