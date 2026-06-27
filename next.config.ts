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
};

export default nextConfig;
