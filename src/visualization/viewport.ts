import type { Vec } from '../core/vec';

/** 월드(m, y 위쪽) ↔ 화면(px, y 아래쪽) 변환 */
export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** bounds 전체가 화면 가운데에 padding 을 두고 들어가도록 맞춘다 */
export function fitViewport(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  width: number,
  height: number,
  padding: number,
): Viewport {
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;
  const scale = Math.max(0.01, Math.min((width - 2 * padding) / worldW, (height - 2 * padding) / worldH));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { scale, offsetX: width / 2 - cx * scale, offsetY: height / 2 + cy * scale };
}

export function worldToScreen(v: Viewport, p: Vec): Vec {
  return { x: v.offsetX + p.x * v.scale, y: v.offsetY - p.y * v.scale };
}

export function screenToWorld(v: Viewport, p: Vec): Vec {
  return { x: (p.x - v.offsetX) / v.scale, y: (v.offsetY - p.y) / v.scale };
}
