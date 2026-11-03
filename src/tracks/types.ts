import type { Vec } from '../core/vec';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '하', medium: '중', hard: '상' };

/** 도로를 가로지르는 선 (출발선, 체크포인트) */
export interface Gate {
  /** 중심선 인덱스 */
  index: number;
  /** 출발선에서 중심선을 따라 잰 거리 (m) */
  s: number;
  a: Vec;
  b: Vec;
}

/**
 * 트랙 데이터. 미리보기·충돌·센서·진행률이 모두 이 하나를 쓴다.
 * 좌표 단위는 m, y 축은 위쪽이 양수(수학 좌표). 진행 방향은 중심선 인덱스가 커지는 방향(반시계).
 * JSON 으로 그대로 저장한다.
 */
export interface Track {
  generatorVersion: number;
  difficulty: Difficulty;
  seed: string;
  roadWidth: number;
  /** 한 바퀴 길이 (m) */
  length: number;
  /** 중심선 점 간격 (m). center[i] 는 출발선에서 i × spacing 만큼 떨어져 있다 */
  spacing: number;
  /** 등간격 중심선. center[0] 이 출발선 위치 */
  center: Vec[];
  /** 진행 방향 기준 왼쪽 경계(벽) */
  left: Vec[];
  /** 진행 방향 기준 오른쪽 경계(벽) */
  right: Vec[];
  startLine: Gate;
  /** 출발선 다음부터 순서대로. 마지막 체크포인트 다음은 출발선(결승선) */
  checkpoints: Gate[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** 출발 그리드 한 자리 */
export interface GridSlot {
  /** 0 부터. 앞줄 왼쪽부터 오른쪽, 그다음 줄 */
  id: number;
  row: number;
  column: number;
  position: Vec;
  /** 진행 방향 (rad, x 축 기준 반시계) */
  heading: number;
  /** 출발선 기준 경로상 위치 (음수 = 출발선 뒤) */
  s: number;
}
