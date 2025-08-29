import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useLyricsStore = create(
  persist(
    (set, get) => ({
      cues: [],                     // parsed LRC cues with words array
      meta: {},                     // { ar, ti, by … }
      active: { lineId: null, wordId: null },
      importedLyrics: null,         // Store original imported lyrics for word matching
      hasImportedLyrics: false,     // Track if lyrics are loaded

      loadLrc: ({ meta, cues, isImported = false }) => {
        console.log('🏪 Store loadLrc called with:', {
          meta,
          originalCuesCount: cues?.length || 0,
          originalCuesPreview: cues?.slice(0, 2) || [],
          sampleCue: cues?.[0] || null,
          isImported
        });
        
        // Convert LRC cues to word-level cues for karaoke display
        const processedCues = cues.map((cue, lineIndex) => {
          // Handle cues that already have words (from live transcription) or need to be split from text (from LRC files)
          let words;
          let originalText;
          
          if (cue.words && Array.isArray(cue.words)) {
            // Already processed words from live transcription
            words = cue.words.map((word, wordIndex) => ({
              id: word.id || (lineIndex * 100 + wordIndex), // Use existing ID or generate
              text: typeof word === 'string' ? word : word.text || '',
              originalText: typeof word === 'string' ? word : word.originalText || word.text || ''
            }));
            originalText = cue.originalText || words.map(w => w.originalText).join(' ');
          } else if (cue.text) {
            // Text that needs to be split into words (from LRC files)
            words = cue.text.split(/\s+/).filter(word => word.length > 0).map((word, wordIndex) => ({
              id: lineIndex * 100 + wordIndex, // Unique word ID
              text: word.replace(/[^\w\s\u0900-\u097F\u0A00-\u0A7F]/g, ''), // Clean punctuation but keep Hindi/Punjabi
              originalText: word // Keep original with punctuation
            }));
            originalText = cue.text;
          } else {
            // Fallback for malformed cues
            console.warn('Cue has no text or words:', cue);
            words = [];
            originalText = '';
          }
          
          return {
            id: lineIndex,
            ms: cue.ms,
            words: words,
            originalText: originalText
          };
        });

        // Store all words for speech matching
        const allWords = processedCues.flatMap(cue => 
          cue.words.map(word => word.text.toLowerCase())
        );

        console.log('🔄 Processed cues:', {
          processedCuesCount: processedCues.length,
          allWordsCount: allWords.length,
          processedCuesPreview: processedCues.slice(0, 2)
        });

        set({ 
          meta, 
          cues: processedCues,
          importedLyrics: isImported ? allWords : null,
          hasImportedLyrics: isImported  // Only set this flag for actual imported lyrics
        });
        
        console.log('✅ Store updated with processed lyrics');
      },

      // Method to find and highlight words based on speech transcription
      highlightMatchingWords: (spokenWords) => {
        const state = get();
        if (!state.importedLyrics || !spokenWords.length) return;

        // Convert spoken words to lowercase for matching
        const spokenLower = spokenWords.map(word => word.toLowerCase());
        
        // Find the best matching sequence in imported lyrics
        let bestMatch = { lineId: null, wordId: null, matchLength: 0 };
        
        for (let cueIndex = 0; cueIndex < state.cues.length; cueIndex++) {
          const cue = state.cues[cueIndex];
          
          for (let wordIndex = 0; wordIndex < cue.words.length; wordIndex++) {
            // Try to match from this position
            let matchLength = 0;
            let currentCueIndex = cueIndex;
            let currentWordIndex = wordIndex;
            
            for (let spokenIndex = 0; spokenIndex < spokenLower.length; spokenIndex++) {
              if (currentCueIndex >= state.cues.length) break;
              
              const currentCue = state.cues[currentCueIndex];
              if (currentWordIndex >= currentCue.words.length) {
                currentCueIndex++;
                currentWordIndex = 0;
                continue;
              }
              
              const lyricsWord = currentCue.words[currentWordIndex].text.toLowerCase();
              const spokenWord = spokenLower[spokenIndex];
              
              // Check for exact match or fuzzy match
              if (lyricsWord === spokenWord || 
                  lyricsWord.includes(spokenWord) || 
                  spokenWord.includes(lyricsWord)) {
                matchLength++;
                currentWordIndex++;
              } else {
                break;
              }
            }
            
            if (matchLength > bestMatch.matchLength) {
              bestMatch = {
                lineId: cueIndex,
                wordId: cue.words[wordIndex]?.id || null,
                matchLength
              };
            }
          }
        }
        
        // Set active word if we found a good match
        if (bestMatch.matchLength > 0) {
          set({ active: { lineId: bestMatch.lineId, wordId: bestMatch.wordId } });
          return bestMatch;
        }
        
        return null;
      },

      clear: () => set({ 
        cues: [], 
        meta: {}, 
        active: { lineId: null, wordId: null },
        importedLyrics: null,
        hasImportedLyrics: false
      }),

      setActive: (lineId, wordId) =>
        set({ active: { lineId, wordId } }),

      shiftAll: (deltaMs) =>
        set({
          cues: get().cues.map((c) => ({ ...c, ms: c.ms + deltaMs })),
        }),
    }),
    { name: "lyrics-store" }
  )
);
