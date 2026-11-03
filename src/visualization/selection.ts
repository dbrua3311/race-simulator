// 캔버스에서 자동차 고르기: 클릭(가장 가까운 차 하나)과 드래그 사각형(안에 든 차 모두).
// 차가 작아도 고르기 쉽도록 클릭 판정은 화면에서 최소 반지름을 둔다. 고스트는 대상이 아니다.

import type { Vec } from '../core/vec';
import { CAR_STRIDE, type Snapshot } from '../workers/protocol';
import { worldToScreen, type Viewport } from './viewport';

/** 클릭 판정 최소 반지름 (px) */
export const MIN_HIT_RADIUS = 9;

export function carScreenPositions(snapshot: Snapshot, view: Viewport): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < snapshot.ids.length; i++) {
    const o = i * CAR_STRIDE;
    out.push(worldToScreen(view, { x: snapshot.data[o]!, y: snapshot.data[o + 1]! }));
  }
  return out;
}

/** 클릭한 위치에서 가장 가까운 차의 배열 위치 (판정 반지름 밖이면 -1) */
export function hitTest(positions: Vec[], point: Vec, radius: number): number {
  let best = -1;
  let bestDist = radius * radius;
  positions.forEach((p, i) => {
    const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** 사각형 안에 중심이 들어온 차들의 배열 위치 (겹친 차도 모두) */
export function carsInRect(positions: Vec[], a: Vec, b: Vec): number[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const out: number[] = [];
  positions.forEach((p, i) => {
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) out.push(i);
  });
  return out;
}
