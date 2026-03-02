"use client";

interface WebcamSectionProps {
  webcamUrl: string | null | undefined;
  resortName: string;
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?/]+)/,
    /youtube\.com\/embed\/([^?/]+)/,
    /youtube\.com\/live\/([^?/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function WebcamSection({
  webcamUrl,
  resortName,
}: WebcamSectionProps) {
  if (!webcamUrl) return null;

  const youtubeId = extractYoutubeId(webcamUrl);

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
        Live Webcam
      </h3>

      {youtubeId ? (
        /* YouTube embed */
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&mute=1&rel=0`}
            title={`${resortName} live webcam`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full rounded-lg border border-border"
          />
        </div>
      ) : (
        /* External link fallback */
        <a
          href={webcamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-accent-blue/25 bg-accent-blue/5 px-4 py-3 text-sm font-medium text-accent-blue transition-all hover:border-accent-blue/50 hover:bg-accent-blue/10"
        >
          <svg
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <span>View Live Webcam ↗</span>
        </a>
      )}
    </div>
  );
}
