import type { Vec } from '../../src/core/vec';
import { resampleClosed } from '../../src/tracks/geometry';

/** 극좌표 함수로 닫힌 곡선을 만든다 (테스트용) */
export function polarShape(radius: (theta: number) => number, spacing = 2): Vec[] {
  const raw: Vec[] = [];
  for (let i = 0; i < 2000; i++) {
    const t = (2 * Math.PI * i) / 2000;
    const r = radius(t);
    raw.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
  }
  return resampleClosed(raw, spacing);
}

/** 8자 모양 (자기 교차) */
export function figureEight(size: number, spacing = 2): Vec[] {
  const raw: Vec[] = [];
  for (let i = 0; i < 2000; i++) {
    const t = (2 * Math.PI * i) / 2000;
    raw.push({ x: size * Math.sin(t), y: size * Math.sin(t) * Math.cos(t) });
  }
  return resampleClosed(raw, spacing);
}
