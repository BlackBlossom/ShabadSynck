/* ──────────  src/pages/LivePage.jsx  ────────── */

import { useState, useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import { MicrophoneIcon} from "@heroicons/react/24/solid";

import ImportLyricsModal from "../components/Lyrics/ImportLyricsModal";
import LyricsDisplay      from "../components/Lyrics/LyricsDisplay";

import useImportedLyrics from "../hooks/useImportedLyrics";
import useSpeechStream   from "../hooks/useSpeechStream";
import { useLyricsStore } from "../store/lyricsStore";

/* animate three rings; amplitude injected via CSS var */
const ring = (i) => ({
  scale: [0.8, 2.6],
  opacity: [0.9, 0],
  transition: {
    duration: 1.2,
    ease: "easeOut",
    repeat: Infinity,
    delay: i * 0.4,
  },
});

export default function LivePage() {
  /* lyrics store */
  const cues       = useLyricsStore((s) => s.cues);
  const activeWord = useLyricsStore((s) => s.active);
  const setActive  = useLyricsStore((s) => s.setActive);

  /* hooks */
  const { importFile } = useImportedLyrics();
  const { start, stop, isStreaming, permission } = useSpeechStream(
    (json) => setActive(json.lineId, json.wordId)
  );

  /* UI state */
  const [modalOpen, setModalOpen] = useState(false);
  const ringCtrl = useAnimation();
  const analyserRef = useRef(null);      // for amplitude ↔️ CSS var

  /* start/stop wave anim */
  useEffect(() => {
    if (isStreaming) ringCtrl.start((i) => ring(i));
    else ringCtrl.stop();
  }, [isStreaming, ringCtrl]);

  /* amplitude  CSS variable for ring thickness */
  useEffect(() => {
    if (!isStreaming) return;
    const node = analyserRef.current;
    if (!node) return;

    const id = setInterval(() => {
      const amp = window.latestAmplitude || 0.1;  // set inside useSpeechStream
      node.style.setProperty("--amp", (amp * 8).toFixed(2) + "px");
    }, 60);

    return () => clearInterval(id);
  }, [isStreaming]);

  const toggleMic = () => (isStreaming ? stop() : start());

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-[#121212] pt-32 pb-24 text-white overflow-x-hidden">

      {/* ─── MIC WITH REACTIVE WAVES ─── */}
      <div className="relative mb-8" ref={analyserRef}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            custom={i}
            initial={{ opacity: 0 }}
            animate={ringCtrl}
            style={{ borderWidth: "var(--amp,2px)" }}
            className="absolute inset-0 rounded-full border border-[#1DB954]"
          />
        ))}

        <button
          aria-label={isStreaming ? "Mute microphone" : "Un-mute microphone"}
          onClick={toggleMic}
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-colors ${
            isStreaming ? "bg-[#1DB954]/90" : "bg-[#1A1A1A]"
          }`}
        >
          {isStreaming ? (
              <MicrophoneIcon className="h-12 w-12" />
          ) : (
              /* mic with a diagonal slash overlay ⬇ */
              <span className="relative">
                <MicrophoneIcon className="h-12 w-12" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="block h-[2px] w-14 -rotate-45 bg-current" />
                </span>
              </span>
          )}
        </button>
      </div>

      {/* ─── IMPORT & STATUS ─── */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-[#1DB954]/20 px-6 py-2 text-sm hover:bg-[#1DB954]/40 transition"
        >
          Import Lyrics
        </button>

        {permission === "denied" && (
          <p className="text-sm text-red-400">Microphone permission denied.</p>
        )}
      </div>

      {/* ─── LYRICS DISPLAY ─── */}
      <div className="mt-10 w-full max-w-[900px] px-4">
        <LyricsDisplay lines={cues} activeWord={activeWord} />
      </div>

      {/* ─── IMPORT MODAL ─── */}
      <ImportLyricsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onImport={importFile}
      />
    </div>
  );
}
