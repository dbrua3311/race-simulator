// 시드 기반 단일 폐회로 트랙 생성.
//
// 트랙 중심선을 극좌표 r(θ) 로 정의한다 (θ: 0 → 2π, 반시계).
// - 각도마다 점이 정확히 하나라서 자기 교차·갈림길·되돌아가는 길이 구조적으로 생길 수 없다.
// - r(θ) = 기준 반지름 × (1 + 무작위 푸리에 성분 합). 난이도가 높을수록 높은 주파수 성분이 많고 진폭이 커서
//   급커브·S자·헤어핀에 가까운 깊은 굴곡이 생긴다.
// - 아래쪽 구간은 정확한 직선(메인 직선, 출발 그리드)이고, 양옆에서 코사인 창으로 부드럽게 곡선과 섞는다.
// - 등간격으로 다시 샘플링한 뒤 검증하고, 실패하면 같은 난수열로 다음 후보를 만든다(결정론적 재시도).

import { createRng, randomInt, uniform, type RngState } from '../core/rng';
import { add, leftNormal, normalize, scale, sub, type Vec } from '../core/vec';
import { closedLength, resampleClosed, signedCurvatures } from './geometry';
import { DIFFICULTY, GENERATOR_VERSION, TRACK } from './params';
import type { Difficulty, Gate, Track } from './types';
import { validateTrack, type TrackIssue } from './validate';

export type GenerateResult =
  | { ok: true; track: Track; attempts: number }
  | { ok: false; attempts: number; issueCounts: Partial<Record<TrackIssue, number>> };

export function generateTrack(difficulty: Difficulty, seed: string): GenerateResult {
  const rng = createRng(`race-simulator/track/v${GENERATOR_VERSION}/${difficulty}/${seed}`);
  const issueCounts: Partial<Record<TrackIssue, number>> = {};

  for (let attempt = 1; attempt <= TRACK.maxAttempts; attempt++) {
    const center = buildCenterline(rng, difficulty);
    const { left, right } = offsetWalls(center, TRACK.roadWidth / 2);
    const spacing = closedLength(center) / center.length;
    const result = validateTrack(center, left, right, spacing, difficulty);
    if (result.ok) {
      return { ok: true, attempts: attempt, track: assembleTrack(center, left, right, spacing, difficulty, seed) };
    }
    for (const issue of result.issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
  }
  return { ok: false, attempts: TRACK.maxAttempts, issueCounts };
}

/** 극좌표 샘플 수 (다시 샘플링하기 전) */
const POLAR_SAMPLES = 4000;
/** 직선과 곡선을 섞는 구간 폭 (rad) */
const BLEND_WIDTH = 0.9;
/** 정확한 직선 구간을 메인 직선보다 양쪽으로 더 늘리는 길이 (m) */
const STRAIGHT_MARGIN = 10;
/** 굴곡 배율을 줄일 때 최소 곡률 반지름을 기준보다 이만큼 여유 있게 맞춘다 */
const SHARPNESS_MARGIN = 1.03;
const SCALE_SEARCH_STEPS = 7;

/** 등간격 중심선. 첫 점이 출발선이고 인덱스가 커지는 방향(반시계)으로 달린다. */
export function buildCenterline(rng: RngState, difficulty: Difficulty): Vec[] {
  const params = DIFFICULTY[difficulty];
  const R = TRACK.baseRadius;
  // 가로세로 비율. 늘린 뒤에도 직선은 직선이다.
  const stretch = uniform(rng, 0.85, 1.2);

  const harmonics: { k: number; amplitude: number; phase: number }[] = [];
  const maxK = randomInt(rng, params.harmonics[0], params.harmonics[1]);
  for (let k = 2; k <= maxK; k++) {
    harmonics.push({
      k,
      amplitude: (params.amplitude * uniform(rng, -1, 1)) / Math.pow(k, params.decay),
      phase: uniform(rng, 0, 2 * Math.PI),
    });
  }

  // 직선은 기준 원의 아래쪽 현(chord): 양 끝이 원 위에 놓여 곡선으로 자연스럽게 이어진다.
  // 늘린(stretch) 뒤 길이가 straightLength + 여유가 되도록 잡는다.
  const halfStraight = (TRACK.straightLength / 2 + STRAIGHT_MARGIN) / stretch;
  const straightHalfAngle = Math.asin(halfStraight / R);
  const y0 = -R * Math.cos(straightHalfAngle);
  const bottom = -Math.PI / 2;

  /** 굴곡 크기 배율 scale 로 중심선을 그린다 */
  const trace = (scale: number): Vec[] => {
    // 직선 양 끝 바깥(이음 구간 끝)에서 곡선 반지름이 평균적으로 기준 반지름이 되도록 푸리에 합을 보정한다
    const fourier = (theta: number) =>
      scale * harmonics.reduce((sum, h) => sum + h.amplitude * Math.cos(h.k * theta + h.phase), 0);
    const edge = straightHalfAngle + BLEND_WIDTH;
    const edgeOffset = (fourier(bottom - edge) + fourier(bottom + edge)) / 2;

    const curveRadius = (theta: number) => R * (1 + fourier(theta) - edgeOffset);
    const lineRadius = (theta: number) => y0 / Math.sin(theta);

    // 직선 끝(θa)에서 곡선 쪽(θb)까지는 값·기울기·2차 도함수를 양쪽에 맞춘 5차 에르미트 보간으로 잇는다.
    // 곡률이 직선 끝의 0 에서 연속으로 늘어나 이음부에 급커브가 생기지 않는다.
    // (직선의 r(θ) 는 직선 끝 바깥에서 급격히 커지므로 단순히 섞으면 바깥으로 튀어나왔다 돌아오며 급커브가 생긴다)
    const radiusAt = (theta: number): number => {
      const delta = wrapAngle(theta - bottom);
      const offset = Math.abs(delta);
      if (offset <= straightHalfAngle) return lineRadius(theta);
      if (offset >= straightHalfAngle + BLEND_WIDTH) return curveRadius(theta);
      const side = Math.sign(delta);
      const thetaA = bottom + side * straightHalfAngle;
      const thetaB = bottom + side * (straightHalfAngle + BLEND_WIDTH);
      const span = thetaB - thetaA;
      const t = (bottom + delta - thetaA) / span;
      return quinticHermite(
        [lineRadius(thetaA), derivative(lineRadius, thetaA) * span, secondDerivative(lineRadius, thetaA) * span * span],
        [curveRadius(thetaB), derivative(curveRadius, thetaB) * span, secondDerivative(curveRadius, thetaB) * span * span],
        t,
      );
    };

    // 출발선 위치에서 시작해 한 바퀴
    const startX = (-TRACK.straightLength / 2 + TRACK.straightBehind) / stretch;
    const startTheta = Math.atan2(y0, startX);
    const raw: Vec[] = [];
    for (let i = 0; i < POLAR_SAMPLES; i++) {
      const theta = startTheta + (2 * Math.PI * i) / POLAR_SAMPLES;
      const r = radiusAt(theta);
      raw.push({ x: r * Math.cos(theta) * stretch, y: (r * Math.sin(theta)) / stretch });
    }
    return resampleClosed(raw, TRACK.spacing);
  };

  // 굴곡이 너무 급하면 버리지 않고 배율만 줄여, 난이도가 허용하는 가장 급한 모양을 이진 탐색으로 찾는다
  const full = trace(1);
  const target = params.minCurveRadius * SHARPNESS_MARGIN;
  if (minCurveRadius(full) >= target) return full;
  let lo = 0;
  let hi = 1;
  let best: Vec[] | null = null;
  for (let i = 0; i < SCALE_SEARCH_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const shape = trace(mid);
    if (minCurveRadius(shape) >= target) {
      lo = mid;
      best = shape;
    } else hi = mid;
  }
  return best ?? full;
}

/** 양 끝의 [값, 1차, 2차 도함수] 를 맞추는 5차 에르미트 보간 (t ∈ [0, 1]) */
function quinticHermite(
  [p0, v0, a0]: [number, number, number],
  [p1, v1, a1]: [number, number, number],
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;
  return (
    (1 - 10 * t3 + 15 * t4 - 6 * t5) * p0 +
    (t - 6 * t3 + 8 * t4 - 3 * t5) * v0 +
    (0.5 * t2 - 1.5 * t3 + 1.5 * t4 - 0.5 * t5) * a0 +
    (0.5 * t3 - t4 + 0.5 * t5) * a1 +
    (-4 * t3 + 7 * t4 - 3 * t5) * v1 +
    (10 * t3 - 15 * t4 + 6 * t5) * p1
  );
}

function minCurveRadius(points: Vec[]): number {
  let max = 0;
  for (const k of signedCurvatures(points, 3)) max = Math.max(max, Math.abs(k));
  return max === 0 ? Infinity : 1 / max;
}

const H = 1e-4;
function derivative(f: (x: number) => number, x: number): number {
  return (f(x + H) - f(x - H)) / (2 * H);
}

function secondDerivative(f: (x: number) => number, x: number): number {
  return (f(x + H) - 2 * f(x) + f(x - H)) / (H * H);
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function tangentAt(center: Vec[], i: number): Vec {
  const n = center.length;
  return normalize(sub(center[(i + 1) % n]!, center[(i - 1 + n) % n]!));
}

export function offsetWalls(center: Vec[], halfWidth: number): { left: Vec[]; right: Vec[] } {
  const left: Vec[] = [];
  const right: Vec[] = [];
  center.forEach((p, i) => {
    const normal = leftNormal(tangentAt(center, i));
    left.push(add(p, scale(normal, halfWidth)));
    right.push(add(p, scale(normal, -halfWidth)));
  });
  return { left, right };
}

function assembleTrack(
  center: Vec[],
  left: Vec[],
  right: Vec[],
  spacing: number,
  difficulty: Difficulty,
  seed: string,
): Track {
  const length = spacing * center.length;
  const gate = (index: number): Gate => ({ index, s: index * spacing, a: left[index]!, b: right[index]! });
  const checkpointCount = Math.max(8, Math.round(length / TRACK.checkpointSpacing));
  const checkpoints: Gate[] = [];
  for (let k = 1; k < checkpointCount; k++) checkpoints.push(gate(Math.round((k * center.length) / checkpointCount)));

  const all = [...left, ...right];
  return {
    generatorVersion: GENERATOR_VERSION,
    difficulty,
    seed,
    roadWidth: TRACK.roadWidth,
    length,
    spacing,
    center,
    left,
    right,
    startLine: gate(0),
    checkpoints,
    bounds: {
      minX: Math.min(...all.map((p) => p.x)),
      minY: Math.min(...all.map((p) => p.y)),
      maxX: Math.max(...all.map((p) => p.x)),
      maxY: Math.max(...all.map((p) => p.y)),
    },
  };
}
