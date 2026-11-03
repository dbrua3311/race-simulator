import type { Vec } from '../core/vec';
import { closedPolylinesIntersect, findCloseApproach } from './geometry';
import { measureTrack, type TrackMetrics } from './metrics';
import { DIFFICULTY, TRACK } from './params';
import type { Difficulty } from './types';

export type TrackIssue =
  | 'length' // 한 바퀴 길이가 난이도 범위 밖
  | 'aspect' // 가로세로 비율이 화면에 맞지 않음
  | 'tooSharp' // 곡률 반지름이 너무 작아 안쪽 벽이 접힘
  | 'difficulty' // 급커브·S자 수가 난이도에 맞지 않음
  | 'tooClose' // 서로 다른 구간의 도로가 맞닿거나 너무 가까움 (지름길 위험)
  | 'centerIntersection' // 중심선 자기 교차
  | 'wallIntersection'; // 벽(경계선) 교차

export interface ValidationResult {
  ok: boolean;
  issues: TrackIssue[];
  metrics: TrackMetrics;
}

/**
 * 중심선과 좌우 벽이 단일 폐회로 트랙 조건을 만족하는지 검사한다.
 * 빠른 검사부터 하고, 실패하면 바로 돌려준다.
 */
export function validateTrack(
  center: Vec[],
  left: Vec[],
  right: Vec[],
  spacing: number,
  difficulty: Difficulty,
): ValidationResult {
  const params = DIFFICULTY[difficulty];
  const metrics = measureTrack(center, spacing, params.sharpRadius);
  const fail = (issue: TrackIssue): ValidationResult => ({ ok: false, issues: [issue], metrics });

  if (metrics.length < params.lengthRange[0] || metrics.length > params.lengthRange[1]) return fail('length');

  const aspect = aspectRatio([...left, ...right]);
  if (aspect < TRACK.aspectRange[0] || aspect > TRACK.aspectRange[1]) return fail('aspect');

  if (metrics.minRadius < params.minCurveRadius) return fail('tooSharp');

  if (
    metrics.sharpTurns < params.sharpTurns[0] ||
    metrics.sharpTurns > params.sharpTurns[1] ||
    metrics.directionChanges < params.minDirectionChanges
  ) {
    return fail('difficulty');
  }

  // 경로상 충분히 떨어진 두 지점은 도로 폭 + 벽 간격 이상 떨어져 있어야 한다.
  // 같은 커브 안의 점은 제외 (최소 반지름의 반원 길이 + 도로 폭)
  const minArc = Math.PI * params.minCurveRadius + TRACK.roadWidth;
  if (findCloseApproach(center, spacing, minArc, TRACK.roadWidth + TRACK.wallGap)) return fail('tooClose');

  if (closedPolylinesIntersect(center, center)) return fail('centerIntersection');
  if (
    closedPolylinesIntersect(left, left) ||
    closedPolylinesIntersect(right, right) ||
    closedPolylinesIntersect(left, right)
  ) {
    return fail('wallIntersection');
  }

  return { ok: true, issues: [], metrics };
}

function aspectRatio(points: Vec[]): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return (maxX - minX) / (maxY - minY);
}
