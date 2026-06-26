import { ImageResponse } from "next/og";

// Brand-default favicon (a green rounded square with a white "N"), served as a
// normal route so `metadata.icons` stays authoritative and an admin-uploaded
// favicon (StoreSetting.favicon) can override it. See app/layout.tsx.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16803c",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 800,
          borderRadius: 7,
        }}
      >
        N
      </div>
    ),
    { width: 32, height: 32 },
  );
}
