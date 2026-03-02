import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07111F",
          borderRadius: 40,
        }}
      >
        <svg width="120" height="103" viewBox="0 0 28 24" fill="none">
          <path
            d="M1 22L9 5L14 13L18 7L27 22H1Z"
            fill="#22D3EE"
            fillOpacity="0.2"
          />
          <path
            d="M1 22L9 5L14 13L18 7L27 22"
            stroke="#22D3EE"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M18 7V4M18 7L20.5 5M18 7L15.5 5"
            stroke="#22D3EE"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
