/* ──────────  src/pages/LivePage.jsx  ────────── */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, useAnimation } from "framer-motion";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faMicrophoneSlash, faCog } from '@fortawesome/free-solid-svg-icons';

import ImportLyricsModal from "../components/Lyrics/ImportLyricsModal";
import LyricsDisplay      from "../components/Lyrics/LyricsDisplay";

import useImportedLyrics from "../hooks/useImportedLyrics";
import useSpeechStream   from "../hooks/useSpeechStream";
import { useLyricsStore } from "../store/lyricsStore";
import speechClientInstance from "../api/speechClient";

/* animate three rings; amplitude injected via CSS var */
const ring = (i) => ({
  scale: [0.8, 2.6],
  opacity: [0.9, 0],
  transition: {
    duration: 1.2,
    ease: "easeOut",
    repeat: Infinity,
    delay: i * 0.4,
  },
});

export default function LivePage() {
  /* lyrics store */
  const cues       = useLyricsStore((s) => s.cues);
  const activeWord = useLyricsStore((s) => s.active);
  const setActive  = useLyricsStore((s) => s.setActive);
  const loadLrc    = useLyricsStore((s) => s.loadLrc);
  const clearLyrics = useLyricsStore((s) => s.clear);
  const highlightMatchingWords = useLyricsStore((s) => s.highlightMatchingWords);
  const importedLyrics = useLyricsStore((s) => s.importedLyrics);
  const hasImportedLyrics = useLyricsStore((s) => s.hasImportedLyrics);
  const location = useLocation();

  // Debug: Log location changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Debug: Log store changes
  useEffect(() => {
    console.log('🔄 LivePage re-rendered - Store state:', {
      cuesCount: cues.length,
      activeWord,
      cuesPreview: cues.slice(0, 2),
      importedLyricsCount: importedLyrics ? importedLyrics.length : 0,
      hasImportedLyrics
    });
  }, [cues, activeWord, importedLyrics, hasImportedLyrics]);

  // Debug: Log cues changes
  useEffect(() => {
    console.log('🎵 Cues updated in component:', {
      length: cues.length,
      cues: cues.slice(0, 2) // Show first 2 cues
    });
  }, [cues]);

  /* UI state */
  const [modalOpen, setModalOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionError, setConnectionError] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [transcriptWords, setTranscriptWords] = useState([]);
  const ringCtrl = useAnimation();
  const analyserRef = useRef(null);      // for amplitude ↔️ CSS var
  
  // Add a state to accumulate all final transcripts
  const [allFinalTranscripts, setAllFinalTranscripts] = useState([]);
  
  // Add a counter to track processed final results
  const processedResultsCount = useRef(0);

  // Add a ref to track last processed count
  const lastProcessedCount = useRef(0);

  const languages = [
    { code: 'english', name: 'English', flag: '🇺🇸' },
    { code: 'hindi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'punjabi', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' }
  ];

  /* hooks */
  const { importFile } = useImportedLyrics();
  const { 
    start, 
    stop, 
    isStreaming, 
    permission, 
    status, 
    error, 
    checkPermission 
  } = useSpeechStream(
    (result) => {
      console.log('� LivePage received transcript result:', {
        transcript: result.transcript,
        isFinal: result.isFinal,
        confidence: result.confidence,
        timestamp: Date.now()
      });
      
      if (result.isFinal) {
        processedResultsCount.current += 1;
        console.log(`✅ Final transcript received (#${processedResultsCount.current}):`, result.transcript);
        
        // Clean the transcript text (remove quotes and trim)
        const cleanedTranscript = result.transcript.replace(/^["']|["']$/g, '').trim();
        console.log('🧹 Cleaned transcript:', cleanedTranscript);
        
        // Add final words to transcript
        const newWords = cleanedTranscript.split(/\s+/).filter(word => word.length > 0);
        console.log('📝 Extracted words from final result:', newWords);
        
        if (newWords.length === 0) {
          console.warn('⚠️ No words extracted from transcript, skipping update');
          return;
        }
        
        setTranscriptWords(prev => {
          const updated = [...prev, ...newWords];
          console.log('📋 Updated transcript words:', {
            previous: prev.length,
            new: newWords.length,
            total: updated.length,
            allWords: updated
          });
          
          // Check if we have imported lyrics
          if (importedLyrics && importedLyrics.length > 0) {
            console.log('🎵 Using imported lyrics - matching spoken words');
            const match = highlightMatchingWords(updated);
            if (match) {
              console.log('✅ Found word match in imported lyrics:', match);
            } else {
              console.log('⚠️ No match found in imported lyrics');
            }
          } else {
            // No imported lyrics - use live transcription mode
            console.log('🎵 No imported lyrics - using live transcription mode');
            updateLyricsFromTranscript(updated, updated.length - 1);
          }
          
          return updated;
        });
        
        setTranscript(prev => prev ? prev + ' ' + cleanedTranscript : cleanedTranscript);
        setInterimText('');
        console.log('✅ Final transcript processed:', cleanedTranscript);
      } else {
        console.log('📝 Interim transcript received:', result.transcript);
        // Show interim text
        setInterimText(result.transcript);
        
        // Handle interim words differently for imported vs live lyrics
        if (importedLyrics && importedLyrics.length > 0) {
          // For imported lyrics, try to match current words including interim
          const allWords = [...transcriptWords];
          const interimWords = result.transcript.trim().split(/\s+/).filter(word => word.length > 0);
          const allCurrentWords = [...allWords, ...interimWords];
          
          console.log('📝 Interim words for imported lyrics:', interimWords);
          const match = highlightMatchingWords(allCurrentWords);
          if (match) {
            console.log('🎯 Interim match found:', match);
          }
        } else {
          // For live transcription, highlight interim words as before
          const allWords = [...transcriptWords];
          const interimWords = result.transcript.trim().split(/\s+/).filter(word => word.length > 0);
          console.log('📝 Interim words for live transcription:', interimWords);
          console.log('🎵 Updating lyrics with interim preview:', [...allWords, ...interimWords]);
          updateLyricsFromTranscript([...allWords, ...interimWords], allWords.length);
        }
      }
    }
  );

  // Simple polling mechanism to check for new final results (moved after useSpeechStream)
  useEffect(() => {
    if (!isStreaming) return;
    
    console.log('🔄 Starting result polling...');
    
    const pollForResults = () => {
      const currentResultCount = speechClientInstance.finalResults ? speechClientInstance.finalResults.length : 0;
      
      if (currentResultCount > lastProcessedCount.current) {
        const newResults = speechClientInstance.finalResults.slice(lastProcessedCount.current);
        console.log('📥 Polling found new results:', newResults);
        
        newResults.forEach((result, index) => {
          console.log(`🎯 Processing polled result ${index + 1}:`, result);
          
          if (result && result.trim()) {
            // Clean the result
            const cleanedResult = result.replace(/^["']|["']$/g, '').trim();
            console.log('🧹 Cleaned result:', cleanedResult);
            
            if (cleanedResult) {
              setAllFinalTranscripts(prev => {
                const updated = [...prev, cleanedResult];
                console.log('📝 Updated transcripts via polling:', updated);
                
                // Extract all words
                const allWords = updated.join(' ').split(/\s+/).filter(word => word.length > 0);
                console.log('📋 All words via polling:', allWords);
                
                // Update states
                setTranscriptWords(allWords);
                if (allWords.length > 0) {
                  // Check if we have imported lyrics
                  if (importedLyrics && importedLyrics.length > 0) {
                    console.log('🎵 Polling: Using imported lyrics - matching spoken words');
                    const match = highlightMatchingWords(allWords);
                    if (match) {
                      console.log('✅ Polling: Found word match in imported lyrics:', match);
                    }
                  } else {
                    console.log('🎵 Polling: Using live transcription mode');
                    updateLyricsFromTranscript(allWords, allWords.length - 1);
                  }
                }
                
                return updated;
              });
            }
          }
        });
        
        lastProcessedCount.current = currentResultCount;
      }
    };
    
    const interval = setInterval(pollForResults, 200); // Poll every 200ms for responsiveness
    
    return () => {
      console.log('🔄 Stopping result polling...');
      clearInterval(interval);
    };
  }, [isStreaming]);

  /* Convert transcript words into lyrics format and update store */
  const updateLyricsFromTranscript = (words, highlightFromIndex = words.length - 1) => {
    console.log('🎵 updateLyricsFromTranscript called:', {
      totalWords: words.length,
      highlightFromIndex,
      wordsPreview: words.slice(-5), // Show last 5 words
      allWords: words
    });

    if (words.length === 0) {
      console.log('⚠️ No words to process, skipping lyrics update');
      return;
    }

    // Create lyrics lines (group words by lines, ~8-10 words per line)
    const wordsPerLine = 8;
    const lines = [];
    
    for (let i = 0; i < words.length; i += wordsPerLine) {
      const lineWords = words.slice(i, i + wordsPerLine).map((word, wordIndex) => ({
        id: i + wordIndex,
        text: word
      }));
      
      lines.push({
        id: Math.floor(i / wordsPerLine),
        words: lineWords,
        ms: Date.now() // timestamp for line
      });
    }

    console.log('📝 Generated lyrics lines:', {
      totalLines: lines.length,
      linesPreview: lines.map(line => ({
        id: line.id,
        wordCount: line.words.length,
        text: line.words.map(w => w.text).join(' ')
      }))
    });

    // Determine which word should be highlighted
    const activeLineIndex = Math.floor(highlightFromIndex / wordsPerLine);
    const activeWordIndexInLine = highlightFromIndex % wordsPerLine;
    
    console.log('🎯 Active word position:', {
      highlightFromIndex,
      activeLineIndex,
      activeWordIndexInLine,
      totalLines: lines.length
    });

    // Update lyrics store
    console.log('📋 Updating lyrics store with new data...');
    const lyricsData = {
      meta: { 
        ti: 'Live Transcription',
        ar: `Speech Recognition (${selectedLanguage})`,
        by: 'Real-time'
      },
      cues: lines
    };
    
    console.log('📋 Lyrics data to store:', {
      meta: lyricsData.meta,
      cuesCount: lyricsData.cues.length,
      cuesPreview: lyricsData.cues.slice(0, 2)
    });
    
    loadLrc(lyricsData);

    console.log('✅ Lyrics store updated successfully');
    console.log('📊 Post-update store state:', {
      cues: useLyricsStore.getState().cues.length,
      active: useLyricsStore.getState().active
    });

    // Set active word
    if (highlightFromIndex >= 0 && highlightFromIndex < words.length) {
      const lineId = Math.floor(highlightFromIndex / wordsPerLine);
      const wordId = highlightFromIndex;
      
      console.log('🎯 Setting active word:', {
        lineId,
        wordId,
        word: words[highlightFromIndex]
      });
      
      setActive(lineId, wordId);
      console.log('✅ Active word set successfully');
    } else {
      console.log('⚠️ Highlight index out of bounds, not setting active word');
    }
    
    setCurrentWordIndex(highlightFromIndex);
  };

  /* Track connection status */
  useEffect(() => {
    setConnectionStatus(status);
  }, [status]);

  /* start/stop wave anim */
  useEffect(() => {
    if (isStreaming) {
      ringCtrl.start((i) => ring(i));
    } else {
      ringCtrl.stop();
    }
  }, [isStreaming, ringCtrl]);

  /* amplitude CSS variable for ring thickness */
  useEffect(() => {
    if (!isStreaming) return;
    const node = analyserRef.current;
    if (!node) return;

    const id = setInterval(() => {
      const amp = window.latestAmplitude || 0.1;  // set inside useSpeechStream
      node.style.setProperty("--amp", (amp * 8).toFixed(2) + "px");
    }, 60);

    return () => clearInterval(id);
  }, [isStreaming]);

  /* Handle language change */
  const handleLanguageChange = (languageCode) => {
    setSelectedLanguage(languageCode);
    speechClientInstance.setLanguage(languageCode);
    setShowLanguageSelector(false);
    console.log(`Language changed to: ${languageCode}`);
    
    // Update lyrics metadata if we have content
    if (transcriptWords.length > 0) {
      const currentStore = useLyricsStore.getState();
      useLyricsStore.getState().loadLrc({
        meta: { 
          ...currentStore.meta,
          ar: `Speech Recognition (${languageCode})`
        },
        cues: currentStore.cues
      });
    }
  };

  /* Clear only speech transcript, keep imported lyrics */
  const clearSpeechTranscript = () => {
    setTranscript('');
    setInterimText('');
    setTranscriptWords([]);
    setCurrentWordIndex(0);
    // Reset active word but keep imported lyrics
    useLyricsStore.getState().setActive(null, null);
  };

  /* Clear transcript when stopping */
  const clearTranscript = () => {
    setTranscript('');
    setInterimText('');
    setTranscriptWords([]);
    setCurrentWordIndex(0);
    // Clear lyrics store (this will also clear imported lyrics)
    useLyricsStore.getState().clear();
  };

  /* Improved toggle function with permission re-checking */
  const toggleMic = async () => {
    try {
      setConnectionError(null);
      
      if (isStreaming) {
        await stop();
        console.log('Microphone stopped');
      } else {
        // Check permissions before starting
        await checkPermission();
        
        // Reset session counters when starting new recording
        processedResultsCount.current = 0;
        lastProcessedCount.current = 0; // Reset polling counter
        setAllFinalTranscripts([]);
        setTranscriptWords([]);
        setTranscript('');
        setInterimText('');
        
        // Only clear lyrics if no imported lyrics, otherwise just reset active word
        if (!importedLyrics || importedLyrics.length === 0) {
          clearLyrics(); // Clear lyrics store
        } else {
          // Keep imported lyrics but reset active word
          useLyricsStore.getState().setActive(null, null);
        }
        
        console.log('🎬 Starting new recording session - cleared speech data, kept imported lyrics');
        
        await start();
        console.log('Microphone started');
      }
    } catch (error) {
      console.error('Error toggling microphone:', error);
      setConnectionError(error.message);
    }
  };

  /* Re-check permissions when user interaction suggests they might have changed */
  const handleMicButtonFocus = async () => {
    if (permission === 'denied' || permission === 'prompt') {
      await checkPermission();
    }
  };

  /* Get status display text */
  const getStatusDisplay = () => {
    const clientStatus = speechClientInstance.getStatus();
    const serviceInfo = clientStatus.useFallback ? ' (Browser Fallback)' : ' (AssemblyAI)';
    
    if (permission === 'denied') return 'Microphone access denied - Click to check permission';
    if (connectionError) return `Error: ${connectionError}`;
    if (error) return `Error: ${error}`;
    if (isStreaming) return `Recording${serviceInfo}...`;
    if (connectionStatus === 'connected') return `Connected${serviceInfo} - Click to start recording`;
    if (connectionStatus === 'connecting') return 'Connecting to speech service...';
    return 'Click to connect and record';
  };

  /* Get status color */
  const getStatusColor = () => {
    if (permission === 'denied' || connectionError || error) return 'text-red-400';
    if (isStreaming) return 'text-[#1DB954]';
    if (connectionStatus === 'connected') return 'text-blue-400';
    return 'text-gray-400';
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-[#121212] pt-32 pb-24 text-white overflow-x-hidden">
      {/* faint centre-light → edge-dark vignette */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(18,18,18,0.85)_70%)]" />

      {/* ─── STATUS & DEBUG INFO ─── */}
      <div className="mb-6 text-center space-y-2">
        <p className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusDisplay()}
        </p>
        {connectionStatus && (
          <p className="text-xs text-gray-500">
            Status: {connectionStatus}
            {error && ` | Error: ${error}`}
            {connectionError && ` | Connection: ${connectionError}`}
          </p>
        )}
        {permission === 'denied' && (
          <p className="text-xs text-yellow-400">
            💡 Enable microphone in browser settings and refresh the page
          </p>
        )}
      </div>

      {/* ─── LANGUAGE SELECTOR ─── */}
      <div className="relative mb-6">
        <button
          onClick={() => setShowLanguageSelector(!showLanguageSelector)}
          className="flex items-center space-x-2 px-4 py-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faCog} className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-300">
            {languages.find(lang => lang.code === selectedLanguage)?.flag} {languages.find(lang => lang.code === selectedLanguage)?.name}
          </span>
        </button>

        {showLanguageSelector && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-2 -left-2 bg-[#1A1A1A] rounded-lg border border-white/10 shadow-lg z-50 min-w-[150px]"
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center space-x-3 w-full px-4 py-3 text-left hover:bg-[#2A2A2A] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  selectedLanguage === lang.code ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'text-gray-300'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm">{lang.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* ─── QUICK STATUS INDICATOR ─── */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
        <span>
          {isStreaming 
            ? `Recording (${languages.find(lang => lang.code === selectedLanguage)?.name})`
            : 'Ready to record'
          }
        </span>
        {error && (
          <>
            <span className="text-orange-400">•</span>
            <span className="text-orange-400">Using fallback</span>
          </>
        )}
      </div>

      {/* ─── MIC WITH REACTIVE WAVES ─── */}
      <div className="relative mb-8" ref={analyserRef}>
        {/* Animated rings - only show when recording */}
        {isStreaming && [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            custom={i}
            initial={{ opacity: 0 }}
            animate={ringCtrl}
            style={{ borderWidth: "var(--amp,2px)" }}
            className="absolute inset-0 rounded-full border border-[#1DB954]"
          />
        ))}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={isStreaming ? "Stop recording" : "Start recording"}
          onClick={toggleMic}
          onFocus={handleMicButtonFocus}
          onMouseEnter={handleMicButtonFocus}
          disabled={false} // Always allow clicking to check permissions
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 ${
            isStreaming 
              ? "bg-[#1DB954] shadow-lg shadow-[#1DB954]/50" 
              : permission === 'denied'
              ? "bg-red-500/20 hover:bg-red-500/40 border-2 border-red-500/50"
              : "bg-[#1A1A1A] hover:bg-[#2A2A2A]"
          } cursor-pointer`}
        >
          {isStreaming ? (
            <FontAwesomeIcon icon={faMicrophone} className="h-8 w-8 text-white" />
          ) : permission === 'denied' ? (
            <FontAwesomeIcon icon={faMicrophoneSlash} className="h-8 w-8 text-red-400" />
          ) : (
            <FontAwesomeIcon icon={faMicrophoneSlash} className="h-8 w-8 text-gray-400" />
          )}
        </motion.button>
      </div>

      {/* ─── CONTROL BUTTONS ─── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-[#1DB954]/20 px-6 py-2 text-sm hover:bg-[#1DB954]/40 transition-colors"
        >
          Import Lyrics
        </button>

        {importedLyrics && importedLyrics.length > 0 && (
          <button
            onClick={clearTranscript}
            className="rounded-full bg-orange-500/20 px-6 py-2 text-sm hover:bg-orange-500/40 transition-colors"
          >
            Clear Imported Lyrics
          </button>
        )}

        {(transcript || transcriptWords.length > 0) && (
          <button
            onClick={importedLyrics && importedLyrics.length > 0 ? clearSpeechTranscript : clearTranscript}
            className="rounded-full bg-red-500/20 px-6 py-2 text-sm hover:bg-red-500/40 transition-colors"
          >
            {importedLyrics && importedLyrics.length > 0 ? 'Clear Speech' : 'Clear All'}
          </button>
        )}

        {transcriptWords.length > 0 && (
          <div className="text-xs text-gray-400">
            {transcriptWords.length} words
            {importedLyrics && importedLyrics.length > 0 ? 
              ` • Matching with ${importedLyrics.length} imported words` : 
              ` • ${cues.length} lines`
            }
          </div>
        )}

        {importedLyrics && importedLyrics.length > 0 && !transcriptWords.length && (
          <div className="text-xs text-[#1DB954]">
            ✓ {importedLyrics.length} words imported • Start speaking to highlight lyrics
          </div>
        )}
      </div>

      {/* ─── TRANSCRIPT DISPLAY (SECONDARY) ─── */}
      {(transcript || interimText) && (
        <div className="mt-6 w-full max-w-[900px] px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1A1A1A]/30 rounded-lg p-4 border border-white/5 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Raw Transcript</h4>
              <div className="flex items-center space-x-3">
                {isStreaming && (
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-[#1DB954] rounded-full animate-pulse"></div>
                    <span className="text-xs text-[#1DB954]">Recording</span>
                  </div>
                )}
                <button
                  onClick={clearTranscript}
                  className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
                >
                  Clear
                </button>
              </div>
            </div>
            
            <div className="text-white space-y-2 max-h-32 overflow-y-auto text-sm">
              {transcript && (
                <div className="bg-[#2A2A2A]/30 rounded p-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Final</span>
                  <p className="mt-1 leading-relaxed">{transcript}</p>
                </div>
              )}
              {interimText && (
                <div className="bg-[#1DB954]/5 rounded p-2 border-l-2 border-[#1DB954]">
                  <span className="text-xs text-[#1DB954] uppercase tracking-wide">Live</span>
                  <p className="mt-1 text-gray-300 italic leading-relaxed">{interimText}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── LYRICS DISPLAY (MAIN) ─── */}
      <div className="mt-4 w-full max-w-[900px] px-4">
        {(cues.length > 0 || (importedLyrics && importedLyrics.length > 0)) ? (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-[#1DB954] mb-2">
                {importedLyrics && importedLyrics.length > 0 ? 'Imported Lyrics' : 'Live Lyrics'}
              </h2>
              <div className="flex items-center justify-center space-x-4 text-xs text-gray-400 mb-4">
                <span>{useLyricsStore.getState().meta.ar || 'Speech Recognition'}</span>
                {isStreaming && (
                  <>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-pulse"></div>
                      <span className="text-[#1DB954]">
                        {importedLyrics && importedLyrics.length > 0 ? 'Listening for matches' : 'Live'}
                      </span>
                    </div>
                  </>
                )}
                {importedLyrics && importedLyrics.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-[#1DB954]">Karaoke Mode</span>
                  </>
                )}
              </div>
            </div>
            {cues.length > 0 ? (
              <LyricsDisplay lines={cues} activeWord={activeWord} />
            ) : (
              <div className="text-center py-8">
                <div className="text-[#1DB954] mb-4">🎤</div>
                <p className="text-gray-400">
                  Lyrics imported! Start speaking to highlight words.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FontAwesomeIcon icon={faMicrophone} className="h-12 w-12 mb-4" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              {importedLyrics && importedLyrics.length > 0 ? 
                'Ready for Karaoke' : 
                'Start Recording'
              }
            </h3>
            <p className="text-sm text-gray-500">
              {importedLyrics && importedLyrics.length > 0 ? (
                <>
                  Lyrics are imported and ready!<br />
                  Click the microphone and start singing to highlight words.
                </>
              ) : (
                <>
                  Click the microphone to begin live transcription.<br />
                  Your words will appear here as karaoke-style lyrics.
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ─── IMPORT MODAL ─── */}
      <ImportLyricsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onImport={importFile}
      />
    </div>
  );
}
