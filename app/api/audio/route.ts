export const runtime = "nodejs";
export const maxDuration = 15;

const YT_URL = "https://www.youtube.com/watch?v=FP5Q27zGYsE";
const VIDEO_ID = "FP5Q27zGYsE";

const PIPED = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.projectsegfau.lt",
  "https://piped-api.garudalinux.org",
];

type AudioStream = { url: string; mimeType: string; bitrate: number };

// cobalt.tools — purpose-built audio/video extraction service
async function tryCobalt(): Promise<string | null> {
  // Try v10 API format first
  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ url: YT_URL, downloadMode: "audio", audioFormat: "mp3" }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as { status?: string; url?: string };
      if (data.url && (data.status === "tunnel" || data.status === "redirect" || data.status === "stream")) {
        return data.url;
      }
    }
  } catch {}

  // Try v7 API format fallback
  try {
    const res = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ url: YT_URL, isAudioOnly: true, aFormat: "mp3" }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as { status?: string; url?: string };
      if (data.url && data.status !== "error") return data.url;
    }
  } catch {}

  return null;
}

// Piped — open-source YouTube frontend that proxies streams
async function tryPiped(): Promise<string | null> {
  for (const base of PIPED) {
    try {
      const res = await fetch(`${base}/streams/${VIDEO_ID}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { audioStreams?: AudioStream[] };
      const best = (data.audioStreams ?? [])
        .filter(s => s.mimeType?.startsWith("audio/"))
        .sort((a, b) => b.bitrate - a.bitrate)[0];
      if (best?.url) return best.url;
    } catch {}
  }
  return null;
}

export async function GET() {
  const url = (await tryCobalt()) ?? (await tryPiped());
  if (url) return Response.json({ url });
  return Response.json({ error: "unavailable" }, { status: 503 });
}
