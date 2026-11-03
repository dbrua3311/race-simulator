import type { Difficulty } from './types';

/** 생성 알고리즘이 바뀌면 올린다. 같은 (버전, 난이도, 시드) → 같은 트랙 */
export const GENERATOR_VERSION = 1;

export const TRACK = {
  /** 도로 폭 (m). 차 5대가 나란히 서도 벽과 여유가 있게 (DECISIONS D1) */
  roadWidth: 18,
  /** 중심선 샘플 간격 (m) */
  spacing: 2,
  /** 서로 다른 구간의 도로 가장자리 사이 최소 간격 (m) */
  wallGap: 8,
  /** 기준 반지름 (m). 트랙 전체 크기를 정한다 */
  baseRadius: 150,
  /** 메인 직선 길이 (m). 출발선 뒤 behind m + 출발선 앞 나머지 */
  straightLength: 130,
  straightBehind: 105,
  /** 체크포인트 대략 간격 (m) */
  checkpointSpacing: 40,
  /** 가로:세로 비율 허용 범위 */
  aspectRange: [0.65, 1.6] as const,
  /** 한 시드에서 유효한 트랙이 나올 때까지 시도하는 최대 횟수 */
  maxAttempts: 400,
} as const;

export const GRID = {
  columns: 5,
  /** 가로 간격 (m) */
  columnSpacing: 3.2,
  /** 세로 간격 (m). 자리가 많으면 직선 안에 들어가도록 줄인다 */
  rowSpacing: 6.5,
  minRowSpacing: 5,
  /** 출발선에서 첫 줄까지 (m) */
  frontOffset: 4,
} as const;

export interface DifficultyParams {
  /** 반지름 r(θ) 에 더하는 푸리에 성분의 최고 차수 범위 (2차부터) */
  harmonics: readonly [number, number];
  /** 성분 진폭 (기준 반지름 대비) */
  amplitude: number;
  /** 차수가 높을수록 진폭을 1/k^decay 로 줄인다 */
  decay: number;
  /** 허용하는 최소 곡률 반지름 (m) */
  minCurveRadius: number;
  /** 한 바퀴 길이 범위 (m) */
  lengthRange: readonly [number, number];
  /** 급커브(반지름 < sharpRadius) 개수 범위 */
  sharpRadius: number;
  sharpTurns: readonly [number, number];
  /** 좌우 방향이 바뀌는 횟수 최소값 (S자 커브) */
  minDirectionChanges: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyParams> = {
  easy: {
    harmonics: [3, 4],
    amplitude: 0.16,
    decay: 0.5,
    minCurveRadius: 30,
    lengthRange: [850, 1300],
    sharpRadius: 30,
    sharpTurns: [0, 0],
    minDirectionChanges: 0,
  },
  medium: {
    harmonics: [5, 7],
    amplitude: 0.22,
    decay: 0.5,
    minCurveRadius: 18,
    lengthRange: [850, 1500],
    sharpRadius: 30,
    sharpTurns: [1, 99],
    minDirectionChanges: 2,
  },
  hard: {
    harmonics: [6, 9],
    amplitude: 0.36,
    decay: 0.45,
    minCurveRadius: 14,
    lengthRange: [900, 1700],
    sharpRadius: 22,
    sharpTurns: [3, 99],
    minDirectionChanges: 4,
  },
};
