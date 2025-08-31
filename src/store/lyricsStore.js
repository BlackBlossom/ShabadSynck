import { create } from "zustand";
import { persist } from "zustand/middleware";

// Helper function to calculate string similarity (Levenshtein distance based)
const calculateSimilarity = (str1, str2) => {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
};

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

        const currentState = get();
        
        // Determine what to do with imported lyrics based on context
        let newImportedLyrics, newHasImportedLyrics;
        
        if (isImported) {
          // This is imported content - set the imported lyrics
          newImportedLyrics = allWords;
          newHasImportedLyrics = true;
        } else {
          // This is live transcription - preserve existing imported lyrics
          newImportedLyrics = currentState.importedLyrics;
          newHasImportedLyrics = currentState.hasImportedLyrics;
        }

        set({ 
          meta, 
          cues: processedCues,
          importedLyrics: newImportedLyrics,
          hasImportedLyrics: newHasImportedLyrics
        });
        
        console.log('✅ Store updated with processed lyrics');
      },

      // Method to find and highlight words based on speech transcription
      highlightMatchingWords: (spokenWords) => {
        const state = get();
        if (!state.hasImportedLyrics || !state.cues.length || !spokenWords.length) return null;

        // Convert spoken words to lowercase for matching
        const spokenLower = spokenWords.map(word => word.toLowerCase().replace(/[^\w]/g, ''));
        
        // Start from current active position for better karaoke continuity
        let startCueIndex = 0;
        let startWordIndex = 0;
        
        if (state.active.lineId !== null && state.active.wordId !== null) {
          // Find current position
          for (let i = 0; i < state.cues.length; i++) {
            const wordPos = state.cues[i].words.findIndex(w => w.id === state.active.wordId);
            if (wordPos !== -1) {
              startCueIndex = i;
              startWordIndex = Math.max(0, wordPos - 2); // Start a bit before current position
              break;
            }
          }
        }
        
        // Find the best matching position in the lyrics
        let bestMatch = { lineId: null, wordId: null, matchLength: 0, confidence: 0 };
        
        // Search in a range around current position first (for karaoke continuity)
        const searchRanges = [
          { start: startCueIndex, end: Math.min(startCueIndex + 3, state.cues.length) }, // Near current
          { start: 0, end: state.cues.length } // Full search if no good match nearby
        ];
        
        for (const range of searchRanges) {
          for (let cueIndex = range.start; cueIndex < range.end; cueIndex++) {
            const cue = state.cues[cueIndex];
            
            const searchStart = cueIndex === startCueIndex ? startWordIndex : 0;
            for (let wordIndex = searchStart; wordIndex < cue.words.length; wordIndex++) {
              // Try to match spoken words starting from this position in lyrics
              let matchLength = 0;
              let currentCueIndex = cueIndex;
              let currentWordIndex = wordIndex;
              let exactMatches = 0;
              let totalWords = 0;
              
              for (let spokenIndex = 0; spokenIndex < spokenLower.length; spokenIndex++) {
                if (currentCueIndex >= state.cues.length) break;
                
                const currentCue = state.cues[currentCueIndex];
                if (currentWordIndex >= currentCue.words.length) {
                  currentCueIndex++;
                  currentWordIndex = 0;
                  if (currentCueIndex >= state.cues.length) break;
                  continue;
                }
                
                const lyricsWord = currentCue.words[currentWordIndex].text.toLowerCase().replace(/[^\w]/g, '');
                const spokenWord = spokenLower[spokenIndex];
                
                totalWords++;
                
                // Check for matches with different levels of confidence
                let isMatch = false;
                if (lyricsWord === spokenWord) {
                  // Exact match - highest confidence
                  isMatch = true;
                  exactMatches++;
                } else if (lyricsWord.length > 2 && spokenWord.length > 2) {
                  // Fuzzy match for longer words
                  if (lyricsWord.includes(spokenWord) || spokenWord.includes(lyricsWord)) {
                    isMatch = true;
                  } else {
                    // Check similarity for words that might be misheard
                    const similarity = calculateSimilarity(lyricsWord, spokenWord);
                    if (similarity > 0.75) {
                      isMatch = true;
                    }
                  }
                }
                
                if (isMatch) {
                  matchLength++;
                  currentWordIndex++;
                } else {
                  // For karaoke, be more forgiving - allow skipping short words
                  if (lyricsWord.length <= 2 || spokenWord.length <= 2) {
                    currentWordIndex++; // Skip short words that might be articles/prepositions
                    continue;
                  }
                  break;
                }
              }
              
              // Calculate confidence score with bias towards exact matches
              const confidence = totalWords > 0 ? 
                (exactMatches / totalWords) * 0.8 + (matchLength / Math.max(spokenLower.length, totalWords)) * 0.2 : 0;
              
              if (matchLength > bestMatch.matchLength || 
                  (matchLength === bestMatch.matchLength && confidence > bestMatch.confidence)) {
                
                // Highlight the word we're currently on (progressive highlighting)
                const progressIndex = Math.min(wordIndex + matchLength - 1, cue.words.length - 1);
                
                bestMatch = {
                  lineId: cueIndex,
                  wordId: cue.words[progressIndex]?.id || cue.words[wordIndex]?.id,
                  matchLength,
                  confidence,
                  exactMatches
                };
              }
            }
          }
          
          // If we found a good match in the first range, don't search the full range
          if (bestMatch.matchLength > 0 && bestMatch.confidence > 0.4) break;
        }
        
        // Set active word if we found a decent match
        if (bestMatch.matchLength > 0 && bestMatch.confidence > 0.2) {
          set({ active: { lineId: bestMatch.lineId, wordId: bestMatch.wordId } });
          console.log('🎯 Karaoke highlight:', {
            ...bestMatch,
            spokenWords: spokenWords.join(' ')
          });
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

      // Clear only live transcription data while keeping imported lyrics
      clearLiveData: () => {
        const state = get();
        if (state.hasImportedLyrics && state.importedLyrics) {
          // Keep imported lyrics, just reset active word
          set({ active: { lineId: null, wordId: null } });
        } else {
          // No imported lyrics, clear everything
          set({ 
            cues: [], 
            meta: {}, 
            active: { lineId: null, wordId: null },
            importedLyrics: null,
            hasImportedLyrics: false
          });
        }
      },

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
