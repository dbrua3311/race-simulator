// 거리 센서: 차 중심에서 5 방향으로 광선을 쏴 가장 가까운 벽까지의 거리를 잰다.
// 벽(트랙 경계선)만 감지하고 다른 차·고스트는 보지 않는다 (원문 13, 17절).
//
// 빠르게 하려고 벽 선분을 균일 격자에 담아 두고, 광선이 지나가는 칸의 선분만 검사한다(DDA 격자 순회).
// 격자는 트랙에서 만드는 파생 데이터라 저장하지 않는다.

import type { Track } from '../tracks/types';
import { SENSOR } from './params';

interface WallGrid {
  cellSize: number;
  minX: number;
  minY: number;
  cols: number;
  rows: number;
  /** 칸 c 의 선분 번호는 items[cellStart[c] .. cellStart[c + 1]) */
  cellStart: Int32Array;
  items: Int32Array;
  /** 선분 i: (ax[i], ay[i]) → (bx[i], by[i]) */
  ax: Float64Array;
  ay: Float64Array;
  bx: Float64Array;
  by: Float64Array;
}

const CELL_SIZE = 8;
const grids = new WeakMap<Track, WallGrid>();

export function wallGrid(track: Track): WallGrid {
  let grid = grids.get(track);
  if (!grid) {
    grid = buildWallGrid(track);
    grids.set(track, grid);
  }
  return grid;
}

function buildWallGrid(track: Track): WallGrid {
  const segments: [number, number, number, number][] = [];
  for (const wall of [track.left, track.right]) {
    for (let i = 0; i < wall.length; i++) {
      const a = wall[i]!;
      const b = wall[(i + 1) % wall.length]!;
      segments.push([a.x, a.y, b.x, b.y]);
    }
  }
  const margin = SENSOR.range + CELL_SIZE;
  const minX = track.bounds.minX - margin;
  const minY = track.bounds.minY - margin;
  const cols = Math.ceil((track.bounds.maxX + margin - minX) / CELL_SIZE);
  const rows = Math.ceil((track.bounds.maxY + margin - minY) / CELL_SIZE);

  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  segments.forEach(([x0, y0, x1, y1], i) => {
    const c0 = Math.floor((Math.min(x0, x1) - minX) / CELL_SIZE);
    const c1 = Math.floor((Math.max(x0, x1) - minX) / CELL_SIZE);
    const r0 = Math.floor((Math.min(y0, y1) - minY) / CELL_SIZE);
    const r1 = Math.floor((Math.max(y0, y1) - minY) / CELL_SIZE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) buckets[r * cols + c]!.push(i);
  });

  const cellStart = new Int32Array(cols * rows + 1);
  let total = 0;
  buckets.forEach((b, i) => {
    cellStart[i] = total;
    total += b.length;
  });
  cellStart[cols * rows] = total;
  const items = new Int32Array(total);
  let k = 0;
  for (const b of buckets) for (const i of b) items[k++] = i;

  return {
    cellSize: CELL_SIZE,
    minX,
    minY,
    cols,
    rows,
    cellStart,
    items,
    ax: Float64Array.from(segments, (s) => s[0]),
    ay: Float64Array.from(segments, (s) => s[1]),
    bx: Float64Array.from(segments, (s) => s[2]),
    by: Float64Array.from(segments, (s) => s[3]),
  };
}

/** (ox, oy) 에서 (dx, dy) 단위 방향으로 maxDist 안에서 처음 만나는 벽까지 거리. 없으면 maxDist */
export function castRay(grid: WallGrid, ox: number, oy: number, dx: number, dy: number, maxDist: number): number {
  const size = grid.cellSize;
  let cx = Math.floor((ox - grid.minX) / size);
  let cy = Math.floor((oy - grid.minY) / size);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(size / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(size / dy) : Infinity;
  const nextX = grid.minX + (cx + (dx > 0 ? 1 : 0)) * size;
  const nextY = grid.minY + (cy + (dy > 0 ? 1 : 0)) * size;
  let tMaxX = dx !== 0 ? (nextX - ox) / dx : Infinity;
  let tMaxY = dy !== 0 ? (nextY - oy) / dy : Infinity;

  let best = maxDist;
  let tCell = 0;
  while (tCell <= best && cx >= 0 && cy >= 0 && cx < grid.cols && cy < grid.rows) {
    const cell = cy * grid.cols + cx;
    for (let k = grid.cellStart[cell]!; k < grid.cellStart[cell + 1]!; k++) {
      const i = grid.items[k]!;
      const t = raySegment(ox, oy, dx, dy, grid.ax[i]!, grid.ay[i]!, grid.bx[i]!, grid.by[i]!);
      if (t < best) best = t;
    }
    // 다음 칸
    if (tMaxX < tMaxY) {
      tCell = tMaxX;
      tMaxX += tDeltaX;
      cx += stepX;
    } else {
      tCell = tMaxY;
      tMaxY += tDeltaY;
      cy += stepY;
    }
  }
  return best;
}

/** 모든 벽 선분을 검사하는 느린 버전 (테스트에서 격자 결과와 비교용) */
export function castRayBruteForce(track: Track, ox: number, oy: number, dx: number, dy: number, maxDist: number) {
  let best = maxDist;
  for (const wall of [track.left, track.right]) {
    for (let i = 0; i < wall.length; i++) {
      const a = wall[i]!;
      const b = wall[(i + 1) % wall.length]!;
      best = Math.min(best, raySegment(ox, oy, dx, dy, a.x, a.y, b.x, b.y));
    }
  }
  return best;
}

/** 광선과 선분의 교차 거리 t (없으면 Infinity) */
function raySegment(ox: number, oy: number, dx: number, dy: number, ax: number, ay: number, bx: number, by: number) {
  const ex = bx - ax;
  const ey = by - ay;
  const denom = dx * ey - dy * ex;
  if (denom === 0) return Infinity;
  const wx = ax - ox;
  const wy = ay - oy;
  const t = (wx * ey - wy * ex) / denom;
  const u = (wx * dy - wy * dx) / denom;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}

/** 센서 5개의 값 (0 = 벽에 붙음, 1 = 최대 거리 이상). 신경망 입력으로 쓴다 */
export function readSensors(grid: WallGrid, x: number, y: number, heading: number, out: number[] = []): number[] {
  for (let k = 0; k < SENSOR.angles.length; k++) {
    const angle = heading + SENSOR.angles[k]!;
    out[k] = castRay(grid, x, y, Math.cos(angle), Math.sin(angle), SENSOR.range) / SENSOR.range;
  }
  return out;
}
