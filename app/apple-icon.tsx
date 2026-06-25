import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon: brand-green tile with a white "N". */
export default function AppleIcon() {
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
    size,
  );
}
