import { useCallback } from "react";
import { parseLrc } from "../utils/lrcParser";
import { useLyricsStore } from "../store/lyricsStore";

export default function useImportedLyrics() {
  const loadLrc = useLyricsStore((s) => s.loadLrc);

  const importFile = useCallback(async (file /* File */) => {
    if (!file) return;
    
    console.log('📁 Importing file:', file.name);
    const text = await file.text();
    console.log('📄 File content preview:', text.slice(0, 200) + '...');
    
    // Check if file is LRC format (contains timestamp patterns)
    const hasTimestamps = /\[\d{1,2}:\d{1,2}(?:\.\d{1,3})?\]/.test(text);
    
    if (hasTimestamps) {
      console.log('🎵 Detected LRC format with timestamps');
      const parsed = parseLrc(text);
      console.log('🎵 Parsed LRC lyrics:', {
        meta: parsed.meta,
        cuesCount: parsed.cues.length,
        cuesPreview: parsed.cues.slice(0, 3)
      });
      
      loadLrc({ ...parsed, isImported: true });
      console.log('✅ LRC lyrics loaded to store');
    } else {
      console.log('📝 Detected plain text format, creating artificial timestamps');
      
      // Process as plain text with artificial timestamps
      const lines = text.split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      console.log('📄 Processing plain text lines:', {
        totalLines: lines.length,
        preview: lines.slice(0, 3)
      });

      // Create artificial LRC-style cues
      const artificialCues = lines.map((line, index) => ({
        id: index + 1,
        ms: index * 5000, // 5 seconds per line
        text: line
      }));

      const artificialLrcData = {
        meta: { title: file.name },
        cues: artificialCues,
        isImported: true
      };

      console.log('🎵 Created artificial LRC data:', {
        meta: artificialLrcData.meta,
        cuesCount: artificialLrcData.cues.length,
        cuesPreview: artificialLrcData.cues.slice(0, 3),
        sampleCue: artificialLrcData.cues[0]
      });

      loadLrc(artificialLrcData);
      console.log('✅ Plain text lyrics loaded to store with artificial timestamps');
    }
  }, [loadLrc]);

  return { importFile };
}
