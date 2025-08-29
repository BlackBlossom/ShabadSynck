import { motion } from "framer-motion";

/* props -------------------------------------------------
   word   : string  — the text itself
   active : bool    — true when the word is currently sung
   lag    : number  — ms until word is active (for subtle pre-fade)
--------------------------------------------------------*/
export default function KaraokeWord({ word, active, lag = 80 }) {
  return (
    <motion.span
      initial={false}
      animate={{
        color: active ? "#1DB954" : "#B3B3B3",
        scale: active ? 1.05 : 1,
        textShadow: active ? "0 0 8px rgba(29, 185, 84, 0.5)" : "none",
        transition: { duration: 0.3, delay: active ? 0 : lag / 1000 },
      }}
      className="inline-block px-1 py-0.5 mx-0.5 font-medium"
      style={{
        filter: active ? "brightness(1.2)" : "brightness(1)"
      }}
    >
      {word}
    </motion.span>
  );
}
