import { useRef, useEffect } from "react";
import KaraokeWord from "./KaraokeWord";

/* props -------------------------------------------------
   lines       : Array<{ id:number, words:Array<{ id:number, text:string }> }>
   activeWord  : { lineId:number, wordId:number }
--------------------------------------------------------*/
export default function LyricsDisplay({ lines, activeWord }) {
  const containerRef = useRef(null);

  /* auto-scroll the active line into view */
  useEffect(() => {
    if (activeWord.lineId !== null) {
      const node = containerRef.current?.querySelector(
        `[data-line='${activeWord.lineId}']`
      );
      if (node) {
        node.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [activeWord.lineId]);

  /* scroll to bottom when new lines are added */
  useEffect(() => {
    if (lines.length > 0) {
      const container = containerRef.current;
      if (container) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 100);
      }
    }
  }, [lines.length]);

  if (lines.length === 0) {
    return (
      <div className="h-72 rounded-xl bg-[#1A1A1A]/60 p-6 backdrop-blur flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-4">🎤</div>
          <p className="text-lg mb-2">Ready to transcribe</p>
          <p className="text-sm opacity-70">Start speaking to see lyrics appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-72 overflow-y-auto rounded-xl bg-[#1A1A1A]/60 p-6 backdrop-blur scroll-smooth"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#1DB954 transparent'
      }}
    >
      {lines.map((line, index) => {
        const isActiveLine = activeWord.lineId === line.id;
        const isRecentLine = index >= lines.length - 3; // Highlight recent lines
        
        return (
          <div
            key={line.id}
            data-line={line.id}
            className={`mb-4 text-center text-lg leading-relaxed transition-all duration-300 ${
              isActiveLine 
                ? 'transform scale-105' 
                : isRecentLine 
                ? 'opacity-90' 
                : 'opacity-60'
            }`}
          >
            {line.words.map((w) => (
              <KaraokeWord
                key={w.id}
                word={w.text}
                active={
                  activeWord.lineId === line.id && activeWord.wordId === w.id
                }
                lag={isActiveLine ? 50 : 100} // Faster animation for active line
              />
            ))}
          </div>
        );
      })}
      
      {/* Add some bottom padding for better scrolling */}
      <div className="h-8"></div>
    </div>
  );
}
