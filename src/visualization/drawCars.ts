// 자동차: 단순한 탑다운 실루엣 + 앞유리(방향 표시) + 번호.
// 차체 크기는 물리 충돌 크기(CAR.length × CAR.width)와 같다. 강조 효과(선택 테두리·금색)는 차체 밖에 그리지만
// 물리·충돌 크기와는 무관한 그림일 뿐이다.

import { CAR } from '../simulation/params';
import { CAR_STRIDE, END_CODES, type Snapshot } from '../workers/protocol';
import { drawGoldAura } from './effects';
import { worldToScreen, type Viewport } from './viewport';

export const GOLD = '#f2c14e';
export const SELECT_COLOR = '#3cc8d8';

/** 번호마다 구분되는 색 (황금각으로 색상환을 고르게 나눈다) */
export function carColor(id: number): string {
  const hue = (id * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 72%, 60%)`;
}

export interface DrawOptions {
  /** 선택된 차 번호 */
  selection: readonly number[];
  /** 애니메이션 시간 (ms) */
  time: number;
}

export function drawCars(ctx: CanvasRenderingContext2D, snapshot: Snapshot, view: Viewport, options: DrawOptions) {
  const n = snapshot.ids.length;
  const selected = new Set(options.selection);
  const champion = snapshot.championIndex;
  // 그리는 순서: 종료된 차 → 달리는 차 → 선택된 차 → 챔피언 (나중 것이 위)
  const priority = (i: number) => {
    if (i === champion) return 3;
    if (selected.has(snapshot.ids[i]!)) return 2;
    return snapshot.data[i * CAR_STRIDE + 4]! === 0 ? 1 : 0;
  };
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => priority(a) - priority(b));

  // 금색 오라는 모든 차체 아래에 깐다
  if (champion >= 0) {
    const o = champion * CAR_STRIDE;
    drawGoldAura(ctx, view, snapshot.data[o]!, snapshot.data[o + 1]!, snapshot.data[o + 2]!, options.time, snapshot.data[o + 4]! === 0);
  }

  for (const i of order) {
    const o = i * CAR_STRIDE;
    drawCar(ctx, view, {
      id: snapshot.ids[i]!,
      x: snapshot.data[o]!,
      y: snapshot.data[o + 1]!,
      heading: snapshot.data[o + 2]!,
      endReason: END_CODES[snapshot.data[o + 4]!] ?? null,
      champion: i === champion,
      selected: selected.has(snapshot.ids[i]!),
    });
  }
  // 번호는 차체를 모두 그린 뒤, 위에 있는 차부터 겹치지 않는 것만 그린다
  const placed: Rect[] = [];
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k]!;
    const o = i * CAR_STRIDE;
    const p = worldToScreen(view, { x: snapshot.data[o]!, y: snapshot.data[o + 1]! });
    const force = priority(i) >= 2;
    drawLabel(ctx, view, snapshot.ids[i]!, p.x, p.y, snapshot.data[o + 4]! !== 0, placed, force);
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
  force: boolean,
) {
  const fontSize = Math.max(8, Math.min(12, CAR.length * view.scale * 0.75));
  const text = String(id);
  const halfW = (fontSize * 0.62 * text.length) / 2 + 1;
  const halfH = fontSize / 2;
  const rect = { x0: x - halfW, y0: y - halfH, x1: x + halfW, y1: y + halfH };
  if (!force && placed.some((r) => r.x0 < rect.x1 && rect.x0 < r.x1 && r.y0 < rect.y1 && rect.y0 < r.y1)) return;
  placed.push(rect);

  ctx.save();
  ctx.globalAlpha = ended && !force ? 0.6 : 1;
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

interface CarDraw {
  id: number;
  x: number;
  y: number;
  heading: number;
  endReason: string | null;
  champion: boolean;
  selected: boolean;
}

/** 차체와 종료 표시 (번호는 drawLabel) */
function drawCar(ctx: CanvasRenderingContext2D, view: Viewport, car: CarDraw) {
  const p = worldToScreen(view, car);
  const len = CAR.length * view.scale;
  const wid = CAR.width * view.scale;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-car.heading);

  // 선택 테두리: 금색과 구분되는 청록색 둥근 테두리
  if (car.selected) {
    ctx.strokeStyle = SELECT_COLOR;
    ctx.lineWidth = 2;
    roundRect(ctx, -len / 2 - 3, -wid / 2 - 3, len + 6, wid + 6, 4);
    ctx.stroke();
  }

  ctx.globalAlpha = car.endReason && !car.champion && !car.selected ? 0.5 : 1;
  // 차체
  ctx.fillStyle = car.champion ? GOLD : carColor(car.id);
  roundRect(ctx, -len / 2, -wid / 2, len, wid, Math.min(wid * 0.35, 3));
  ctx.fill();
  ctx.strokeStyle = car.champion ? '#fff3c4' : 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 앞유리: 진행 방향 쪽
  ctx.fillStyle = 'rgba(10, 16, 28, 0.75)';
  ctx.fillRect(len * 0.08, -wid * 0.32, len * 0.2, wid * 0.64);
  ctx.restore();

  drawEndMark(ctx, p.x, p.y, Math.max(3, wid * 0.6), car.endReason);
}

/** 종료 사유 표시: 벽 충돌 ✕(빨강), 브레이크 정지 ■(주황), 완주 ✓(초록), 안전 종료 ○(회색) */
export function drawEndMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, reason: string | null) {
  if (!reason) return;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  switch (reason) {
    case 'wall':
      ctx.strokeStyle = 'rgba(239, 107, 107, 0.95)';
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
      break;
    case 'brake':
      ctx.fillStyle = 'rgba(245, 158, 66, 0.95)';
      ctx.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
      break;
    case 'finish':
      ctx.strokeStyle = 'rgba(74, 210, 149, 1)';
      ctx.lineWidth = 2;
      ctx.moveTo(x - r, y);
      ctx.lineTo(x - r * 0.2, y + r * 0.8);
      ctx.lineTo(x + r * 1.1, y - r * 0.9);
      ctx.stroke();
      break;
    default:
      ctx.strokeStyle = 'rgba(160, 170, 185, 0.9)';
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
  }
  ctx.restore();
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
