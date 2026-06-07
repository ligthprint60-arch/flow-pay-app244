import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

/** Compact custom audio player with waveform-like bars and smooth Framer Motion controls. */
export function AudioPlayer({ src, title = "Profile track" }: { src: string; title?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };

  const pct = dur > 0 ? (cur / dur) * 100 : 0;
  const bars = 28;

  return (
    <div className="lrf relative overflow-hidden !rounded-3xl p-3">
      <div className="absolute inset-0 bg-gradient-to-br from-eco/15 via-transparent to-fiat/15 opacity-70" />
      <div className="relative z-10 flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggle}
          className="mercury grid size-11 shrink-0 place-items-center rounded-full emissive-eco"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
        </motion.button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold tracking-wide">{title}</p>
          <div className="mt-1.5 flex h-7 items-end gap-[2px]">
            {Array.from({ length: bars }).map((_, i) => {
              const active = (i / bars) * 100 <= pct;
              const h = 20 + ((i * 53) % 14) + (playing ? Math.sin((Date.now() / 220) + i) * 3 : 0);
              return (
                <motion.span
                  key={i}
                  animate={{ height: h, opacity: active ? 1 : 0.35 }}
                  transition={{ type: "spring", stiffness: 240, damping: 20 }}
                  className={`w-[3px] rounded-full ${active ? "bg-eco" : "bg-white/30"}`}
                  style={{ height: h }}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>{fmtTime(cur)}</span>
            <span>{fmtTime(dur)}</span>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { const a = ref.current; if (!a) return; a.muted = !a.muted; setMuted(a.muted); }}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06]"
          aria-label="Mute"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </motion.button>
      </div>

      <audio ref={ref} src={src} preload="metadata" />
    </div>
  );
}

function fmtTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
