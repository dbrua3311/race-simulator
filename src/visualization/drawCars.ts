// 자동차: 단순한 탑다운 실루엣 + 앞유리(방향 표시) + 번호.
// 차체 크기는 물리 충돌 크기(CAR.length × CAR.width)와 같다.

import { CAR } from '../simulation/params';
import { CAR_STRIDE, END_CODES, type Snapshot } from '../workers/protocol';
import { worldToScreen, type Viewport } from './viewport';

/** 번호마다 구분되는 색 (황금각으로 색상환을 고르게 나눈다) */
export function carColor(id: number): string {
  const hue = (id * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 72%, 60%)`;
}

export function drawCars(ctx: CanvasRenderingContext2D, snapshot: Snapshot, view: Viewport) {
  const n = snapshot.ids.length;
  const order: number[] = [];
  // 종료된 차를 먼저(아래에) 그리고, 달리는 차를 위에 그린다
  for (const drawEnded of [true, false]) {
    for (let i = 0; i < n; i++) {
      const o = i * CAR_STRIDE;
      if ((snapshot.data[o + 4]! !== 0) !== drawEnded) continue;
      order.push(i);
      drawCar(
        ctx,
        view,
        snapshot.ids[i]!,
        snapshot.data[o]!,
        snapshot.data[o + 1]!,
        snapshot.data[o + 2]!,
        END_CODES[snapshot.data[o + 4]!] ?? null,
      );
    }
  }
  // 번호는 차체를 모두 그린 뒤, 위에 있는 차(달리는 차)부터 겹치지 않는 것만 그린다
  const placed: Rect[] = [];
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k]!;
    const o = i * CAR_STRIDE;
    const p = worldToScreen(view, { x: snapshot.data[o]!, y: snapshot.data[o + 1]! });
    drawLabel(ctx, view, snapshot.ids[i]!, p.x, p.y, snapshot.data[o + 4]! !== 0, placed);
  }
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  id: number,
  x: number,
  y: number,
  ended: boolean,
  placed: Rect[],
) {
  const fontSize = Math.max(8, Math.min(12, CAR.length * view.scale * 0.75));
  const text = String(id);
  const halfW = (fontSize * 0.62 * text.length) / 2 + 1;
  const halfH = fontSize / 2;
  const rect = { x0: x - halfW, y0: y - halfH, x1: x + halfW, y1: y + halfH };
  if (placed.some((r) => r.x0 < rect.x1 && rect.x0 < r.x1 && r.y0 < rect.y1 && rect.y0 < r.y1)) return;
  placed.push(rect);

  ctx.save();
  ctx.globalAlpha = ended ? 0.6 : 1;
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(8, 12, 20, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** 차체와 종료 표시 (번호는 drawLabel) */
function drawCar(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  id: number,
  x: number,
  y: number,
  heading: number,
  endReason: string | null,
) {
  const p = worldToScreen(view, { x, y });
  const len = CAR.length * view.scale;
  const wid = CAR.width * view.scale;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-heading);
  ctx.globalAlpha = endReason ? 0.5 : 1;

  // 차체
  ctx.fillStyle = carColor(id);
  roundRect(ctx, -len / 2, -wid / 2, len, wid, Math.min(wid * 0.35, 3));
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 앞유리: 진행 방향 쪽
  ctx.fillStyle = 'rgba(10, 16, 28, 0.75)';
  ctx.fillRect(len * 0.08, -wid * 0.32, len * 0.2, wid * 0.64);
  ctx.restore();

  // 벽 충돌 표시
  if (endReason === 'wall') {
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 107, 107, 0.9)';
    ctx.lineWidth = 1.5;
    const r = Math.max(3, wid * 0.6);
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y - r);
    ctx.lineTo(p.x + r, p.y + r);
    ctx.moveTo(p.x + r, p.y - r);
    ctx.lineTo(p.x - r, p.y + r);
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
