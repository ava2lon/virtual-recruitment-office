import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "WorkBridge";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #2563eb 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.8, marginBottom: 24 }}>WorkBridge</div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 24, opacity: 0.7, marginTop: 24 }}>
          One platform. Zero friction. One connection.
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
