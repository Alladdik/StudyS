import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadFile } from '../api/upload';

const INTERVAL_MS = 30_000; // screenshot every 30s

export function useProctoring(active: boolean, testAttemptId?: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permitted, setPermitted] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]); // local preview URLs

  const capture = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 320;
    canvas.height = videoRef.current.videoHeight || 240;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const preview = URL.createObjectURL(blob);
      setScreenshots((p) => [...p.slice(-4), preview]);
      if (testAttemptId) {
        const file = new File([blob], `proctor_${testAttemptId}_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await uploadFile(file).catch(() => {});
      }
    }, 'image/jpeg', 0.7);
  }, [testAttemptId]);

  // Start camera
  useEffect(() => {
    if (!active) return;
    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPermitted(true);
      })
      .catch(() => setPermitted(false));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active]);

  // Periodic screenshots
  useEffect(() => {
    if (!active || !permitted) return;
    const id = setInterval(capture, INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, permitted, capture]);

  return { videoRef, permitted, screenshots };
}
