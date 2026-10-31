import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the favicon's gold H on navy, rendered as PNG (iOS ignores SVG icons). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1428" }}>
        <svg viewBox="0 0 64 64" width="136" height="136">
          <path d="M14 16 L19 11 L24 16 L24 53 L14 53 Z" fill="#e9b44c" />
          <path d="M40 16 L45 11 L50 16 L50 53 L40 53 Z" fill="#e9b44c" />
          <path d="M24 31 L32 28 L40 31 L40 38 L32 35 L24 38 Z" fill="#e9b44c" />
          <path d="M32 14 L34.5 19 L32 24 L29.5 19 Z" fill="#3cc8ff" />
        </svg>
      </div>
    ),
    size,
  );
}
