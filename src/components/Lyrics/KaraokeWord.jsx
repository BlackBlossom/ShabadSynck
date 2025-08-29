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
        scale: active ? 1.1 : 1,
        transition: { duration: 0.2, delay: active ? 0 : lag / 1000 },
      }}
      className="inline-block px-1"
    >
      {word}
    </motion.span>
  );
}
