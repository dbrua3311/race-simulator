import type { Vec } from '../core/vec';
import { signedCurvatures } from './geometry';

export interface TrackMetrics {
  length: number;
  /** 가장 급한 곳의 곡률 반지름 (m) */
  minRadius: number;
  /** 반지름이 sharpRadius 보다 작은 연속 구간 수 */
  sharpTurns: number;
  /** 좌회전 ↔ 우회전 전환 횟수 (S자 커브) */
  directionChanges: number;
}

/** 곡률 계산에 쓰는 앞뒤 간격 (샘플 수) */
const CURVATURE_STEP = 3;
/** 이보다 완만하면(반지름 150 m 초과) 직선으로 보고 방향 전환 계산에서 뺀다 */
const STRAIGHT_CURVATURE = 1 / 150;

export function measureTrack(center: Vec[], spacing: number, sharpRadius: number): TrackMetrics {
  const curvatures = signedCurvatures(center, CURVATURE_STEP);
  const n = curvatures.length;

  let maxAbs = 0;
  for (const k of curvatures) maxAbs = Math.max(maxAbs, Math.abs(k));

  // 급커브 구간 수: 원형이므로 급하지 않은 점에서 출발해 한 바퀴 센다
  const sharp = curvatures.map((k) => Math.abs(k) > 1 / sharpRadius);
  let sharpTurns = 0;
  const startIdx = sharp.indexOf(false);
  if (startIdx === -1) sharpTurns = 1;
  else {
    for (let step = 1; step <= n; step++) {
      const i = (startIdx + step) % n;
      if (sharp[i] && !sharp[(i - 1 + n) % n]) sharpTurns++;
    }
  }

  let directionChanges = 0;
  let lastSign = 0;
  for (const k of curvatures) {
    if (Math.abs(k) < STRAIGHT_CURVATURE) continue;
    const sign = Math.sign(k);
    if (lastSign !== 0 && sign !== lastSign) directionChanges++;
    lastSign = sign;
  }

  return {
    length: n * spacing,
    minRadius: maxAbs === 0 ? Infinity : 1 / maxAbs,
    sharpTurns,
    directionChanges,
  };
}
