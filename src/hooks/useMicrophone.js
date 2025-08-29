import { useEffect, useRef, useState, useCallback } from "react";

export default function useMicrophone(sampleRate = 48_000) {
  const [permission, setPermission]   = useState(null);   // null | "granted" | "denied"
  const [stream, setStream]           = useState(null);   // MediaStream
  const audioCtxRef                   = useRef(null);
  const sourceNodeRef                 = useRef(null);
  const lastPermissionCheck           = useRef(Date.now());

  /* Enhanced permission checking function */
  const checkPermission = useCallback(async () => {
    try {
      // Avoid spamming permission checks
      const now = Date.now();
      if (now - lastPermissionCheck.current < 1000) {
        return permission;
      }
      lastPermissionCheck.current = now;

      // Try permissions API first
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'microphone' });
        setPermission(result.state);
        
        result.onchange = () => {
          console.log('Microphone permission changed to:', result.state);
          setPermission(result.state);
          
          // If permission was revoked, stop the current stream
          if (result.state === 'denied' && stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
          }
        };
        
        return result.state;
      } else {
        // Fallback: try to access microphone
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true } 
          });
          testStream.getTracks().forEach(track => track.stop()); // Clean up immediately
          setPermission("granted");
          return "granted";
        } catch (err) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setPermission("denied");
            return "denied";
          }
          console.error('Error checking microphone permission:', err);
          setPermission("prompt");
          return "prompt";
        }
      }
    } catch (err) {
      console.error('Error in permission check:', err);
      setPermission("prompt");
      return "prompt";
    }
  }, [permission, stream]);

  /* Request microphone access */
  const requestMicrophone = useCallback(async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
      
      setPermission("granted");
      setStream(newStream);
      return newStream;
    } catch (err) {
      console.error('Failed to get microphone access:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermission("denied");
      } else {
        setPermission("prompt");
      }
      throw err;
    }
  }, []);

  /* Check permission on mount and set up initial state */
  useEffect(() => {
    checkPermission().then(permissionState => {
      if (permissionState === 'granted') {
        // If we already have permission, get the stream
        requestMicrophone().catch(err => {
          console.log('Could not get initial microphone stream:', err.message);
        });
      }
    });

    // Clean up stream on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array for mount only

  /* create audio-context & node when stream arrives */
  useEffect(() => {
    if (!stream) return;

    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate,
      });
      sourceNodeRef.current = audioCtxRef.current.createMediaStreamSource(stream);
    } catch (err) {
      console.error('Error creating audio context:', err);
    }
  }, [stream, sampleRate]);

  const connect = useCallback((destNode /* AudioNode */) => {
    if (sourceNodeRef.current && destNode) {
      try {
        sourceNodeRef.current.connect(destNode);
      } catch (err) {
        console.error('Error connecting audio nodes:', err);
      }
    }
  }, []);

  return { 
    permission, 
    stream, 
    audioCtx: audioCtxRef.current, 
    connect, 
    checkPermission,
    requestMicrophone 
  };
}
