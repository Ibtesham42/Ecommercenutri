import { ImageResponse } from "next/og";

// Brand-default Apple touch icon (180×180), served as a normal route so
// `metadata.icons` can override it with an admin-uploaded favicon.
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
          fontSize: 120,
          fontWeight: 800,
        }}
      >
        N
      </div>
    ),
    { width: 180, height: 180 },
  );
}
