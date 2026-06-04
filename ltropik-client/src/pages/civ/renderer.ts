import { useLayoutEffect, useRef } from 'react';
import type { GameState, FloatText } from './types';
import { TERRAIN, canPass } from './terrain';
import { UNITS } from './units';
import { hexToPixel, hexCorners, hexDist, COLS, ROWS, HEX_SIZE } from './mapGen';

export function useRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  game: GameState,
  hovered: { col: number; row: number } | null,
  floats: FloatText[],
  frameRef: React.MutableRefObject<number>,
) {
  const tickRef = useRef(0);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    tickRef.current++;
    const tick = tickRef.current;
    const W = canvas.width;
    const H = canvas.height;

    // ── Background gradient ──────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0e1a');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const sel = game.units.find(u => u.id === game.selectedUnitId);
    const now = Date.now();

    // ── Draw hex grid ────────────────────────────────────────────────────────
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = game.grid[r]?.[c];
        if (!cell) continue;
        const { x, y } = hexToPixel(c, r);
        const corners = hexCorners(x, y);

        const drawHex = (fill: string | CanvasGradient, stroke: string, alpha = 1) => {
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        };

        // Unexplored fog
        if (!cell.explored) {
          const fogGrad = ctx.createRadialGradient(x, y, 0, x, y, HEX_SIZE);
          fogGrad.addColorStop(0, '#1e293b');
          fogGrad.addColorStop(1, '#0f172a');
          drawHex(fogGrad, '#1e293b');
          ctx.font = '11px Arial';
          ctx.fillStyle = '#334155';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', x, y);
          continue;
        }

        const td = TERRAIN[cell.terrain];

        // Terrain gradient fill
        const grad = ctx.createRadialGradient(x - HEX_SIZE * 0.3, y - HEX_SIZE * 0.3, 0, x, y, HEX_SIZE);
        const lighten = (hex: string) => hex; // could lighten but keep simple
        grad.addColorStop(0, lighten(td.color) + 'ee');
        grad.addColorStop(1, td.color + 'cc');
        drawHex(grad, td.borderColor);

        // Glow for special tiles
        if (td.glowColor) {
          const pulseAlpha = 0.15 + 0.08 * Math.sin(tick * 0.08 + c + r);
          ctx.globalAlpha = pulseAlpha;
          ctx.beginPath();
          ctx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
          ctx.closePath();
          ctx.fillStyle = td.glowColor;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Animated river wave
        if (cell.terrain === 'river') {
          ctx.globalAlpha = 0.3 + 0.15 * Math.sin(tick * 0.12 + c * 0.7);
          ctx.beginPath();
          ctx.arc(x, y + 2 * Math.sin(tick * 0.1 + c), 6, 0, Math.PI * 2);
          ctx.fillStyle = '#7dd3fc';
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Reachable / attackable overlay for selected unit
        if (sel && !sel.hasActed) {
          const dist = hexDist(sel.col, sel.row, c, r);
          const tu = game.units.find(u => u.col === c && u.row === r);
          const def = UNITS[sel.type];

          if (dist > 0 && dist <= sel.moves && !tu && canPass(cell.terrain, sel.type, game.effects, game.civId)) {
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(corners[0][0], corners[0][1]);
            for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
            ctx.closePath();
            ctx.fillStyle = '#22c55e';
            ctx.fill();
            ctx.globalAlpha = 1;
          } else if (tu && tu.owner !== 'player' && dist <= (def.range ?? 1)) {
            // Pulse attack overlay
            const pulse = 0.3 + 0.15 * Math.sin(tick * 0.15);
            ctx.globalAlpha = pulse;
            ctx.beginPath();
            ctx.moveTo(corners[0][0], corners[0][1]);
            for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
            ctx.closePath();
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }

        // Hover
        if (hovered?.col === c && hovered?.row === r) {
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
          ctx.closePath();
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Terrain icon
        ctx.font = `${HEX_SIZE * 0.68}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(td.icon, x, y + 1);

        // Resource indicator
        if (cell.resource && !cell.harvested) {
          const resIcons: Record<string, string> = { food: '🌾', iron: '⚙️', stone: '🪨', gold: '💛' };
          ctx.font = '9px Arial';
          ctx.fillText(resIcons[cell.resource], x + HEX_SIZE * 0.55, y - HEX_SIZE * 0.55);
        }

        // Barbarian camp pulse
        if (cell.hasCamp) {
          ctx.globalAlpha = 0.4 + 0.3 * Math.sin(tick * 0.2 + c);
          ctx.beginPath();
          ctx.arc(x, y, HEX_SIZE * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#dc2626';
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Coordinates (debug, small)
        // ctx.font = '7px Arial'; ctx.fillStyle='#ffffff33'; ctx.fillText(`${c},${r}`,x,y+HEX_SIZE*0.7);
      }
    }

    // ── Draw units ───────────────────────────────────────────────────────────
    for (const u of game.units) {
      if (!game.grid[u.row]?.[u.col]?.explored) continue;
      const { x, y } = hexToPixel(u.col, u.row);
      const isSelected = u.id === game.selectedUnitId;
      const def = UNITS[u.type];

      // Selection pulse ring
      if (isSelected) {
        const pulseR = HEX_SIZE * 0.65 + 3 * Math.sin(tick * 0.18);
        ctx.beginPath();
        ctx.arc(x, y - 3, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(tick * 0.18);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Shadow
      ctx.beginPath();
      ctx.ellipse(x, y + 8, 11, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      // Unit circle with gradient
      const unitGrad = ctx.createRadialGradient(x - 4, y - 8, 0, x, y - 3, 14);
      const baseColor =
        u.owner === 'player'
          ? (u.type === 'hero' ? '#f59e0b' : u.type === 'aiUnit' ? '#a855f7' : u.type === 'cavalry' ? '#06b6d4' : '#3b82f6')
          : u.owner === 'barbarian'
          ? (u.type === 'barbarianChief' ? '#7c2d12' : '#7f1d1d')
          : (u.type === 'darkness' ? '#450a0a' : '#dc2626');

      unitGrad.addColorStop(0, baseColor + 'ff');
      unitGrad.addColorStop(1, baseColor + '88');

      ctx.beginPath();
      ctx.arc(x, y - 3, 13, 0, Math.PI * 2);
      ctx.fillStyle = unitGrad;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Unit icon
      ctx.font = `${HEX_SIZE * 0.56}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, x, y - 3);

      // Level badge
      const level = u.level ?? 1;
      if (level > 1) {
        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`L${level}`, x + 10, y - 13);
      }

      // HP bar
      const bw = 24, bh = 3;
      const bx = x - bw / 2, by = y + 11;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(bx, by, bw, bh);
      const hpRatio = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = hpRatio > 0.6 ? '#22c55e' : hpRatio > 0.3 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(bx, by, bw * hpRatio, bh);

      // XP bar (thin, below HP)
      if (u.owner === 'player' && u.xp !== undefined) {
        const xpRatio = ((u.xp ?? 0) % 30) / 30;
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(bx, by + 4, bw, 2);
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(bx, by + 4, bw * xpRatio, 2);
      }

      // Status icons
      if (u.distracted) {
        ctx.font = '10px Arial';
        ctx.fillText('😵', x + 12, y - 14);
      }
      if (u.hasActed && u.owner === 'player') {
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(x, y - 3, 13, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // ── Floating damage/heal texts ───────────────────────────────────────────
    for (const ft of floats) {
      const age = now - ft.born;
      if (age > 1200) continue;
      const alpha = 1 - age / 1200;
      const dy = -age / 60;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y + dy);
      ctx.globalAlpha = 1;
    }

  }, [game, hovered, floats, canvasRef, frameRef]);
}

export function useMinimap(
  minimapRef: React.RefObject<HTMLCanvasElement | null>,
  game: GameState,
) {
  useLayoutEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const cw = W / COLS;
    const ch = H / ROWS;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = game.grid[r]?.[c];
        if (!cell) continue;
        if (!cell.explored) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(c * cw, r * ch, cw - 0.5, ch - 0.5);
          continue;
        }
        const td = TERRAIN[cell.terrain];
        ctx.fillStyle = td.color;
        ctx.fillRect(c * cw, r * ch, cw - 0.5, ch - 0.5);
      }
    }

    // Draw units as dots
    for (const u of game.units) {
      const color = u.owner === 'player' ? '#60a5fa' : u.owner === 'barbarian' ? '#f97316' : '#f87171';
      ctx.beginPath();
      ctx.arc(u.col * cw + cw / 2, u.row * ch + ch / 2, Math.max(cw * 0.6, 2), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }, [game, minimapRef]);
}
