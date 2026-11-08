// 고스트 그리기. 차의 위치·충돌 크기를 바꾸지 않는 기록 표시다.

import { CAR } from '../simulation/params';
import { worldToScreen, type Viewport } from './viewport';

/** 고스트: 반투명 흰색 차 실루엣 + 점선 테두리 */
export function drawGhostCar(ctx: CanvasRenderingContext2D, view: Viewport, x: number, y: number, heading: number, done: boolean) {
  const p = worldToScreen(view, { x, y });
  const len = CAR.length * view.scale;
  const wid = CAR.width * view.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-heading);
  ctx.globalAlpha = done ? 0.3 : 0.55;
  ctx.fillStyle = 'rgba(200, 225, 255, 0.55)';
  ctx.fillRect(-len / 2, -wid / 2, len, wid);
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = 'rgba(230, 240, 255, 0.95)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-len / 2 - 1.5, -wid / 2 - 1.5, len + 3, wid + 3);
  ctx.restore();
}
