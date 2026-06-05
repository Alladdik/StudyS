import type { ContentBlock } from '../types';

interface Props { block: ContentBlock; }

export function ContentBlockRenderer({ block }: Props) {
  switch (block.type) {
    case 'TextBlock': return <TextBlockView data={block.data} />;
    case 'VideoBlock': return <VideoBlockView data={block.data} />;
    case 'AudioBlock': return <AudioBlockView data={block.data} />;
    case 'CodeSandboxBlock': return <CodeBlockView data={block.data} />;
    case 'FileBlock': return <FileBlockView data={block.data} />;
    default: return null;
  }
}

function TextBlockView({ data }: { data: Record<string, unknown> }) {
  const text = String(data.text ?? data.content ?? '');
  return (
    <div className="max-w-none">
      {text.split('\n').map((line, i) => (
        <p key={i} className="text-ink-700 leading-relaxed mb-2 last:mb-0">{line || <>&nbsp;</>}</p>
      ))}
    </div>
  );
}

function VideoBlockView({ data }: { data: Record<string, unknown> }) {
  const url = String(data.url ?? data.src ?? '');
  const embedUrl = getEmbedUrl(url);
  if (!url) return <div className="bg-ink-50 dark:bg-[#1e2033] rounded-xl p-6 text-center text-ink-400 dark:text-[#6b7394]">Відео не завантажено</div>;
  return embedUrl ? (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
      <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen title={String(data.title ?? 'Відео')} />
    </div>
  ) : (
    <video controls className="w-full rounded-xl" src={url}>Ваш браузер не підтримує відео.</video>
  );
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function AudioBlockView({ data }: { data: Record<string, unknown> }) {
  const url = String(data.url ?? data.src ?? '');
  return (
    <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/40 rounded-xl p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-brand-700 dark:text-brand-400 font-semibold text-sm">
        🎧 {String(data.title ?? 'Аудіо')}
      </div>
      {url ? <audio controls className="w-full" src={url}>Ваш браузер не підтримує аудіо.</audio>
        : <p className="text-ink-400 text-sm">Аудіо не завантажено</p>}
    </div>
  );
}

function CodeBlockView({ data }: { data: Record<string, unknown> }) {
  const code = String(data.code ?? data.content ?? '');
  const language = String(data.language ?? 'javascript');
  const sandboxUrl = String(data.sandboxUrl ?? '');
  return (
    <div className="rounded-xl overflow-hidden border border-ink-800">
      <div className="bg-ink-900 text-ink-300 px-4 py-2.5 text-xs flex items-center justify-between">
        <span className="font-mono flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          </span>
          {language}
        </span>
        {sandboxUrl && (
          <a href={sandboxUrl} target="_blank" rel="noreferrer" className="text-brand-300 hover:text-brand-200">Відкрити пісочницю ↗</a>
        )}
      </div>
      {sandboxUrl ? (
        <iframe src={sandboxUrl} className="w-full h-96 border-0" title="Code Sandbox"
          allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; xr-spatial-tracking"
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts" />
      ) : (
        <pre className="bg-ink-900 text-emerald-300 p-4 text-sm overflow-x-auto font-mono leading-relaxed"><code>{code}</code></pre>
      )}
    </div>
  );
}

function FileBlockView({ data }: { data: Record<string, unknown> }) {
  const url = String(data.url ?? data.src ?? '');
  const name = String(data.name ?? data.fileName ?? 'Файл');
  return (
    <div className="flex items-center gap-3 bg-ink-50 dark:bg-[#1e2033] border border-ink-200 dark:border-[#2d3148] rounded-xl p-4">
      <div className="w-11 h-11 rounded-xl bg-white dark:bg-[#252840] border border-ink-200 dark:border-[#2d3148] flex items-center justify-center text-2xl flex-shrink-0">📎</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-ink-800 dark:text-[#e8eaf0] truncate">{name}</p>
        {data.size !== undefined && <p className="text-xs text-ink-400 dark:text-[#6b7394]">{String(data.size)}</p>}
      </div>
      {url && (
        <a href={url} download className="btn btn-soft py-2 px-3.5 text-xs flex-shrink-0">Завантажити</a>
      )}
    </div>
  );
}
