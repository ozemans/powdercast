import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07111F",
          borderRadius: 8,
        }}
      >
        <svg width="22" height="19" viewBox="0 0 28 24" fill="none">
          <path
            d="M1 22L9 5L14 13L18 7L27 22H1Z"
            fill="#22D3EE"
            fillOpacity="0.2"
          />
          <path
            d="M1 22L9 5L14 13L18 7L27 22"
            stroke="#22D3EE"
            strokeWidth="2.5"
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
