import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Stroke } from '../../hooks/useWebRTC';
import { cx } from '../ui';

interface Props {
  strokes: Stroke[];
  clearSignal: number;
  onStroke: (stroke: Stroke) => void;
  onClear: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle' | 'arrow' | 'text' | 'sticky';

const COLORS = [
  '#1a1a2e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6535f6', '#ec4899', '#ffffff', '#94a3b8',
];
const STICKY_COLORS = ['#fef08a', '#86efac', '#93c5fd', '#f9a8d4', '#d8b4fe'];
const WIDTHS = [2, 4, 8, 16];

function shadeColor(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + pct));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + pct));
  const b = Math.max(0, Math.min(255, (n & 0xff) + pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (!s.points.length) return;
  ctx.save();
  ctx.strokeStyle = s.tool === 'eraser' ? '#ffffff' : s.color;
  ctx.fillStyle   = s.color;
  ctx.lineWidth   = s.width;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';

  if (s.tool === 'pen' || s.tool === 'eraser') {
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    s.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

  } else if (s.tool === 'line' && s.points.length >= 2) {
    const [a, b] = [s.points[0], s.points[s.points.length - 1]];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();

  } else if (s.tool === 'arrow' && s.points.length >= 2) {
    const [a, b] = [s.points[0], s.points[s.points.length - 1]];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const headLen = Math.min(s.width * 6, 32);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - headLen * Math.cos(angle - Math.PI / 7), b.y - headLen * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(b.x - headLen * Math.cos(angle + Math.PI / 7), b.y - headLen * Math.sin(angle + Math.PI / 7));
    ctx.closePath(); ctx.fill();

  } else if (s.tool === 'rect' && s.points.length >= 2) {
    const [a, b] = [s.points[0], s.points[s.points.length - 1]];
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

  } else if (s.tool === 'circle' && s.points.length >= 2) {
    const [a, b] = [s.points[0], s.points[s.points.length - 1]];
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    ctx.beginPath();
    ctx.ellipse(Math.min(a.x, b.x) + rx, Math.min(a.y, b.y) + ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

  } else if (s.tool === 'text' && s.text && s.points.length) {
    const fs = s.fontSize ?? 20;
    ctx.font = `${fs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = s.color;
    ctx.globalCompositeOperation = 'source-over';
    const maxW = 500;
    const words = s.text.split(' ');
    let line = '', lineY = s.points[0].y;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line.trim(), s.points[0].x, lineY);
        line = w + ' '; lineY += fs * 1.4;
      } else { line = test; }
    }
    if (line.trim()) ctx.fillText(line.trim(), s.points[0].x, lineY);

  } else if (s.tool === 'sticky' && s.text && s.points.length) {
    const x = s.points[0].x, y = s.points[0].y;
    const W = 200, H = 130, pad = 12, fs = 14;
    ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowOffsetY = 4;
    ctx.fillStyle = s.bgColor ?? '#fef08a';
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, W, H, 10) : ctx.rect(x, y, W, H);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = shadeColor(s.bgColor ?? '#fef08a', -22);
    ctx.fillRect(x, y, W, 24);
    ctx.fillStyle = '#1a1a2e';
    ctx.font = `${fs}px Inter, system-ui, sans-serif`;
    const words2 = s.text.split(' ');
    let line2 = '', lineY2 = y + 44;
    for (const w of words2) {
      const test = line2 + w + ' ';
      if (ctx.measureText(test).width > W - pad * 2 && line2) {
        ctx.fillText(line2.trim(), x + pad, lineY2);
        line2 = w + ' '; lineY2 += fs * 1.5;
        if (lineY2 > y + H - pad) break;
      } else { line2 = test; }
    }
    if (line2.trim()) ctx.fillText(line2.trim(), x + pad, lineY2);
  }
  ctx.restore();
}

function TBtn({ active, title, onClick, children, danger }: {
  active?: boolean; title: string; onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <button title={title} onClick={onClick}
      className={cx(
        'w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all',
        danger   ? 'hover:bg-rose-100 text-rose-500'
        : active ? 'bg-brand-600 text-white shadow-sm'
        : 'hover:bg-ink-100 text-ink-600 hover:text-ink-800'
      )}>
      {children}
    </button>
  );
}

interface TextPos { screenX: number; screenY: number; canvasX: number; canvasY: number; }

export function Whiteboard({ strokes, clearSignal, onStroke, onClear, fullscreen, onToggleFullscreen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool]           = useState<Tool>('pen');
  const [color, setColor]         = useState('#1a1a2e');
  const [stickyColor, setStickyColor] = useState('#fef08a');
  const [width, setWidth]         = useState(3);
  const [fontSize, setFontSize]   = useState(20);
  const [drawing, setDrawing]     = useState(false);
  const [textPos, setTextPos]     = useState<TextPos | null>(null);
  const [textValue, setTextValue] = useState('');
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);

  const curStroke = useRef<{ x: number; y: number }[]>([]);
  const startPt   = useRef<{ x: number; y: number } | null>(null);
  const snapshot  = useRef<ImageData | null>(null);

  // ── Redraw ─────────────────────────────────────────────────────────────────
  const redrawAll = useCallback((list: Stroke[]) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    list.forEach(s => drawStroke(ctx, s));
  }, []);

  useEffect(() => { redrawAll(strokes); }, [strokes, redrawAll]);
  useEffect(() => { redrawAll([]); }, [clearSignal]); // eslint-disable-line

  // ── Position helpers ───────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  // ── Text click ─────────────────────────────────────────────────────────────
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'text' && tool !== 'sticky') return;
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    setTextPos({
      screenX: e.clientX - r.left,
      screenY: e.clientY - r.top,
      canvasX: (e.clientX - r.left) * sx,
      canvasY: (e.clientY - r.top) * sy,
    });
    setTextValue('');
  };

  const commitText = useCallback(() => {
    if (!textPos || !textValue.trim()) { setTextPos(null); return; }
    const s: Stroke = {
      tool: tool as 'text' | 'sticky',
      color,
      width,
      fontSize,
      bgColor: tool === 'sticky' ? stickyColor : undefined,
      text: textValue.trim(),
      points: [{ x: textPos.canvasX, y: textPos.canvasY }],
    };
    setUndoStack(u => [...u, strokes]);
    onStroke(s);
    setTextPos(null);
    setTextValue('');
  }, [textPos, textValue, tool, color, width, fontSize, stickyColor, onStroke, strokes]);

  // ── Draw events ────────────────────────────────────────────────────────────
  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'text' || tool === 'sticky') return;
    e.preventDefault();
    setDrawing(true);
    const pos = getPos(e);
    startPt.current = pos;
    curStroke.current = [pos];
    if (tool !== 'pen' && tool !== 'eraser') {
      snapshot.current = canvasRef.current!.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, 2400, 1400);
    }
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d', { willReadFrequently: true })!;

    if (tool === 'pen' || tool === 'eraser') {
      curStroke.current.push(pos);
      ctx.save();
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const pts = curStroke.current;
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      if (!startPt.current) return;
      if (snapshot.current) ctx.putImageData(snapshot.current, 0, 0);
      curStroke.current = [startPt.current, pos];
      drawStroke(ctx, { tool, color, width, points: curStroke.current });
    }
  };

  const onUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);
    const pts = curStroke.current;
    if (pts.length < 1) { curStroke.current = []; snapshot.current = null; return; }
    const s: Stroke = { tool, color, width, points: [...pts] };
    setUndoStack(u => [...u, strokes]);
    onStroke(s);
    snapshot.current = null;
    curStroke.current = [];
  };

  // ── Undo ───────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    redrawAll(undoStack[undoStack.length - 1]);
    setUndoStack(u => u.slice(0, -1));
  }, [undoStack, redrawAll]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportPNG = () => {
    const c = canvasRef.current; if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `whiteboard_${Date.now()}.png`;
    a.click();
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      const map: Record<string, Tool> = { p: 'pen', e: 'eraser', t: 'text', l: 'line', r: 'rect', a: 'arrow' };
      if (map[e.key]) setTool(map[e.key]);
      if (e.key === 'Escape') setTextPos(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo]);

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const TOOLS: [Tool, string, string][] = [
    ['pen',    '✏️',  'Олівець (P)'],
    ['eraser', '⬛',  'Гумка (E)'],
    ['line',   '╱',   'Лінія (L)'],
    ['arrow',  '→',   'Стрілка (A)'],
    ['rect',   '▭',   'Прямокутник (R)'],
    ['circle', '◯',   'Еліпс'],
    ['text',   'T',   'Текст (T)'],
    ['sticky', '📌',  'Стікер'],
  ];

  const toolbar = (
    <div className="flex items-center gap-2 px-3 py-2 flex-wrap flex-shrink-0 border-b border-ink-100 bg-ink-50/80">
      {/* Tool buttons */}
      <div className="flex items-center gap-0.5 bg-white rounded-xl border border-ink-100 p-1 shadow-sm">
        {TOOLS.map(([t, ic, label]) => (
          <TBtn key={t} active={tool === t} title={label} onClick={() => setTool(t)}>
            <span className={t === 'text' ? 'font-black text-[13px]' : 'text-base'}>{ic}</span>
          </TBtn>
        ))}
      </div>

      {/* Width */}
      {tool !== 'text' && tool !== 'sticky' && (
        <div className="flex items-center gap-0.5 bg-white rounded-xl border border-ink-100 p-1 shadow-sm">
          {WIDTHS.map(w => (
            <button key={w} onClick={() => setWidth(w)}
              className={cx('w-8 h-8 rounded-lg flex items-center justify-center transition',
                width === w ? 'bg-brand-50 ring-1 ring-brand-300' : 'hover:bg-ink-50')}>
              <div className="rounded-full bg-ink-800" style={{ width: Math.min(w * 2.2, 22), height: Math.min(w * 2.2, 22) }} />
            </button>
          ))}
        </div>
      )}

      {/* Font size for text */}
      {tool === 'text' && (
        <select value={fontSize} onChange={e => setFontSize(+e.target.value)}
          className="h-8 rounded-xl border border-ink-200 bg-white text-xs px-2 shadow-sm">
          {[12, 16, 20, 28, 36, 48, 64].map(f => <option key={f} value={f}>{f}px</option>)}
        </select>
      )}

      {/* Colors */}
      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-ink-100 px-2 py-1 shadow-sm">
        {(tool === 'sticky' ? STICKY_COLORS : COLORS).map(c => (
          <button key={c} onClick={() => tool === 'sticky' ? setStickyColor(c) : setColor(c)}
            className={cx('w-5 h-5 rounded-full border-2 transition-all hover:scale-110',
              (tool === 'sticky' ? stickyColor : color) === c
                ? 'border-brand-600 scale-125 shadow-sm'
                : 'border-transparent')}
            style={{ background: c === '#ffffff' ? '#e8eaf0' : c }} />
        ))}
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-0.5 bg-white rounded-xl border border-ink-100 p-1 shadow-sm">
        <TBtn title="Скасувати (Ctrl+Z)" onClick={undo}>↩️</TBtn>
        <TBtn title="Зберегти PNG" onClick={exportPNG}>💾</TBtn>
        <TBtn title="Очистити все" danger onClick={onClear}>🗑</TBtn>
        {onToggleFullscreen && (
          <TBtn title={fullscreen ? 'Згорнути (Esc)' : 'На весь екран'} onClick={onToggleFullscreen}>
            {fullscreen ? '⊡' : '⛶'}
          </TBtn>
        )}
      </div>
    </div>
  );

  const cursor = tool === 'eraser' ? 'cell' : (tool === 'text' || tool === 'sticky') ? 'text' : 'crosshair';

  const content = (
    <div className="flex flex-col h-full" style={{ background: '#fff' }}>
      {toolbar}

      <div className="flex-1 relative overflow-hidden" style={{ cursor }}>
        <canvas
          ref={canvasRef}
          width={2400}
          height={1400}
          className="w-full h-full"
          style={{ touchAction: 'none', display: 'block' }}
          onClick={handleCanvasClick}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        />

        {/* Floating text / sticky editor */}
        <AnimatePresence>
          {textPos && (
            <motion.div
              key="text-editor"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute z-20 drop-shadow-2xl"
              style={{ left: Math.min(textPos.screenX, window.innerWidth - 260), top: Math.min(textPos.screenY, window.innerHeight - 220) }}
            >
              {tool === 'text' ? (
                <div className="bg-white rounded-2xl shadow-2xl border border-brand-200 overflow-hidden w-64">
                  <div className="px-3 py-2 bg-brand-50 border-b border-brand-100 flex items-center gap-2">
                    <span className="text-brand-600 font-bold text-sm">✏️ Текст</span>
                    <span className="text-xs text-ink-400 ml-auto">Enter — додати · Esc — закрити</span>
                  </div>
                  <textarea
                    autoFocus
                    value={textValue}
                    onChange={e => setTextValue(e.target.value)}
                    onBlur={commitText}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
                      if (e.key === 'Escape') setTextPos(null);
                    }}
                    rows={4}
                    placeholder="Введіть текст… (Shift+Enter — новий рядок)"
                    className="w-full resize-none p-3 text-ink-900 outline-none text-sm bg-white"
                  />
                  <div className="flex gap-2 p-2 border-t border-ink-100 bg-ink-50">
                    <button onClick={() => setTextPos(null)} className="flex-1 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-ink-100 transition">Скасувати</button>
                    <button onClick={commitText} className="flex-1 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition">Додати</button>
                  </div>
                </div>
              ) : (
                /* Sticky note editor */
                <div className="rounded-2xl shadow-2xl overflow-hidden w-52 border-2" style={{ borderColor: shadeColor(stickyColor, -30), background: stickyColor }}>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-ink-700 flex items-center gap-1.5"
                    style={{ background: shadeColor(stickyColor, -20) }}>
                    📌 Стікер
                    <div className="flex gap-1 ml-auto">
                      {STICKY_COLORS.map(c => (
                        <button key={c} onClick={() => setStickyColor(c)}
                          className={cx('w-4 h-4 rounded-full border transition', stickyColor === c ? 'border-ink-600 scale-110' : 'border-transparent')}
                          style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <textarea
                    autoFocus
                    value={textValue}
                    onChange={e => setTextValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') setTextPos(null);
                      if (e.key === 'Enter' && e.ctrlKey) commitText();
                    }}
                    rows={4}
                    placeholder="Текст нотатки…"
                    className="w-full resize-none p-3 text-ink-900 outline-none text-sm bg-transparent"
                  />
                  <div className="flex gap-2 p-2" style={{ background: shadeColor(stickyColor, -10) }}>
                    <button onClick={() => setTextPos(null)} className="flex-1 py-1.5 rounded-xl text-xs text-ink-500 hover:bg-black/10 transition">Скасувати</button>
                    <button onClick={commitText} className="flex-1 py-1.5 rounded-xl text-xs font-bold text-ink-800 bg-white/60 hover:bg-white/80 transition">Додати</button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl border border-ink-100 shadow-sm px-2 py-1 bg-white/95 backdrop-blur-sm">
          <button onClick={() => { const c = canvasRef.current; if (c) c.style.transform = `scale(${Math.max(0.5, parseFloat(c.style.transform?.match(/[\d.]+/)?.[0] ?? '1') - 0.1)})`; }}
            className="w-6 h-6 text-ink-500 hover:text-ink-800 font-bold text-lg flex items-center justify-center">−</button>
          <button onClick={() => { const c = canvasRef.current; if (c) c.style.transform = 'scale(1)'; }}
            className="text-[10px] text-ink-400 hover:text-brand-600 transition w-8 text-center">100%</button>
          <button onClick={() => { const c = canvasRef.current; if (c) c.style.transform = `scale(${Math.min(3, parseFloat(c.style.transform?.match(/[\d.]+/)?.[0] ?? '1') + 0.1)})`; }}
            className="w-6 h-6 text-ink-500 hover:text-ink-800 font-bold text-lg flex items-center justify-center">+</button>
        </div>

        {/* Hint bar */}
        {(tool === 'text' || tool === 'sticky') && !textPos && (
          <div className="absolute bottom-3 left-3 text-[11px] text-ink-400 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-ink-100">
            {tool === 'text' ? '🖊 Клікни на дошку щоб додати текст' : '📌 Клікни на дошку щоб додати стікер'}
          </div>
        )}

        {/* Collaborative indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Спільна · зміни видно всім
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200]"
        style={{ background: '#fff' }}
      >
        <div className="h-full flex flex-col">
          {content}
        </div>
      </motion.div>,
      document.body
    );
  }

  return <div className="h-full rounded-2xl overflow-hidden border border-ink-100 shadow-sm">{content}</div>;
}
