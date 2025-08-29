import { useEffect, useRef, useState, useCallback } from "react";

export default function useMicrophone(sampleRate = 48_000) {
  const [permission, setPermission]   = useState(null);   // null | "granted" | "denied"
  const [stream, setStream]           = useState(null);   // MediaStream
  const audioCtxRef                   = useRef(null);
  const sourceNodeRef                 = useRef(null);

  /* request mic once on mount */
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        setPermission("granted");
        setStream(s);
      })
      .catch(() => setPermission("denied"));

    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  /* create audio-context & node when stream arrives */
  useEffect(() => {
    if (!stream) return;

    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate,
    });
    sourceNodeRef.current = audioCtxRef.current.createMediaStreamSource(stream);
  }, [stream, sampleRate]);

  const connect = useCallback((destNode /* AudioNode */) => {
    sourceNodeRef.current?.connect(destNode);
  }, []);

  return { permission, stream, audioCtx: audioCtxRef.current, connect };
}
