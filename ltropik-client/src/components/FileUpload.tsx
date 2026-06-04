import { useRef, useState } from 'react';
import { uploadFile } from '../api/upload';
import { cx } from './ui';

interface Props {
  onUploaded: (url: string, fileName: string) => void;
  accept?: string;
  label?: string;
}

export function FileUpload({ onUploaded, accept, label = 'Завантажити файл' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    setError('');
    setProgress(0);
    try {
      const r = await uploadFile(file, (pct) => setProgress(pct));
      onUploaded(r.data.url, r.data.fileName);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Помилка завантаження';
      setError(msg);
    } finally {
      setProgress(null);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cx(
          'relative flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition',
          isDragging ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-ink-50'
        )}
      >
        <svg className="w-8 h-8 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-ink-500 font-medium">{label}</p>
        <p className="text-xs text-ink-300">Drag & drop або клікни</p>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onInputChange} />
      </div>

      {progress !== null && (
        <div className="mt-2">
          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 transition-all rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-ink-400 mt-1">{progress}%</p>
        </div>
      )}

      {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
    </div>
  );
}
