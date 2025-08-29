import { useRef, useEffect } from "react";
import KaraokeWord from "./KaraokeWord";

/* props -------------------------------------------------
   lines       : Array<{ id:number, words:Array<{ id:number, text:string }> }>
   activeWord  : { lineId:number, wordId:number }
--------------------------------------------------------*/
export default function LyricsDisplay({ lines, activeWord }) {
  const containerRef = useRef(null);

  /* auto-scroll the active line into centre */
  useEffect(() => {
    const node = containerRef.current?.querySelector(
      `[data-line='${activeWord.lineId}']`
    );
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeWord]);

  return (
    <div
      ref={containerRef}
      className="h-72 overflow-y-auto rounded-xl bg-[#1A1A1A]/60 p-6 backdrop-blur"
    >
      {lines.map((line) => (
        <div
          key={line.id}
          data-line={line.id}
          className="mb-4 text-center text-lg leading-relaxed"
        >
          {line.words.map((w) => (
            <KaraokeWord
              key={w.id}
              word={w.text}
              active={
                activeWord.lineId === line.id && activeWord.wordId === w.id
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
