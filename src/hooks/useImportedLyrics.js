import { useCallback } from "react";
import { parseLrc } from "../utils/lrcParser";
import { useLyricsStore } from "../store/lyricsStore";

export default function useImportedLyrics() {
  const loadLrc = useLyricsStore((s) => s.loadLrc);

  const importFile = useCallback(async (file /* File */) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseLrc(text);
    loadLrc(parsed);
  }, [loadLrc]);

  return { importFile };
}
