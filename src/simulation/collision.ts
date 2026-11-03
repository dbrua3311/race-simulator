// 벽 충돌 판정. 도로 = 중심선에서 도로 폭/2 이내인 영역이다.
// 트랙 검증(서로 다른 구간이 충분히 떨어짐, 곡률 반지름 > 도로 폭/2)이 이 정의가 벽 그림과 일치함을 보장한다.
// 다른 자동차는 판정에 쓰지 않는다 (원문 13절).

import type { Vec } from '../core/vec';
import type { Track } from '../tracks/types';
import { CAR } from './params';

/** 한 스텝에 차가 움직이는 거리(최대 0.5 m)보다 충분히 넓은 탐색 범위 (점 개수) */
const INDEX_WINDOW = 10;
/** 차체 꼭짓점은 차 중심에서 3 m 안 → 앞뒤 이만큼의 중심선 선분만 본다 */
const CORNER_WINDOW = 4;

/** 이전 인덱스 주변에서만 가장 가까운 중심선 점을 찾는다 (헤어핀에서 옆 구간으로 건너뛰지 않음) */
export function nearestIndex(track: Track, previous: number, p: Vec): number {
  const n = track.center.length;
  let best = previous;
  let bestDist = Infinity;
  for (let d = -INDEX_WINDOW; d <= INDEX_WINDOW; d++) {
    const i = (((previous + d) % n) + n) % n;
    const c = track.center[i]!;
    const dist = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** index 주변 중심선 선분까지의 최소 거리 */
export function distanceToCenterline(track: Track, index: number, p: Vec): number {
  const n = track.center.length;
  let best = Infinity;
  for (let d = -CORNER_WINDOW; d < CORNER_WINDOW; d++) {
    const a = track.center[(((index + d) % n) + n) % n]!;
    const b = track.center[(((index + d + 1) % n) + n) % n]!;
    best = Math.min(best, pointSegmentDistance(p, a, b));
  }
  return best;
}

export function carCorners(x: number, y: number, heading: number): Vec[] {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const hl = CAR.length / 2;
  const hw = CAR.width / 2;
  return [
    [hl, hw],
    [hl, -hw],
    [-hl, -hw],
    [-hl, hw],
  ].map(([fx, fy]) => ({ x: x + fx! * c - fy! * s, y: y + fx! * s + fy! * c }));
}

/** 차체 꼭짓점 중 하나라도 도로 밖이면 충돌 */
export function hitsWall(track: Track, x: number, y: number, heading: number, index: number): boolean {
  const limit = track.roadWidth / 2;
  return carCorners(x, y, heading).some((corner) => distanceToCenterline(track, index, corner) > limit);
}

function pointSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
