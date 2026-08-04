import { useState, useCallback } from "react";
import { cn } from "@/utils/cn";

// ── Types ──────────────────────────────────────────────────────────────────
interface VideoInfo {
  videoId: string;
  title: string;
  thumbnail: string;
  author: string;
  duration?: string;
}

interface DownloadLink {
  quality: string;
  url: string;
  label: string;
  kbps: number;
}

type AppState = "idle" | "loading-info" | "ready" | "loading-download" | "error";
type DownloadPhase = "idle" | "fetching-link" | "downloading" | "done" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.trim().match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchVideoInfo(videoId: string): Promise<VideoInfo> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oEmbedUrl);
  if (!res.ok) throw new Error("Video not found or is unavailable.");
  const data = await res.json();
  return {
    videoId,
    title: data.title,
    author: data.author_name,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

// We use cobalt.tools public API (no auth required for reasonable usage)
// This returns a direct download stream link
async function fetchDownloadLink(videoId: string, kbps: number): Promise<string> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const payload = {
    url: videoUrl,
    audioFormat: "mp3",
    audioBitrate: kbps,
  };

  const res = await fetch("https://api.cobalt.tools/", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Download service responded with ${res.status}`);
  }

  const data = await res.json();
  console.log("Cobalt response:, data);

  // cobalt returns { status: "tunnel"|"redirect"|"picker"|"error", url, ... }
  if (data.status !== "success" || !data.url) {
    throw new Error(data.error?.code || "Could not generate download link.");
  }

  return data.url;
}

// Fetch the remote file as a blob and force-save it to disk.
// Using blob object URLs bypasses cross-origin restrictions on the
// `download` attribute so the browser always saves rather than navigates.
async function downloadAsBlob(
  url: string,
  filename: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);

  const contentLength = res.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = res.body?.getReader();
  if (!reader) throw new Error("ReadableStream not supported in this browser.");

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    received += value.length;
    if (total > 0) onProgress(Math.round((received / total) * 100));
  }
onProgress(100);
  
  const blob = new Blob(chunks, { type: "audio/mpeg" });
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke shortly after so the blob is freed from memory
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

// ── Quality Options ────────────────────────────────────────────────────────
const QUALITY_OPTIONS: DownloadLink[] = [
  { quality: "128", kbps: 128, label: "128 kbps", url: "" },
  { quality: "192", kbps: 192, label: "192 kbps", url: "" },
  { quality: "320", kbps: 320, label: "320 kbps", url: "" },
];

// ── Sub-components ─────────────────────────────────────────────────────────
function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      style={{ width: size, height: size }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 fill-red-500" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function DownloadIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export function App() {
  const [inputUrl, setInputUrl] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadingKbps, setDownloadingKbps] = useState<number | null>(null);
  // per-quality download phase tracking
  const [dlPhase, setDlPhase] = useState<Record<number, DownloadPhase>>({});
  const [dlProgress, setDlProgress] = useState<Record<number, number>>({});
  const [downloadLinks, setDownloadLinks] = useState<Record<number, string>>({});
  const [thumbnailError, setThumbnailError] = useState(false);

  const handleFetchInfo = useCallback(async () => {
    const id = extractVideoId(inputUrl);
    if (!id) {
      setErrorMsg("Please enter a valid YouTube URL or video ID.");
      setAppState("error");
      return;
    }

    setAppState("loading-info");
    setVideoInfo(null);
    setDownloadLinks({});
    setDlPhase({});
    setDlProgress({});
    setThumbnailError(false);
    setErrorMsg("");

    try {
      const info = await fetchVideoInfo(id);
      setVideoInfo(info);
      setAppState("ready");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch video info.";
      setErrorMsg(msg);
      setAppState("error");
    }
  }, [inputUrl]);

  const handleDownload = useCallback(
    async (kbps: number) => {
      if (!videoInfo) return;
      // Prevent double-clicks while already downloading this quality
      if (dlPhase[kbps] === "fetching-link" || dlPhase[kbps] === "downloading") return;

      const filename = `${videoInfo.title.replace(/[^a-z0-9]/gi, "_")}_${kbps}kbps.mp3`;

      const setPhase = (phase: DownloadPhase) =>
        setDlPhase((prev) => ({ ...prev, [kbps]: phase }));
      const setProgress = (pct: number) =>
        setDlProgress((prev) => ({ ...prev, [kbps]: pct }));

      try {
        // ── Step 1: get the stream URL from cobalt ──────────────────────
        setPhase("fetching-link");
        setDownloadingKbps(kbps);
        setProgress(0);

        let url = downloadLinks[kbps];
        if (!url) {
          url = await fetchDownloadLink(videoInfo.videoId, kbps);
          setDownloadLinks((prev) => ({ ...prev, [kbps]: url }));
        }

        // ── Step 2: stream the audio as a Blob and save to disk ─────────
        setPhase("downloading");
        setProgress(0);

        await downloadAsBlob(url, filename, (pct) => setProgress(pct));

        setPhase("done");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Download failed.";
        setPhase("error");
        // Clear the cached URL so it can be retried fresh
        setDownloadLinks((prev) => {
          const next = { ...prev };
          delete next[kbps];
          return next;
        });
        alert(
          `⚠️ ${msg}\n\nThe download service may be temporarily unavailable. Please try again in a moment.`
        );
      } finally {
        setDownloadingKbps(null);
      }
    },
    [videoInfo, downloadLinks, dlPhase]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleFetchInfo();
  };

  const handleReset = () => {
    setInputUrl("");
    setVideoInfo(null);
    setAppState("idle");
    setErrorMsg("");
    setDownloadLinks({});
    setDlPhase({});
    setDlProgress({});
    setDownloadingKbps(null);
    setThumbnailError(false);
  };

  const thumbnailSrc = videoInfo
    ? thumbnailError
      ? `https://img.youtube.com/vi/${videoInfo.videoId}/hqdefault.jpg`
      : videoInfo.thumbnail
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-white/5 bg-black/30 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <YouTubeIcon />
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none">YT Downloader</h1>
            <p className="text-xs text-gray-400 mt-0.5">Download YouTube audio as MP3</p>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pt-14 pb-20">
        <div className="w-full max-w-2xl space-y-8">

          {/* Hero Text */}
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-red-400 via-pink-400 to-red-500 bg-clip-text text-transparent">
              YouTube to MP3
            </h2>
            <p className="text-gray-400 text-sm">
              Paste a YouTube link, preview the video, and choose your audio quality.
            </p>
          </div>

          {/* ── URL Input ── */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-pink-600 rounded-2xl blur opacity-30 group-focus-within:opacity-70 transition duration-500" />
            <div className="relative flex items-center gap-2 bg-gray-900 border border-white/10 rounded-2xl px-4 py-3 shadow-xl">
              <svg className="h-5 w-5 text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste YouTube URL here… e.g. https://youtube.com/watch?v=..."
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500 min-w-0"
              />
              {inputUrl && (
                <button
                  onClick={handleReset}
                  className="text-gray-500 hover:text-white transition-colors p-1 rounded-full"
                  title="Clear"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleFetchInfo}
                disabled={appState === "loading-info" || !inputUrl.trim()}
                className={cn(
                  "shrink-0 flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                  "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400",
                  "disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-900/40"
                )}
              >
                {appState === "loading-info" ? (
                  <><Spinner size={16} /> Fetching…</>
                ) : (
                  "Search"
                )}
              </button>
            </div>
          </div>

          {/* ── Error ── */}
          {appState === "error" && (
            <div className="flex items-start gap-3 bg-red-950/50 border border-red-800/60 rounded-xl px-4 py-3 text-sm text-red-300">
              <svg className="h-5 w-5 mt-0.5 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorMsg}
            </div>
          )}

          {/* ── Loading Info Skeleton ── */}
          {appState === "loading-info" && (
            <div className="rounded-2xl bg-gray-900/70 border border-white/5 overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-800 w-full" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-700 rounded-lg w-3/4" />
                <div className="h-4 bg-gray-800 rounded-lg w-1/3" />
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 bg-gray-700 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Video Card ── */}
          {appState === "ready" && videoInfo && (
            <div className="rounded-2xl bg-gray-900/80 border border-white/8 overflow-hidden shadow-2xl shadow-black/40 backdrop-blur">

              {/* Thumbnail */}
              <div className="relative w-full aspect-video bg-black overflow-hidden">
                <img
                  src={thumbnailSrc}
                  alt={videoInfo.title}
                  onError={() => setThumbnailError(true)}
                  className="w-full h-full object-cover"
                />
                {/* YouTube play badge overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/50 rounded-full p-4 backdrop-blur-sm">
                    <svg className="h-10 w-10 fill-white" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {/* Gradient overlay at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-900/90 to-transparent" />
              </div>

              {/* Video Meta */}
              <div className="px-5 pt-4 pb-2 space-y-1">
                <h3 className="text-base font-bold leading-snug text-white line-clamp-2">
                  {videoInfo.title}
                </h3>
                <p className="text-sm text-gray-400 flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  {videoInfo.author}
                </p>
              </div>

              {/* Divider */}
              <div className="mx-5 my-3 border-t border-white/5" />

              {/* Quality selector */}
              <div className="px-5 pb-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <MusicIcon />
                  Choose Audio Quality (MP3)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {QUALITY_OPTIONS.map(({ kbps, label }) => {
                    const phase = dlPhase[kbps] ?? "idle";
                    const progress = dlProgress[kbps] ?? 0;
                    const isBusy = phase === "fetching-link" || phase === "downloading";
                    const isDone = phase === "done";
                    const isAnyBusy = downloadingKbps !== null;

                    return (
                      <button
                        key={kbps}
                        onClick={() => handleDownload(kbps)}
                        disabled={isAnyBusy && !isBusy}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-4 text-sm font-semibold transition-all duration-200 border overflow-hidden",
                          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500",
                          isBusy
                            ? "border-red-500/50 bg-red-950/40 text-red-300 cursor-wait"
                            : isDone
                            ? "border-green-500/60 bg-green-900/30 text-green-300 hover:bg-green-900/50 cursor-pointer"
                            : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20",
                          isAnyBusy && !isBusy && "opacity-40 cursor-not-allowed",
                          !isAnyBusy && "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                      >
                        {/* Progress bar fill — shown while downloading blob */}
                        {phase === "downloading" && (
                          <span
                            className="absolute inset-0 bg-red-600/20 origin-left transition-all duration-300"
                            style={{ transform: `scaleX(${progress / 100})` }}
                          />
                        )}

                        {phase === "fetching-link" ? (
                          <>
                            <Spinner size={18} />
                            <span className="text-[11px] leading-tight text-center">Getting link…</span>
                          </>
                        ) : phase === "downloading" ? (
                          <>
                            <Spinner size={18} />
                            <span className="text-[11px] leading-tight text-center">
                              {progress > 0 ? `${progress}%` : "Starting…"}
                            </span>
                          </>
                        ) : isDone ? (
                          <>
                            <svg className="h-5 w-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span className="text-[12px]">{label}</span>
                            <span className="text-[9px] text-green-400/70 font-normal">Saved ✓</span>
                          </>
                        ) : (
                          <>
                            <DownloadIcon size={20} />
                            <span>{label}</span>
                          </>
                        )}

                        {/* BEST badge */}
                        {kbps === 320 && !isBusy && (
                          <span className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
                            BEST
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {downloadingKbps !== null && (
                  <p className="text-xs text-center text-gray-500 animate-pulse">
                    {dlPhase[downloadingKbps] === "fetching-link"
                      ? "Reaching download service…"
                      : dlPhase[downloadingKbps] === "downloading"
                      ? `Downloading audio… ${dlProgress[downloadingKbps] ?? 0}%`
                      : "Processing…"}
                  </p>
                )}

                <p className="text-[11px] text-gray-600 text-center pt-1">
                  Your file will be saved as an .mp3 to your device after clicking a quality option.
                </p>
              </div>
            </div>
          )}

          {/* ── Idle Tips ── */}
          {appState === "idle" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: "🔗", title: "Paste URL", desc: "Copy any YouTube link and paste it in the search bar above." },
                { icon: "🎵", title: "Choose Quality", desc: "Select 128, 192, or 320 kbps audio quality for your download." },
                { icon: "💾", title: "Save File", desc: "Click the quality button and your MP3 will be saved instantly." },
              ].map((tip) => (
                <div
                  key={tip.title}
                  className="flex flex-col items-center text-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 px-4 py-5"
                >
                  <span className="text-2xl">{tip.icon}</span>
                  <h4 className="text-sm font-semibold text-white">{tip.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{tip.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-5 text-center text-xs text-gray-600">
        <p>YT Downloader — For personal use only. Respect copyright laws.</p>
      </footer>
    </div>
  );
}
