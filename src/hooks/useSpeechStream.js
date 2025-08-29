/*  Enhanced Speech Stream using Browser Speech Recognition
    -------------------------------------------------------------------------
    • Uses browser Speech Recognition API only (AssemblyAI disabled)
    • Enhanced microphone permission handling with re-checking on mute/unmute
    • Reliable multilingual support for Hindi, English, and Punjabi
*/
import { useEffect, useRef, useState, useCallback } from "react";
import speechClientInstance from "../api/speechClient";

export default function useSpeechStream(onTranscript /* (json) => void */) {
  const [permission, setPermission] = useState("prompt");
  const [isStreaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  
  // Permission checking reference
  const lastPermissionCheck = useRef(Date.now());
  
  // Ref to track if we should be recording (survives StrictMode remounts)
  const shouldBeRecording = useRef(false);
  const isInitialized = useRef(false);

  /* Enhanced microphone permission checking */
  const checkMicrophonePermission = useCallback(async () => {
    try {
      // Check if we need to re-check permissions (e.g., after mute/unmute)
      const now = Date.now();
      if (now - lastPermissionCheck.current < 1000) {
        return permission; // Don't spam permission checks
      }
      lastPermissionCheck.current = now;

      // Try to query permissions API first
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'microphone' });
        setPermission(result.state);
        
        // Listen for permission changes
        result.onchange = () => {
          setPermission(result.state);
          console.log('Microphone permission changed to:', result.state);
          
          // If permission was denied while streaming, stop
          if (result.state === 'denied' && isStreaming) {
            stop();
          }
        };
        
        return result.state;
      } else {
        // Fallback: try to access microphone to check permissions
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true } 
          });
          stream.getTracks().forEach(track => track.stop()); // Clean up immediately
          setPermission('granted');
          return 'granted';
        } catch (err) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setPermission('denied');
            return 'denied';
          }
          throw err;
        }
      }
    } catch (err) {
      console.error('Error checking microphone permission:', err);
      setPermission('prompt');
      return 'prompt';
    }
  }, [permission, isStreaming]);

  /* initialize AssemblyAI speech client */
  useEffect(() => {
    let isMounted = true;
    
    const initializeClient = async () => {
      if (isInitialized.current || !isMounted) return;
      isInitialized.current = true;
      
      console.log('Initializing AssemblyAI client...');
      
      // Check microphone permissions on mount
      if (isMounted) {
        await checkMicrophonePermission();
      }

      // Initialize browser speech client
      speechClientInstance.setEventHandlers({
        onTranscript: (data) => {
          if (!isMounted) return;
          console.log('🎤 Hook received browser speech recognition result:', data);
          // Pass transcript data to parent component
          if (onTranscript) {
            console.log('📡 Forwarding result to LivePage...');
            onTranscript?.(data);
          } else {
            console.warn('⚠️ No onTranscript callback provided to hook!');
          }
          
          // Set global amplitude for ring animation
          window.latestAmplitude = data.confidence || 0.5;
        },
        
        onError: (err) => {
          if (!isMounted) return;
          console.error('❌ Browser speech recognition error:', err);
          setError(err.message);
          setStreaming(false);
          setStatus('disconnected');
          shouldBeRecording.current = false;
        },
        
        onStatusChange: (newStatus) => {
          if (!isMounted) return;
          console.log('📊 Browser speech status changed to:', newStatus);
          setStatus(newStatus);
          if (newStatus === 'recording' || newStatus === 'starting') {
            setStreaming(true);
            shouldBeRecording.current = true;
          } else if (newStatus === 'stopped' || newStatus === 'disconnected' || newStatus === 'stopping') {
            setStreaming(false);
            shouldBeRecording.current = false;
          }
        }
      });

      // Try to connect to browser speech service
      try {
        if (isMounted) {
          setStatus('connecting');
          await speechClientInstance.connect();
          if (isMounted) {
            console.log('✅ Connected to browser speech service');
            setStatus('connected');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ Failed to connect to browser speech service:', err);
          setError('Failed to connect to speech service: ' + err.message);
          setStatus('disconnected');
        }
      }
    };

    initializeClient();

    // Clean up on unmount - only stop if we actually started recording
    return () => {
      console.log('Hook cleanup called, shouldBeRecording:', shouldBeRecording.current);
      isMounted = false;
      // Only stop if we explicitly started recording AND it's a real unmount (not StrictMode)
      if (shouldBeRecording.current && speechClientInstance.getStatus().isRecording) {
        console.log('Stopping recording due to component unmount');
        speechClientInstance.stopRecognition();
        shouldBeRecording.current = false;
      } else {
        console.log('Not stopping - either not recording or StrictMode remount');
      }
    };
  }, []); // Remove all dependencies to prevent re-initialization

  /* Re-check permissions when streaming state changes */
  useEffect(() => {
    if (isStreaming) {
      // Check permissions when starting to stream
      checkMicrophonePermission();
    }
  }, [isStreaming, checkMicrophonePermission]);

  /* Listen for visibility changes to re-check permissions */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isStreaming) {
        // Re-check permissions when tab becomes visible
        setTimeout(() => checkMicrophonePermission(), 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isStreaming, checkMicrophonePermission]);

  const start = useCallback(async () => {
    if (isStreaming || shouldBeRecording.current) {
      console.log('Already streaming or should be recording');
      return;
    }
    
    try {
      setError(null);
      shouldBeRecording.current = true;
      
      // Immediately set streaming state for responsive UI
      console.log('🎤 Setting UI to streaming state...');
      setStreaming(true);
      setStatus('starting');
      
      // Always check permissions before starting
      const permissionState = await checkMicrophonePermission();
      if (permissionState === 'denied') {
        shouldBeRecording.current = false;
        setStreaming(false);
        setStatus('disconnected');
        throw new Error('Microphone permission denied. Please allow microphone access and try again.');
      }

      // Ensure connection is established
      const clientStatus = speechClientInstance.getStatus();
      console.log('Current client status:', clientStatus);
      
      if (!clientStatus.isConnected) {
        console.log('🎤 Browser speech recognition not ready, connecting...');
        setStatus('connecting');
        await speechClientInstance.connect();
        
        // For browser speech recognition, connection is immediate
        const finalStatus = speechClientInstance.getStatus();
        if (!finalStatus.isConnected) {
          shouldBeRecording.current = false;
          setStreaming(false);
          setStatus('disconnected');
          throw new Error('Failed to initialize browser speech recognition');
        }
      }
      
      console.log('🎤 Starting browser speech recognition...');
      await speechClientInstance.startRecognition();
      console.log('✅ Started browser speech recognition');
      setPermission('granted');
      
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError(err.message);
      setStreaming(false);
      setStatus('disconnected');
      shouldBeRecording.current = false;
      
      if (err.name === 'NotAllowedError' || err.message.includes('permission')) {
        setPermission('denied');
      }
    }
  }, [isStreaming, checkMicrophonePermission]);

  const stop = useCallback(() => {
    if (!isStreaming && !shouldBeRecording.current) {
      console.log('⏹️ Stop called but not currently streaming');
      return;
    }
    
    console.log('⏹️ Stopping browser speech recognition...');
    shouldBeRecording.current = false;
    
    // Immediately update UI state
    setStreaming(false);
    setStatus('stopping');
    
    try {
      speechClientInstance.stopRecognition();
      console.log('✅ Browser speech recognition stopped');
      setStatus('stopped');
    } catch (err) {
      console.error('❌ Failed to stop recognition:', err);
      setStatus('disconnected');
    }
  }, [isStreaming]);

  return { 
    isStreaming, 
    start, 
    stop, 
    permission, 
    status, 
    error,
    checkPermission: checkMicrophonePermission
  };
}
