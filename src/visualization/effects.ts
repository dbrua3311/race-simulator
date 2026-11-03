// 금색 오라와 고스트 그리기. 순수한 그림이며 차의 위치·충돌 크기를 바꾸지 않는다.

import { CAR } from '../simulation/params';
import { worldToScreen, type Viewport } from './viewport';

const GOLD_RGB = '242, 193, 78';

/**
 * 금색 챔피언 오라: 부드러운 외곽 광원 + 퍼지는 빛 + 차 주변을 도는 작은 금색 입자 + 뒤로 흩날리는 반짝임.
 * 주행이 끝나면 애니메이션을 멈추고 은은한 광원만 남긴다.
 */
export function drawGoldAura(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
  x: number,
  y: number,
  heading: number,
  time: number,
  running: boolean,
) {
  const p = worldToScreen(view, { x, y });
  const base = Math.max(14, CAR.length * view.scale * 1.6);
  const pulse = running ? 0.5 + 0.5 * Math.sin(time / 260) : 0.3;

  ctx.save();
  // 퍼지는 빛
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, base * (1.2 + 0.25 * pulse));
  glow.addColorStop(0, `rgba(${GOLD_RGB}, ${0.55 + 0.2 * pulse})`);
  glow.addColorStop(0.45, `rgba(${GOLD_RGB}, ${0.22 + 0.1 * pulse})`);
  glow.addColorStop(1, `rgba(${GOLD_RGB}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, base * 1.5, 0, Math.PI * 2);
  ctx.fill();

  if (running) {
    // 차 주변을 도는 입자
    for (let k = 0; k < 8; k++) {
      const angle = time / 700 + (k * Math.PI * 2) / 8;
      const r = base * (0.75 + 0.18 * Math.sin(time / 300 + k * 1.7));
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time / 180 + k));
      ctx.fillStyle = `rgba(255, 228, 140, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r, 1.2 + twinkle, 0, Math.PI * 2);
      ctx.fill();
    }
    // 뒤로 흩날리는 반짝임 (화면 좌표: 진행 방향의 반대쪽)
    const bx = -Math.cos(heading);
    const by = Math.sin(heading);
    for (let k = 0; k < 6; k++) {
      const phase = (time / 600 + k / 6) % 1;
      const d = base * (0.4 + phase * 1.6);
      const side = Math.sin(k * 2.3 + time / 400) * base * 0.35;
      ctx.fillStyle = `rgba(255, 220, 120, ${0.8 * (1 - phase)})`;
      ctx.beginPath();
      ctx.arc(p.x + bx * d - by * side, p.y + by * d + bx * side, 1.6 * (1 - phase) + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

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
