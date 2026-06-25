import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** App favicon: a brand-green rounded square with a white "N". */
export default function Icon() {
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
    size,
  );
}
