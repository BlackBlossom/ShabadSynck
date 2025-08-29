/*  Streaming microphone → Google Cloud STT → callback(results)
    ------------------------------------------------------------
    • Requires a signed URL or proxy endpoint that accepts raw PCM
      and returns interim/final transcripts in JSON { lineId, wordId }
*/
import { useEffect, useRef, useState, useCallback } from "react";
import useMicrophone from "./useMicrophone";

export default function useSpeechStream(onTranscript /* (json) => void */) {
  const { permission, audioCtx, connect } = useMicrophone(16_000); // STT prefers 16 kHz
  const [isStreaming, setStreaming] = useState(false);
  const socketRef = useRef(null);

  /* open WS once mic ready */
  const start = useCallback(() => {
    if (permission !== "granted" || !audioCtx || isStreaming) return;

    const ws = new WebSocket(import.meta.env.VITE_STT_WS_URL); // set in .env
    socketRef.current = ws;

    ws.onopen = () => {
      /* down-sample + send Float32 PCM chunks */
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      connect(processor);
      processor.connect(audioCtx.destination); // keep node alive
      processor.onaudioprocess = ({ inputBuffer }) => {
        const pcm = inputBuffer.getChannelData(0);
        ws.readyState === 1 && ws.send(pcm.buffer);
      };
      setStreaming(true);
    };

    ws.onmessage = (e) => {
      try {
        const json = JSON.parse(e.data);
        onTranscript?.(json);
      } catch (_) {}
    };

    ws.onclose = ws.onerror = () => stop();
  }, [permission, audioCtx, connect, isStreaming, onTranscript]);

  const stop = useCallback(() => {
    socketRef.current?.close();
    setStreaming(false);
  }, []);

  /* auto-stop on unmount */
  useEffect(() => () => stop(), [stop]);

  return { isStreaming, start, stop, permission };
}
