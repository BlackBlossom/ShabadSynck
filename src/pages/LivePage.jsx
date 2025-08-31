/* ──────────  src/pages/LivePage.jsx  ────────── */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faMicrophoneSlash, faCog, faCopy } from '@fortawesome/free-solid-svg-icons';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

import ImportLyricsModal from "../components/Lyrics/ImportLyricsModal";
import LyricsDisplay from "../components/Lyrics/LyricsDisplay";

import useImportedLyrics from "../hooks/useImportedLyrics";
import { useLyricsStore } from "../store/lyricsStore";
import { getMappedLanguage } from "../api/speechClient";

export default function LivePage() {
  /* lyrics store */
  const cues = useLyricsStore((s) => s.cues);
  const activeWord = useLyricsStore((s) => s.active);
  const setActive = useLyricsStore((s) => s.setActive);
  const loadLrc = useLyricsStore((s) => s.loadLrc);
  const clearLyrics = useLyricsStore((s) => s.clear);
  const highlightMatchingWords = useLyricsStore((s) => s.highlightMatchingWords);
  const importedLyrics = useLyricsStore((s) => s.importedLyrics);
  const hasImportedLyrics = useLyricsStore((s) => s.hasImportedLyrics);

  /* UI state */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [lastActivePosition, setLastActivePosition] = useState({ lineId: null, wordId: null });

  // Refs for karaoke timing
  const lastTranscriptRef = useRef('');
  const pauseTimeoutRef = useRef(null);
  const lastSpeechTimeRef = useRef(Date.now());

  // Use react-speech-recognition directly - simple approach like the sample
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  const languages = [
    { code: 'english', name: 'English', flag: '🇺🇸' },
    { code: 'hindi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'punjabi', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' }
  ];

  /* hooks */
  const { importFile } = useImportedLyrics();

  // Simple start listening function like the sample
  const startListening = () => SpeechRecognition.startListening({ 
    continuous: true, 
    language: getMappedLanguage(selectedLanguage) 
  });

  useEffect(() => {
    // reset everything on re-render
    resetTranscript();
    clearLyrics();
    setCurrentPhrase('');
    lastTranscriptRef.current = '';
    setLastActivePosition({ lineId: null, wordId: null });
  }, []);

  // Enhanced karaoke-style transcript processing
  useEffect(() => {
    if (!listening) return;

    if (transcript) {
      lastSpeechTimeRef.current = Date.now();
      
      if (hasImportedLyrics) {
        // Real karaoke mode: process current phrase only
        handleKaraokeTranscript(transcript);
      } else {
        // Live transcription mode: accumulate transcript
        handleLiveTranscript(transcript);
      }
    }

    // Set up pause detection for karaoke mode
    if (hasImportedLyrics) {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
      
      pauseTimeoutRef.current = setTimeout(() => {
        // Reset transcript after 2 seconds of pause for better karaoke matching
        if (Date.now() - lastSpeechTimeRef.current > 2000) {
          console.log('🎤 Karaoke pause detected - resetting transcript');
          resetTranscript();
          setCurrentPhrase('');
          lastTranscriptRef.current = '';
        }
      }, 2000);
    }

    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [transcript, listening, hasImportedLyrics]);

  // Handle karaoke-style transcript processing
  const handleKaraokeTranscript = (newTranscript) => {
    // In karaoke mode, we want to match the current phrase, not accumulated text
    const cleanTranscript = newTranscript.trim();
    
    if (cleanTranscript && cleanTranscript !== lastTranscriptRef.current) {
      setCurrentPhrase(cleanTranscript);
      
      // Extract just the new words spoken since last update
      const currentWords = cleanTranscript.split(/\s+/).filter(word => word.length > 0);
      
      // For better karaoke experience, we can either:
      // 1. Match the entire current phrase, or 
      // 2. Match just the most recent words
      
      // Let's use the last few words for more responsive highlighting
      const recentWords = currentWords.slice(-3); // Last 3 words for better responsiveness
      
      console.log('🎤 Karaoke matching:', { 
        full: currentWords, 
        recent: recentWords,
        transcript: cleanTranscript 
      });
      
      const matchResult = highlightMatchingWords(recentWords);
      
      // If no match with recent words, try with all current words
      if (!matchResult || matchResult.matchLength === 0) {
        highlightMatchingWords(currentWords);
      }
      
      lastTranscriptRef.current = cleanTranscript;
    }
  };

  // Handle live transcription (non-karaoke mode)
  const handleLiveTranscript = (newTranscript) => {
    const words = newTranscript.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length > 0) {
      const wordsPerLine = 8;
      const lines = [];
      
      for (let i = 0; i < words.length; i += wordsPerLine) {
        const lineWords = words.slice(i, i + wordsPerLine).map((word, wordIndex) => ({
          id: i + wordIndex,
          text: word,
          originalText: word
        }));
        
        lines.push({
          id: Math.floor(i / wordsPerLine),
          words: lineWords,
          ms: Date.now()
        });
      }

      const lyricsData = {
        meta: { 
          ti: 'Live Transcription',
          ar: `Speech Recognition (${selectedLanguage})`,
          by: 'Real-time'
        },
        cues: lines,
        isImported: false
      };
      
      loadLrc(lyricsData);
      
      // Set active to last word for live transcription
      const lastWordIndex = words.length - 1;
      const lineId = Math.floor(lastWordIndex / wordsPerLine);
      setActive(lineId, lastWordIndex);
    }
  };

  /* Handle language change */
  const handleLanguageChange = (languageCode) => {
    setSelectedLanguage(languageCode);
    setShowLanguageSelector(false);
    
    // If currently listening, restart with new language
    if (listening) {
      SpeechRecognition.stopListening();
      setTimeout(() => {
        SpeechRecognition.startListening({ 
          continuous: true,
          language: getMappedLanguage(languageCode)
        });
      }, 100);
    }
  };

  /* Simple copy function like the sample approach */
  const copyToClipboard = async () => {
    try {
      let textToCopy = '';
      
      if (hasImportedLyrics && cues.length > 0) {
        // Copy imported lyrics
        textToCopy = cues.map(cue => 
          cue.words.map(word => word.originalText || word.text).join(' ')
        ).join('\n');
      } else if (transcript) {
        // Copy live transcript
        textToCopy = transcript;
      }
      
      if (textToCopy.trim()) {
        await navigator.clipboard.writeText(textToCopy);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1000); // Reset after 1 second
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  /* Toggle microphone - simple approach */
  const toggleMic = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      startListening();
    }
  };

  /* Get status display text */
  const getStatusDisplay = () => {
    if (!browserSupportsSpeechRecognition) return 'Browser does not support speech recognition - Please use Chrome, Edge, or Safari';
    if (isMicrophoneAvailable === false) return 'Microphone access denied - Click to check permission';
    if (listening) return 'Recording...';
    return 'Click to start recording';
  };

  /* Get status color */
  const getStatusColor = () => {
    if (!browserSupportsSpeechRecognition || isMicrophoneAvailable === false) return 'text-red-400';
    if (listening) return 'text-[#1DB954]';
    return 'text-gray-400';
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-[#121212] pt-32 pb-24 text-white overflow-x-hidden">
      {/* faint centre-light → edge-dark vignette */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(18,18,18,0.85)_70%)]" />

      {/* ─── STATUS INFO ─── */}
      <div className="mb-6 text-center space-y-2">
        <p className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusDisplay()}
        </p>
        {isMicrophoneAvailable === false && (
          <p className="text-xs text-yellow-400">
            💡 Enable microphone in browser settings and refresh the page
          </p>
        )}
        {!browserSupportsSpeechRecognition && (
          <p className="text-xs text-yellow-400">
            💡 Please use Chrome, Edge, or Safari for speech recognition
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
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <div className={`w-2 h-2 rounded-full ${
          listening ? 'bg-[#1DB954] animate-pulse' : 'bg-gray-500'
        }`}></div>
        <span>
          {listening 
            ? `Recording (${languages.find(lang => lang.code === selectedLanguage)?.name})`
            : 'Ready to record'
          }
        </span>
      </div>

      {/* ─── MICROPHONE BUTTON ─── */}
      <div className="relative mb-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={listening ? "Stop recording" : "Start recording"}
          onClick={toggleMic}
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 ${
            listening 
              ? "bg-[#1DB954] shadow-lg shadow-[#1DB954]/50" 
              : (!browserSupportsSpeechRecognition || isMicrophoneAvailable === false)
              ? "bg-red-500/20 hover:bg-red-500/40 border-2 border-red-500/50"
              : "bg-[#1A1A1A] hover:bg-[#2A2A2A]"
          } cursor-pointer`}
        >
          {listening ? (
            <FontAwesomeIcon icon={faMicrophone} className="h-8 w-8 text-white" />
          ) : (!browserSupportsSpeechRecognition || isMicrophoneAvailable === false) ? (
            <FontAwesomeIcon icon={faMicrophoneSlash} className="h-8 w-8 text-red-400" />
          ) : (
            <FontAwesomeIcon icon={faMicrophoneSlash} className="h-8 w-8 text-gray-400" />
          )}
        </motion.button>
      </div>

      {/* ─── CONTROL BUTTONS ─── */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-full bg-[#1DB954]/20 px-6 py-2 text-sm hover:bg-[#1DB954]/40 transition-colors"
        >
          Import Lyrics
        </button>

        {/* Copy button - show when there's transcript or lyrics */}
        {(transcript || cues.length > 0) && (
          <button
            onClick={copyToClipboard}
            className="flex items-center space-x-2 rounded-full bg-blue-500/20 px-6 py-2 text-sm hover:bg-blue-500/40 transition-colors"
          >
            <FontAwesomeIcon icon={faCopy} className="h-3 w-3" />
            <span>{isCopied ? 'Copied!' : 'Copy Lyrics'}</span>
          </button>
        )}

        {/* Clear buttons */}
        {hasImportedLyrics && (
          <button
            onClick={clearLyrics}
            className="rounded-full bg-orange-500/20 px-6 py-2 text-sm hover:bg-orange-500/40 transition-colors"
          >
            Clear Imported Lyrics
          </button>
        )}

        {transcript && (
          <button
            onClick={resetTranscript}
            className="rounded-full bg-red-500/20 px-6 py-2 text-sm hover:bg-red-500/40 transition-colors"
          >
            Clear Transcript
          </button>
        )}
      </div>

      <div className="mb-4 text-center">
        {/* Status info */}
        {transcript && (
          <div className="mt-2 text-xs text-gray-400">
            {transcript.split(/\s+/).filter(word => word.length > 0).length} words
            {hasImportedLyrics ? 
              ` • Karaoke mode active • ${listening ? 'Listening for matches' : 'Paused'}` : 
              ` • Live transcription`
            }
          </div>
        )}

        {hasImportedLyrics && !transcript && (
          <div className="mt-2 text-xs text-[#1DB954]">
            ✓ Lyrics imported • Start singing to highlight words in real-time karaoke style
          </div>
        )}

        {hasImportedLyrics && listening && !transcript && (
          <div className="mt-2 text-xs text-yellow-400 animate-pulse">
            🎤 Ready for karaoke • Speak or sing to see live highlighting
          </div>
        )}
      </div>

      {/* ─── LYRICS DISPLAY ─── */}
      <div className="mt-4 w-full max-w-[900px] px-4">
        {(cues.length > 0 || hasImportedLyrics) ? (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-[#1DB954] mb-2">
                {hasImportedLyrics ? 'Imported Lyrics' : 'Live Lyrics'}
              </h2>
              <div className="flex items-center justify-center space-x-4 text-xs text-gray-400 mb-4">
                <span>{hasImportedLyrics ? 'Karaoke Mode' : 'Live Transcription'}</span>
                {listening && (
                  <>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-pulse"></div>
                      <span className="text-[#1DB954]">Recording</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {cues.length > 0 ? (
              <LyricsDisplay lines={cues} activeWord={activeWord} />
            ) : hasImportedLyrics ? (
              <div className="text-center py-8">
                <div className="text-[#1DB954] mb-4">🎤</div>
                <p className="text-gray-400">
                  Lyrics imported! Start speaking to highlight words in karaoke style.
                </p>
              </div>
            ) : null}
            
            {/* Show current phrase for karaoke mode */}
            {hasImportedLyrics && listening && (
              <div className="mt-6 p-4 bg-[#1A1A1A] rounded-lg border border-[#1DB954]/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">🎤 Current phrase:</div>
                  {currentPhrase && (
                    <div className="text-xs text-[#1DB954]">
                      ✨ Karaoke Active
                    </div>
                  )}
                </div>
                <div className="text-[#1DB954] text-lg font-medium leading-relaxed">
                  {currentPhrase || (transcript ? transcript : 'Start singing...')}
                </div>
                {!currentPhrase && !transcript && (
                  <div className="text-xs text-gray-500 mt-2">
                    Sing along with the lyrics above - words will highlight as you sing!
                  </div>
                )}
                {currentPhrase && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400">
                      💡 Tip: Pause briefly between phrases for better accuracy
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Show current transcript for live mode */}
            {transcript && !hasImportedLyrics && (
              <div className="mt-6 p-4 bg-[#1A1A1A] rounded-lg border border-white/10">
                <div className="text-xs text-gray-400 mb-2">Live transcript:</div>
                <div className="text-white text-sm leading-relaxed">
                  {transcript}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FontAwesomeIcon icon={faMicrophone} className="h-12 w-12 mb-4" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              Start Recording
            </h3>
            <p className="text-sm text-gray-500">
              Click the microphone to begin live transcription.<br />
              Your words will appear here as karaoke-style lyrics.
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
