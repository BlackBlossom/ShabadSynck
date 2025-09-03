/**
 * Unified Speech Recognition Hook
 * Supports both Soniox WebSocket API and Web Speech API (react-speech-recognition) fallback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { 
  SonioxSpeechClient, 
  SPEECH_PROVIDERS, 
  getMappedLanguage, 
  getSonioxLanguage 
} from '../api/speechClient';

// Configuration constants
const SONIOX_API_KEY = import.meta.env.VITE_SONIOX_API_KEY;
const FALLBACK_TO_WEB_SPEECH = true; // Always fallback if Soniox fails
const SONIOX_RETRY_ATTEMPTS = 2;
const SONIOX_RETRY_DELAY = 1000; // ms

export default function useSpeechStream(options = {}) {
  // State management
  const [provider, setProvider] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(''); // Current interim transcript
  const [finalTranscript, setFinalTranscript] = useState(''); // Accumulated final transcript
  const [currentLanguages, setCurrentLanguages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const sonioxClientRef = useRef(null);
  const currentLanguageRef = useRef(options.language || 'english');
  const isManualStopRef = useRef(false);

  // Web Speech API fallback
  const {
    transcript: webTranscript,
    listening: webListening,
    resetTranscript: webResetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  /**
   * Fallback to Web Speech API
   */
  const fallbackToWebSpeech = useCallback((language = 'english') => {
    console.log('🌐 Using Web Speech API fallback');
    setProvider(SPEECH_PROVIDERS.WEB_SPEECH);
    setIsConnected(browserSupportsSpeechRecognition);
    setError(null);
    
    // Clean up Soniox client if exists
    if (sonioxClientRef.current) {
      sonioxClientRef.current.disconnect();
      sonioxClientRef.current = null;
    }
  }, [browserSupportsSpeechRecognition]);

  /**
   * Start listening based on current provider
   */
  const startListening = useCallback(async (language = 'english') => {
    if (isListening) return;

    console.log('🎤 Starting speech recognition...');
    setError(null);
    isManualStopRef.current = false;
    currentLanguageRef.current = language;

    // Try Soniox first if API key is available
    if (SonioxSpeechClient.isAvailable(SONIOX_API_KEY)) {
      try {
        // Initialize and connect to Soniox when actually starting recording
        if (!sonioxClientRef.current) {
          console.log('🚀 Initializing Soniox client for recording...');
          const client = new SonioxSpeechClient(SONIOX_API_KEY, {
            model: 'stt-rt-preview',  // Use correct model alias from official documentation
            context: options.context || 'kirtan bhajan punjabi religious song',
            onTranscript: (text, isFinal, metadata) => {
              console.log('📝 Soniox transcript:', { text, isFinal, languages: metadata?.languages });
              
              if (isFinal) {
                // Concatenate final results to build continuous transcript
                setFinalTranscript(prev => {
                  const newFinal = prev + (prev ? ' ' : '') + text;
                  console.log('📜 Final transcript updated:', newFinal);
                  return newFinal;
                });
                // Clear interim transcript after final is added
                setTranscript('');
              } else {
                // Show interim results but don't concatenate
                setTranscript(text);
              }
              
              // Update detected languages
              if (metadata?.languages && metadata.languages.length > 0) {
                setCurrentLanguages(metadata.languages);
              }
            },
            onError: (err) => {
              console.error('❌ Soniox error:', err);
              setError(err);
              
              // Only fallback on certain types of errors, not connection issues
              const shouldFallback = 
                err.message.includes('API Error') || 
                err.message.includes('Payment required') || 
                err.message.includes('Unauthorized') ||
                err.message.includes('400') ||
                err.message.includes('401') ||
                err.message.includes('402');
              
              if (FALLBACK_TO_WEB_SPEECH && shouldFallback) {
                console.log('🔄 Falling back to Web Speech API due to API error');
                fallbackToWebSpeech(language);
                // Start Web Speech API immediately
                setTimeout(() => {
                  SpeechRecognition.startListening({
                    continuous: true,
                    language: getMappedLanguage(language)
                  });
                  setIsListening(true);
                }, 100);
              }
            },
            onConnectionChange: (connected) => {
              setIsConnected(connected);
              if (connected) {
                // Don't set provider here - wait until recording actually starts
                setRetryCount(0);
              }
            },
            onFinalTranscript: () => {
              console.log('✅ Soniox transcription session finished');
            }
          });

          sonioxClientRef.current = client;
        }

        // Connect and start recording with proper error handling
        try {
          await sonioxClientRef.current.connect(getSonioxLanguage(language));
          await sonioxClientRef.current.startRecording();
          setIsListening(true);
          setProvider(SPEECH_PROVIDERS.SONIOX);
        } catch (connectionError) {
          console.error('❌ Soniox connection failed:', connectionError);
          // Only fallback on non-recoverable errors
          if (FALLBACK_TO_WEB_SPEECH) {
            console.log('🔄 Connection failed, falling back to Web Speech API');
            fallbackToWebSpeech(language);
            SpeechRecognition.startListening({
              continuous: true,
              language: getMappedLanguage(language)
            });
            setIsListening(true);
          } else {
            throw connectionError;
          }
        }

      } catch (error) {
        console.error('❌ Failed to start Soniox:', error);
        // Error already handled in inner try-catch
      }
    } else {
      // Use Web Speech API directly if no Soniox key
      console.log('🌐 Using Web Speech API (no Soniox key)');
      setProvider(SPEECH_PROVIDERS.WEB_SPEECH);
      SpeechRecognition.startListening({
        continuous: true,
        language: getMappedLanguage(language)
      });
      setIsListening(true);
    }
  }, [isListening, options.context, fallbackToWebSpeech]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (!isListening) return;

    console.log('⏹️ Stopping speech recognition...');
    isManualStopRef.current = true;
    setIsListening(false);

    if (provider === SPEECH_PROVIDERS.SONIOX && sonioxClientRef.current) {
      sonioxClientRef.current.stopRecording();
    } else if (provider === SPEECH_PROVIDERS.WEB_SPEECH) {
      SpeechRecognition.stopListening();
    }
  }, [isListening, provider]);

  /**
   * Reset transcript
   */
  const resetTranscript = useCallback(() => {
    console.log('🔄 Resetting transcript...');
    setTranscript('');
    setFinalTranscript('');
    setCurrentLanguages([]);
    
    if (provider === SPEECH_PROVIDERS.WEB_SPEECH) {
      webResetTranscript();
    }
  }, [provider, webResetTranscript]);

  /**
   * Change language
   */
  const setLanguage = useCallback(async (language) => {
    console.log('🌍 Changing language to:', language);
    currentLanguageRef.current = language;

    const wasListening = isListening;
    
    if (wasListening) {
      stopListening();
    }

    // Clean up Soniox client if exists to force reconnection with new language
    if (sonioxClientRef.current) {
      sonioxClientRef.current.disconnect();
      sonioxClientRef.current = null;
    }

    if (wasListening) {
      setTimeout(() => startListening(language), 500);
    }
  }, [isListening, stopListening, startListening]);

  /**
   * Sync Web Speech API transcript with state
   */
  useEffect(() => {
    if (provider === SPEECH_PROVIDERS.WEB_SPEECH && webTranscript) {
      setTranscript(webTranscript);
    }
  }, [webTranscript, provider]);

  /**
   * Sync Web Speech API listening state
   */
  useEffect(() => {
    if (provider === SPEECH_PROVIDERS.WEB_SPEECH) {
      setIsListening(webListening);
    }
  }, [webListening, provider]);

  /**
   * Auto-initialize Web Speech API as default
   */
  useEffect(() => {
    if (!provider && !SonioxSpeechClient.isAvailable(SONIOX_API_KEY)) {
      // Set Web Speech as default if no Soniox key
      console.log('🌐 Setting Web Speech API as default provider');
      setProvider(SPEECH_PROVIDERS.WEB_SPEECH);
      setIsConnected(browserSupportsSpeechRecognition);
    }
  }, [provider, browserSupportsSpeechRecognition]);

  /**
   * Cleanup effect - only disconnect when component unmounts, not on provider changes
   */
  useEffect(() => {
    return () => {
      // Only cleanup on component unmount
      if (sonioxClientRef.current) {
        sonioxClientRef.current.disconnect();
      }
      if (provider === SPEECH_PROVIDERS.WEB_SPEECH && webListening) {
        SpeechRecognition.stopListening();
      }
    };
  }, []); // Remove provider and webListening dependencies to prevent unnecessary cleanups

  return {
    // Core functionality
    startListening,
    stopListening,
    resetTranscript,
    setLanguage,

    // State
    isListening,
    transcript, // Current interim transcript
    finalTranscript, // Accumulated final transcript
    currentLanguages, // Detected languages
    provider,
    isConnected,
    error,

    // Web Speech API compatibility
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,

    // Provider info
    isUsingSoniox: provider === SPEECH_PROVIDERS.SONIOX,
    isUsingWebSpeech: provider === SPEECH_PROVIDERS.WEB_SPEECH,
    
    // Advanced features (Soniox only)
    sonioxClient: sonioxClientRef.current
  };
}
