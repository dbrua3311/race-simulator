// 트랙 생성·검증에 쓰는 다각선(polyline) 기하 함수.
// 점 수가 수백~천 개라 균일 격자로 후보를 줄여 교차·근접 검사를 한다.

import { cross, distance, sub, type Vec } from '../core/vec';

/** 닫힌 다각선을 같은 간격으로 다시 샘플링한다. 첫 점은 유지된다. */
export function resampleClosed(points: Vec[], spacing: number): Vec[] {
  const n = points.length;
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const len = distance(points[i]!, points[(i + 1) % n]!);
    segLengths.push(len);
    total += len;
  }
  const count = Math.max(3, Math.round(total / spacing));
  const step = total / count;
  const out: Vec[] = [];
  let seg = 0;
  let segStart = 0;
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (seg < n - 1 && segStart + segLengths[seg]! < target) {
      segStart += segLengths[seg]!;
      seg++;
    }
    const a = points[seg]!;
    const b = points[(seg + 1) % n]!;
    const t = segLengths[seg]! === 0 ? 0 : (target - segStart) / segLengths[seg]!;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

export function closedLength(points: Vec[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) total += distance(points[i]!, points[(i + 1) % points.length]!);
  return total;
}

/** 두 선분이 교차하거나 닿는가 (끝점이 다른 선분 위에 있는 경우, 한 직선 위에서 겹치는 경우 포함) */
export function segmentsIntersect(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const d1 = cross(sub(b, a), sub(c, a));
  const d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c));
  const d4 = cross(sub(d, c), sub(b, c));
  if (d1 === 0 && d2 === 0) {
    // 한 직선 위: 구간이 겹치는지 본다
    return (
      Math.max(a.x, b.x) >= Math.min(c.x, d.x) &&
      Math.max(c.x, d.x) >= Math.min(a.x, b.x) &&
      Math.max(a.y, b.y) >= Math.min(c.y, d.y) &&
      Math.max(c.y, d.y) >= Math.min(a.y, b.y)
    );
  }
  return d1 * d2 <= 0 && d3 * d4 <= 0;
}

/** 점들을 정사각형 칸에 나눠 담는 격자. 근접 질의에 쓴다. */
class PointGrid {
  private cells = new Map<string, number[]>();
  constructor(
    private readonly points: Vec[],
    private readonly cellSize: number,
  ) {
    points.forEach((p, i) => {
      const key = this.key(Math.floor(p.x / cellSize), Math.floor(p.y / cellSize));
      const cell = this.cells.get(key);
      if (cell) cell.push(i);
      else this.cells.set(key, [i]);
    });
  }

  private key(cx: number, cy: number) {
    return `${cx},${cy}`;
  }

  /** p 에서 radius 안에 있는 점들의 인덱스 */
  near(p: Vec, radius: number): number[] {
    const out: number[] = [];
    const r = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(p.x / this.cellSize);
    const cy = Math.floor(p.y / this.cellSize);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (const i of this.cells.get(this.key(cx + dx, cy + dy)) ?? []) {
          if (distance(this.points[i]!, p) < radius) out.push(i);
        }
      }
    }
    return out;
  }
}

/** 닫힌 다각선 a 의 선분과 닫힌 다각선 b 의 선분이 교차하는 경우가 있는가. a === b 면 자기 교차 검사(이웃 선분 제외). */
export function closedPolylinesIntersect(a: Vec[], b: Vec[]): boolean {
  const same = a === b;
  // 선분 중점 격자. 선분 길이가 짧으므로(수 m) 중점 근처만 보면 된다.
  const maxSeg = Math.max(maxSegmentLength(a), maxSegmentLength(b));
  const mids = b.map((p, i) => midpoint(p, b[(i + 1) % b.length]!));
  const grid = new PointGrid(mids, Math.max(maxSeg, 1) * 2);
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!;
    const q = a[(i + 1) % a.length]!;
    for (const j of grid.near(midpoint(p, q), maxSeg * 1.5)) {
      if (same && circularGap(i, j, a.length) <= 1) continue;
      if (segmentsIntersect(p, q, b[j]!, b[(j + 1) % b.length]!)) return true;
    }
  }
  return false;
}

/**
 * 닫힌 다각선에서 경로상 거리가 minArc 보다 먼 두 점이 직선거리 minDistance 보다 가까운 경우를 찾는다.
 * 도로끼리 맞닿거나 너무 가까워 다른 구간으로 넘어갈 수 있는 구조를 막는다.
 */
export function findCloseApproach(
  points: Vec[],
  spacing: number,
  minArc: number,
  minDistance: number,
): { i: number; j: number; distance: number } | null {
  const grid = new PointGrid(points, minDistance);
  const minGap = Math.ceil(minArc / spacing);
  for (let i = 0; i < points.length; i++) {
    for (const j of grid.near(points[i]!, minDistance)) {
      if (j > i && circularGap(i, j, points.length) > minGap) {
        return { i, j, distance: distance(points[i]!, points[j]!) };
      }
    }
  }
  return null;
}

/** 각 점의 부호 있는 곡률(1/m). 양수 = 왼쪽(반시계)으로 도는 중. 앞뒤 k 칸 떨어진 점으로 계산한다. */
export function signedCurvatures(points: Vec[], k: number): number[] {
  const n = points.length;
  return points.map((b, i) => {
    const a = points[(i - k + n) % n]!;
    const c = points[(i + k) % n]!;
    const ab = distance(a, b);
    const bc = distance(b, c);
    const ac = distance(a, c);
    if (ab * bc * ac === 0) return 0;
    return (2 * cross(sub(b, a), sub(c, b))) / (ab * bc * ac);
  });
}

export function circularGap(i: number, j: number, n: number): number {
  const d = Math.abs(i - j) % n;
  return Math.min(d, n - d);
}

function midpoint(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function maxSegmentLength(points: Vec[]): number {
  let max = 0;
  for (let i = 0; i < points.length; i++) max = Math.max(max, distance(points[i]!, points[(i + 1) % points.length]!));
  return max;
}
