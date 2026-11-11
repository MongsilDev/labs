import { ImageResponse } from "next/og";
import { LABS_ACCENT } from "@/components/SiteMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#000" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d="M15 21l11 11-11 11" fill="none" stroke="#f5f5f7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M33 44h17" stroke={LABS_ACCENT} strokeWidth="7" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
