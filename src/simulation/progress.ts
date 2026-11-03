// 유효 진행률과 완주 판정 (원문 15C, 20, 62절, DECISIONS D1).
//
// - 각 차는 자기 출발 위치 기준으로 거리를 잰다 → 그리드 앞뒤 자리 차이로 손해·이득이 없다.
// - 트랙 위 위치(s)는 직전 위치 주변에서만 찾고(nearestIndex), 언랩해서 이어 붙인다.
//   헤어핀에서 옆 구간이 가까워도 s 가 건너뛰지 않는다.
// - 체크포인트(출발선 포함)는 자기 출발점부터 순서대로, 정방향으로 지나야만 인정된다.
//   뒤로 다시 넘으면 인정이 취소된다 → 결승선 앞뒤 왕복으로 완주할 수 없다.
// - 유효 진행 거리 = 다음 미통과 체크포인트를 넘지 않는 범위에서 지금까지 도달한 최대 거리.
// - 완주 = 모든 체크포인트를 순서대로 지나 목표 거리(한 바퀴 + 도착 구간 거리, 모든 차 같음)를 달린 순간.
//   도착 구간 거리 덕분에 완주한 차는 출발 그리드보다 앞쪽에 멈춰, 출발 직후 멈춘 차들과 겹치지 않는다 (DECISIONS D31).

import type { Track } from '../tracks/types';
import type { CarState } from './types';

/** 트랙 중심선 위 위치 s (0 ≤ s < 트랙 길이). index 의 앞뒤 선분에 투영해 점 간격보다 정밀하게 잰다 */
export function localS(track: Track, index: number, x: number, y: number): number {
  const n = track.center.length;
  let bestDist = Infinity;
  let bestS = index * track.spacing;
  for (const i of [(index - 1 + n) % n, index]) {
    const a = track.center[i]!;
    const b = track.center[(i + 1) % n]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len2 = ex * ex + ey * ey;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / len2));
    const d = (a.x + ex * t - x) ** 2 + (a.y + ey * t - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestS = (i + t) * track.spacing;
    }
  }
  return bestS;
}

const gateCache = new WeakMap<Track, Map<string, number[]>>();

/**
 * 출발 위치 startS 인 차가 순서대로 지나야 하는 체크포인트들의 "출발점부터의 거리".
 * 출발선과 모든 체크포인트를 목표 거리(goal) 안에서 만나는 순서로 나열하고, 마지막은 목표 지점이다.
 */
export function gateDistances(track: Track, startS: number, goal: number = track.length): number[] {
  let byStart = gateCache.get(track);
  if (!byStart) {
    byStart = new Map();
    gateCache.set(track, byStart);
  }
  const key = `${startS}/${goal}`;
  let gates = byStart.get(key);
  if (!gates) {
    const L = track.length;
    const positions = [track.startLine.s, ...track.checkpoints.map((c) => c.s)];
    const firstLap = positions.map((g) => (((g - startS) % L) + L) % L).filter((d) => d > 1e-9);
    gates = [];
    for (let lap = 0; lap * L < goal; lap++) {
      for (const d of firstLap) if (d + lap * L < goal - 1e-9) gates.push(d + lap * L);
    }
    gates.sort((a, b) => a - b);
    gates.push(goal);
    byStart.set(key, gates);
  }
  return gates;
}

/** 물리 한 스텝 뒤 호출. car.trackIndex 는 이미 갱신되어 있어야 한다. 이번 스텝에 완주했으면 true */
export function updateProgress(car: CarState, track: Track, tick: number): boolean {
  const L = track.length;
  const s = localS(track, car.trackIndex, car.x, car.y);
  // 직전 s 와 가장 가까운 바퀴 수로 이어 붙인다 (한 스텝 이동 ≤ 0.5 m)
  car.s = s + Math.round((car.s - s) / L) * L;

  const distance = car.s - car.startS;
  const gates = gateDistances(track, car.startS, car.goal);
  while (car.nextGate < gates.length && distance >= gates[car.nextGate]!) car.nextGate++;
  while (car.nextGate > 0 && distance < gates[car.nextGate - 1]!) car.nextGate--;

  const cap = car.nextGate < gates.length ? gates[car.nextGate]! : car.goal;
  const valid = Math.min(distance, cap);
  if (valid > car.bestDistance) {
    car.bestDistance = valid;
    car.bestTick = tick;
  }
  return car.nextGate === gates.length;
}

/** 유효 진행률 0 ~ 1 (목표 거리 대비) */
export function progressOf(car: CarState): number {
  return Math.max(0, Math.min(1, car.bestDistance / car.goal));
}
