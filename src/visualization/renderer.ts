import { add, leftNormal, scale, sub, type Vec } from '../core/vec';
import { CAR } from '../simulation/params';
import { tangentAt } from '../tracks/generate';
import type { GridSlot, Track } from '../tracks/types';
import { worldToScreen, type Viewport } from './viewport';

const COLORS = {
  background: '#0d1420',
  backgroundGrid: 'rgba(255, 255, 255, 0.035)',
  road: '#2b3445',
  wall: '#dfe6f0',
  centerLine: 'rgba(255, 255, 255, 0.12)',
  checkpoint: 'rgba(60, 200, 216, 0.28)',
  slot: 'rgba(255, 255, 255, 0.28)',
  arrow: 'rgba(242, 193, 78, 0.85)',
  message: 'rgba(200, 214, 235, 0.55)',
};

/** 출발 그리드 자리 표시 크기 (m): 차체보다 조금 크게 */
const SLOT_SIZE = { length: CAR.length + 0.6, width: CAR.width + 0.5 };

export function clear(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = COLORS.backgroundGrid;
  ctx.lineWidth = 1;
  const step = 40;
  ctx.beginPath();
  for (let x = 0.5; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0.5; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

export function drawMessage(ctx: CanvasRenderingContext2D, width: number, height: number, text: string) {
  ctx.fillStyle = COLORS.message;
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
}

export function drawTrack(ctx: CanvasRenderingContext2D, track: Track, view: Viewport, slots: GridSlot[]) {
  const toScreen = (p: Vec) => worldToScreen(view, p);

  // 도로: 왼쪽 벽 고리와 오른쪽 벽 고리 사이를 evenodd 로 채운다 (충돌 판정과 같은 경계)
  ctx.beginPath();
  tracePolyline(ctx, track.left.map(toScreen), true);
  tracePolyline(ctx, track.right.map(toScreen), true);
  ctx.fillStyle = COLORS.road;
  ctx.fill('evenodd');

  // 중앙 점선
  ctx.save();
  ctx.setLineDash([6, 10]);
  ctx.strokeStyle = COLORS.centerLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  tracePolyline(ctx, track.center.map(toScreen), true);
  ctx.stroke();
  ctx.restore();

  // 체크포인트
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = COLORS.checkpoint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const gate of track.checkpoints) {
    const a = toScreen(gate.a);
    const b = toScreen(gate.b);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();

  // 벽
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  for (const wall of [track.left, track.right]) {
    ctx.beginPath();
    tracePolyline(ctx, wall.map(toScreen), true);
    ctx.stroke();
  }

  drawStartLine(ctx, track, view);
  drawDirectionArrow(ctx, track, view);
  for (const slot of slots) drawSlot(ctx, slot, view);
}

/** 체크무늬 출발/결승선 */
function drawStartLine(ctx: CanvasRenderingContext2D, track: Track, view: Viewport) {
  const forward = tangentAt(track.center, 0);
  const across = sub(track.startLine.a, track.startLine.b);
  const squares = 9;
  const depth = track.roadWidth / squares;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < squares; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#f4f6fa' : '#11161f';
      const corner = add(add(track.startLine.b, scale(across, col / squares)), scale(forward, row * depth));
      const quad = [
        corner,
        add(corner, scale(across, 1 / squares)),
        add(add(corner, scale(across, 1 / squares)), scale(forward, depth)),
        add(corner, scale(forward, depth)),
      ].map((p) => worldToScreen(view, p));
      ctx.beginPath();
      tracePolyline(ctx, quad, true);
      ctx.fill();
    }
  }
}

/** 출발선 앞에 진행 방향 화살표 */
function drawDirectionArrow(ctx: CanvasRenderingContext2D, track: Track, view: Viewport) {
  const forward = tangentAt(track.center, 0);
  const side = leftNormal(forward);
  const base = add(track.center[0]!, scale(forward, 8));
  const tip = add(base, scale(forward, 9));
  const points = [
    add(base, scale(side, 2.2)),
    add(tip, scale(forward, 0)),
    add(base, scale(side, -2.2)),
  ].map((p) => worldToScreen(view, p));
  ctx.fillStyle = COLORS.arrow;
  ctx.beginPath();
  tracePolyline(ctx, points, true);
  ctx.fill();
}

function drawSlot(ctx: CanvasRenderingContext2D, slot: GridSlot, view: Viewport) {
  const center = worldToScreen(view, slot.position);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(-slot.heading);
  const w = SLOT_SIZE.length * view.scale;
  const h = SLOT_SIZE.width * view.scale;
  ctx.strokeStyle = COLORS.slot;
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function tracePolyline(ctx: CanvasRenderingContext2D, points: Vec[], closed: boolean) {
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (closed) ctx.closePath();
}
