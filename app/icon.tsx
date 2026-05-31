import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          backgroundColor: "#a89890",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
        }}
      >
        <span
          style={{
            color: "#f5f0eb",
            fontSize: 26,
            fontStyle: "italic",
            fontFamily: "serif",
            letterSpacing: "-1px",
          }}
        >
          LL
        </span>
      </div>
    ),
    { ...size }
  );
}
