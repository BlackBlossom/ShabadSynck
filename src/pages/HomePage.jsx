/* ──────────  src/pages/HomePage.jsx  ──────────
   Dark hero with animated simplex-noise waves
   • WavyBackground fills the viewport (z-0)
   • Content sits in the same stacking context (z-10)
   • Brand palette: #121212 ▸ #1A1A1A ▸ #1DB954 ▸ #B3B3B3
   • Pure Tailwind utilities + Framer-Motion
*/

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { WavyBackground } from "../components/WavyBackground";

import Logo       from "../assets/logo.svg?react";
import MicIcon    from "@heroicons/react/24/outline/MicrophoneIcon?react";
import SyncIcon   from "@heroicons/react/24/outline/ArrowsRightLeftIcon?react";
import ExportIcon from "@heroicons/react/24/outline/ArrowDownTrayIcon?react";

/* stagger helper */
const fade = i => ({
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } },
});

/* ───── NAV ───── */
function Nav() {
  const [opaque, setOpaque] = useState(false);
  useEffect(() => {
    const onScroll = () => setOpaque(window.scrollY > 64);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 backdrop-blur-md transition-colors
                  ${opaque ? "bg-[#121212]/80" : "bg-transparent"}`}
    >
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-0 py-4">
        <h1 className="mt-2 flex text-3xl font-qurova items-center space-x-3">
            ShabadSynck
        </h1>
        <a
          href="/live"
          className="rounded-full bg-[#1DB954] px-5 py-2 text-sm font-semibold text-black/90
                     transition hover:brightness-110"
        >
          Go Live
        </a>
      </nav>
    </header>
  );
}

/* ───── CARD ───── */
function Card({ Icon, title, text, idx }) {
  return (
    <motion.div
      variants={fade(idx)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      whileHover={{ rotateX: -5, rotateY: 5 }}
      className="group rounded-xl bg-[#1A1A1A]/70 border border-white/10 p-8 backdrop-blur
                 shadow-[0_6px_18px_rgba(0,0,0,.45)] transition
                 hover:shadow-[0_8px_28px_rgba(0,0,0,.6)]"
    >
      <Icon className="h-10 w-10 text-[#1DB954]" />
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[#B3B3B3]">{text}</p>
    </motion.div>
  );
}

/* ───── PAGE ───── */
export default function HomePage() {
  return (
    <div className="relative min-h-screen font-caldina bg-[#121212] text-white">
      {/*  full-viewport animated waves  */}
      <WavyBackground
        colors={[
            "#0c2914",   // nearly-black green (base tone)
            "#1DB954",   // brand emerald
            "#009B9B",   // rich teal highlight
            "#7045FF"    // royal purple accent
        ]}
        waveWidth={64}
        backgroundFill="#121212"
        blur={10}
        speed="fast"
        waveOpacity={0.28}          // darker band, text pops
        containerClassName="fixed inset-0 overflow-hidden"
      />

      <Nav />

      
      {/* faint centre-light → edge-dark vignette */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(18,18,18,0.85)_70%)]" />

      {/* HERO */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-32 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl text-4xl font-extrabold leading-tight sm:text-6xl"
        >
          Effortless <span className="text-[#1DB954]">Kirtan</span> Transcription
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-6 max-w-xl text-lg text-[#B3B3B3]"
        >
          Stream live Punjabi kirtan to Google Cloud Speech-to-Text and enjoy
          perfectly synced karaoke lyrics in real time.
        </motion.p>

        <motion.a
          whileHover={{ y: -4 }}
          href="/live"
          className="mt-10 inline-block rounded-full bg-[#1DB954] px-10 py-3 font-semibold
                     text-black/90 transition-transform"
        >
          Try the Demo
        </motion.a>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 py-24">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-6 sm:grid-cols-3">
          {[
            { Icon: MicIcon,   title: "Live Capture",  text: "<500 ms mic-to-lyrics latency." },
            { Icon: SyncIcon,  title: "Import & Sync", text: "Drop an .lrc/.txt to align lyrics instantly." },
            { Icon: ExportIcon,title: "Instant Export",text: "Download a clean transcript with one click." },
          ].map((f, i) => <Card key={f.title} idx={i} {...f} />)}
        </div>
      </section>
    </div>
  );
}
