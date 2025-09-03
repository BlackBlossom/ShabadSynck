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

// Helper function for enhanced word matching at a specific position
const matchWordsAtPosition = (cueIndex, wordIndex, spokenLower, cues) => {
  let matchLength = 0;
  let currentCueIndex = cueIndex;
  let currentWordIndex = wordIndex;
  let exactMatches = 0;
  let totalWords = 0;
  
  for (let spokenIndex = 0; spokenIndex < spokenLower.length; spokenIndex++) {
    if (currentCueIndex >= cues.length) break;
    
    const currentCue = cues[currentCueIndex];
    if (currentWordIndex >= currentCue.words.length) {
      currentCueIndex++;
      currentWordIndex = 0;
      if (currentCueIndex >= cues.length) break;
      continue;
    }
    
    const lyricsWord = currentCue.words[currentWordIndex].text
      .toLowerCase()
      .replace(/[^\w\u0900-\u097F\u0A00-\u0A7F]/g, ''); // Keep Hindi/Punjabi characters
    const spokenWord = spokenLower[spokenIndex];
    
    totalWords++;
    
    // Enhanced matching for Punjabi/Hindi/English
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
        // Check similarity for words that might be misheard (more lenient for multilingual content)
        const similarity = calculateSimilarity(lyricsWord, spokenWord);
        if (similarity > 0.7) { // Slightly more lenient for Punjabi/Hindi
          isMatch = true;
        }
      }
    }
    
    if (isMatch) {
      matchLength++;
      currentWordIndex++;
    } else {
      // For karaoke, be more forgiving - allow skipping short words or particles
      if (lyricsWord.length <= 2 || spokenWord.length <= 2) {
        currentWordIndex++; // Skip short words that might be articles/prepositions
        continue;
      }
      break;
    }
  }
  
  // Calculate confidence score with bias towards exact matches and multilingual content
  const confidence = totalWords > 0 ? 
    (exactMatches / totalWords) * 0.7 + (matchLength / Math.max(spokenLower.length, totalWords)) * 0.3 : 0;
  
  // Highlight the word we're currently on (progressive highlighting)
  const targetCue = cues[cueIndex];
  const progressIndex = Math.min(wordIndex + matchLength - 1, targetCue.words.length - 1);
  
  return {
    lineId: cueIndex,
    wordId: targetCue.words[progressIndex]?.id || targetCue.words[wordIndex]?.id,
    matchLength,
    confidence,
    exactMatches
  };
};

export const useLyricsStore = create(
  persist(
    (set, get) => ({
      cues: [],                     // parsed LRC cues with words array
      meta: {},                     // { ar, ti, by … }
      active: { lineId: null, wordId: null },
      importedLyrics: null,         // Store original imported lyrics for word matching
      hasImportedLyrics: false,     // Track if lyrics are loaded
      transcriptHistory: [],        // Track previous final transcripts for context
      lastMatchPosition: { lineId: null, wordId: null, timestamp: null },

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

      // Add transcript to history for context (only final transcripts)
      addToTranscriptHistory: (finalTranscript) => {
        const state = get();
        const newHistory = [...state.transcriptHistory, {
          text: finalTranscript,
          timestamp: Date.now(),
          words: finalTranscript.split(/\s+/).filter(word => word.length > 0)
        }];
        
        // Keep only last 10 entries to avoid memory issues
        if (newHistory.length > 10) {
          newHistory.shift();
        }
        
        set({ transcriptHistory: newHistory });
        console.log('📝 Added to transcript history:', finalTranscript);
      },

      // Enhanced method to find and highlight words based on speech transcription
      highlightMatchingWords: (spokenWords, isFinalTranscript = false) => {
        const state = get();
        if (!state.hasImportedLyrics || !state.cues.length || !spokenWords.length) return null;

        // Convert spoken words to lowercase for matching, preserving original language characters
        const spokenLower = spokenWords.map(word => 
          word.toLowerCase()
            .replace(/[^\w\u0900-\u097F\u0A00-\u0A7F]/g, '') // Keep Hindi/Punjabi characters
        ).filter(word => word.length > 0);
        
        // For context, also consider recent transcript history
        let contextWords = [];
        if (state.transcriptHistory.length > 0) {
          // Get words from last 2-3 final transcripts for better context matching
          const recentHistory = state.transcriptHistory.slice(-3);
          contextWords = recentHistory.flatMap(entry => entry.words.map(w => 
            w.toLowerCase().replace(/[^\w\u0900-\u097F\u0A00-\u0A7F]/g, '')
          ));
        }
        
        // Start from current active position for better karaoke continuity
        let startCueIndex = 0;
        let startWordIndex = 0;
        
        if (state.active.lineId !== null && state.active.wordId !== null) {
          // Find current position
          for (let i = 0; i < state.cues.length; i++) {
            const wordPos = state.cues[i].words.findIndex(w => w.id === state.active.wordId);
            if (wordPos !== -1) {
              startCueIndex = i;
              startWordIndex = Math.max(0, wordPos - 1); // Start just before current position
              break;
            }
          }
        }
        
        // Enhanced search strategy for repeated lines and context
        let bestMatch = { lineId: null, wordId: null, matchLength: 0, confidence: 0 };
        
        // First, try to find repeated lines using context
        if (contextWords.length > 0 && isFinalTranscript) {
          // Look for lines that contain similar patterns to recent history
          for (let cueIndex = 0; cueIndex < state.cues.length; cueIndex++) {
            const cue = state.cues[cueIndex];
            const cueWords = cue.words.map(w => w.text.toLowerCase().replace(/[^\w\u0900-\u097F\u0A00-\u0A7F]/g, ''));
            
            // Check if this line has overlap with recent context
            const contextOverlap = contextWords.filter(cw => cueWords.some(lw => 
              lw === cw || (lw.length > 2 && cw.length > 2 && calculateSimilarity(lw, cw) > 0.8)
            )).length;
            
            if (contextOverlap > 1) {
              // This might be a repeated section - try matching from here
              const matchResult = matchWordsAtPosition(cueIndex, 0, spokenLower, state.cues);
              if (matchResult.matchLength > bestMatch.matchLength) {
                bestMatch = matchResult;
              }
            }
          }
        }
        
        // If no good context match, use progressive search from current position
        if (bestMatch.matchLength === 0) {
          const searchRanges = [
            { start: startCueIndex, end: Math.min(startCueIndex + 5, state.cues.length) }, // Near current
            { start: Math.max(0, startCueIndex - 3), end: startCueIndex }, // Before current
            { start: 0, end: state.cues.length } // Full search if no good match nearby
          ];
          
          for (const range of searchRanges) {
            for (let cueIndex = range.start; cueIndex < range.end; cueIndex++) {
              const searchStart = cueIndex === startCueIndex ? startWordIndex : 0;
              const matchResult = matchWordsAtPosition(cueIndex, searchStart, spokenLower, state.cues);
              
              if (matchResult.matchLength > bestMatch.matchLength || 
                  (matchResult.matchLength === bestMatch.matchLength && matchResult.confidence > bestMatch.confidence)) {
                bestMatch = matchResult;
              }
            }
            
            // If we found a good match in the first range, don't search further
            if (bestMatch.matchLength > 0 && bestMatch.confidence > 0.5) break;
          }
        }
        
        // Set active word if we found a decent match
        if (bestMatch.matchLength > 0 && bestMatch.confidence > 0.3) {
          set({ 
            active: { lineId: bestMatch.lineId, wordId: bestMatch.wordId },
            lastMatchPosition: { 
              lineId: bestMatch.lineId, 
              wordId: bestMatch.wordId, 
              timestamp: Date.now() 
            }
          });
          
          console.log('🎯 Enhanced karaoke highlight:', {
            ...bestMatch,
            spokenWords: spokenWords.join(' '),
            usedContext: contextWords.length > 0,
            isFinal: isFinalTranscript
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
        hasImportedLyrics: false,
        transcriptHistory: [],
        lastMatchPosition: { lineId: null, wordId: null, timestamp: null }
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
            hasImportedLyrics: false,
            transcriptHistory: [],
            lastMatchPosition: { lineId: null, wordId: null, timestamp: null }
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
