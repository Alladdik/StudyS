import { useCallback, useRef, useState } from 'react';
import { uploadFile } from '../api/upload';

// ── MIME type detection ───────────────────────────────────────────────────────
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=h264',
  'video/webm',
  'video/mp4;codecs=h264,aac',
  'video/mp4',
];
function getSupportedMime(): string {
  for (const m of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const DB_NAME = 'ltropik-rec-v2';
const STORE   = 'chunks';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(new Error('IndexedDB open failed'));
  });
}
async function saveChunk(db: IDBDatabase, sid: string, chunk: Blob) {
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ sid, chunk, ts: Date.now() });
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}
async function loadChunks(db: IDBDatabase, sid: string): Promise<Blob[]> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      res((req.result as { sid: string; chunk: Blob }[]).filter(r => r.sid === sid).map(r => r.chunk));
    req.onerror = () => rej(req.error);
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export type RecordingState = 'idle' | 'recording' | 'stopping' | 'uploading' | 'done' | 'error';

export function useRecording(stream: MediaStream | null) {
  const [state, setState]       = useState<RecordingState>('idle');
  const [progress, setProgress] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const sessionRef  = useRef('');
  const dbRef       = useRef<IDBDatabase | null>(null);
  const mimeRef     = useRef('');

  const recording = state === 'recording';
  const uploading = state === 'uploading' || state === 'stopping';

  const startRecording = useCallback(async () => {
    setErrorMsg(null);

    if (!stream) {
      setErrorMsg('Немає потоку для запису — увімкніть камеру або мікрофон');
      setState('error');
      return;
    }
    const live = stream.getTracks().filter(t => t.readyState === 'live');
    if (live.length === 0) {
      setErrorMsg('Усі треки зупинені — увімкніть камеру або мікрофон');
      setState('error');
      return;
    }

    let db: IDBDatabase;
    try { db = await openDB(); dbRef.current = db; }
    catch { setErrorMsg('Не вдалося відкрити IndexedDB'); setState('error'); return; }

    const sid  = `rec_${Date.now()}`;
    sessionRef.current = sid;
    const mime = getSupportedMime();
    mimeRef.current = mime;
    setRecordingUrl(null);
    setProgress(0);

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    } catch {
      try { recorder = new MediaRecorder(stream); }
      catch (e2) { setErrorMsg(`Браузер не підтримує запис: ${e2}`); setState('error'); return; }
    }

    recorderRef.current = recorder;
    recorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0) await saveChunk(db, sid, e.data).catch(() => {});
    };
    recorder.onerror = () => { setErrorMsg('Помилка під час запису'); setState('error'); };

    // Auto-stop when tracks end (e.g. screen share stopped)
    live.forEach(t => { t.onended = () => { if (state === 'recording') stopAndUpload(); }; });

    recorder.start(2000);
    setState('recording');
  }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopAndUpload = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setState('stopping');

    await new Promise<void>(resolve => { recorder.onstop = () => resolve(); recorder.stop(); });

    setState('uploading');
    setProgress(0);

    try {
      const chunks = await loadChunks(dbRef.current!, sessionRef.current);
      if (chunks.length === 0) { setErrorMsg('Немає записаних даних'); setState('error'); return; }

      const mime = mimeRef.current || 'video/webm';
      const ext  = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mime });
      const file = new File([blob], `lesson_${sessionRef.current}.${ext}`, { type: mime });

      const r = await uploadFile(file, pct => setProgress(pct));
      setRecordingUrl(r.data.url);
      setState('done');
    } catch (err) {
      console.error('Recording upload failed:', err);
      setErrorMsg('Не вдалося завантажити запис. Спробуйте ще раз.');
      setState('error');
    }
  }, []);

  const reset = useCallback(() => { setState('idle'); setErrorMsg(null); setProgress(0); setRecordingUrl(null); }, []);

  return { recording, uploading, recordingUrl, recordingState: state, recordingProgress: progress, recordingError: errorMsg, startRecording, stopAndUpload, reset };
}
