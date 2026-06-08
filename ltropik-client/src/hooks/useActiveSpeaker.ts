import { useEffect, useRef, useState } from 'react';

interface Source { id: string; stream: MediaStream | null; }

const SPEAKING_THRESHOLD = 18; // avg byte volume (0–255) above which we count it
const SAMPLE_MS = 200;

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Detects which participants are currently talking by sampling each audio
 * stream's volume with a Web Audio analyser. Returns the set of speaking ids.
 * Analysers only read levels (never connected to destination) so there's no echo.
 */
export function useActiveSpeaker(sources: Source[]): Set<string> {
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Map<string, { src: MediaStreamAudioSourceNode; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(new Map());

  // (Re)build analysers as streams come and go.
  useEffect(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const nodes = nodesRef.current;

    const live = new Set<string>();
    for (const { id, stream } of sources) {
      if (!stream || stream.getAudioTracks().length === 0) continue;
      live.add(id);
      if (nodes.has(id)) continue;
      try {
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        nodes.set(id, { src, analyser, data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) });
      } catch { /* stream may have no usable audio */ }
    }
    // Drop analysers for streams that went away.
    for (const id of [...nodes.keys()]) {
      if (!live.has(id)) { try { nodes.get(id)!.src.disconnect(); } catch { /* ignore */ } nodes.delete(id); }
    }
  }, [sources]);

  // Poll volumes on an interval.
  useEffect(() => {
    const interval = setInterval(() => {
      const next = new Set<string>();
      for (const [id, { analyser, data }] of nodesRef.current) {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        if (sum / data.length > SPEAKING_THRESHOLD) next.add(id);
      }
      setSpeaking((prev) => (sameSet(prev, next) ? prev : next));
    }, SAMPLE_MS);
    return () => clearInterval(interval);
  }, []);

  // Tear down the context on unmount.
  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); }, []);

  return speaking;
}
