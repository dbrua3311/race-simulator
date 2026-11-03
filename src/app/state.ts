// 화면 상태. 트랙은 명시적인 조작(생성·다시 생성·시드 입력·난이도 변경)에서만 만들어지고,
// 첫 주행이 시작되면 고정된다. 렌더링·리렌더가 트랙을 다시 만들지 않는다 (요구 65).

import { generateTrack } from '../tracks/generate';
import { measureTrack, type TrackMetrics } from '../tracks/metrics';
import { DIFFICULTY } from '../tracks/params';
import type { Difficulty, Track } from '../tracks/types';

export type Phase = 'trackSetup' | 'countdown' | 'running' | 'paused' | 'finished';

export const PHASE_LABEL: Record<Phase, string> = {
  trackSetup: '트랙 선택',
  countdown: '출발 카운트다운',
  running: '주행 중',
  paused: '일시정지',
  finished: '주행 종료',
};

export const SPEEDS = [1, 2, 5, 10] as const;
export type Speed = (typeof SPEEDS)[number];

/** 출발 카운트다운 (초). 실제 시간이며 시뮬레이션 시간에는 들어가지 않는다 */
export const COUNTDOWN_SECONDS = 3;

export const DEFAULT_POPULATION = 50;

export interface AppState {
  phase: Phase;
  difficulty: Difficulty;
  seed: string;
  track: Track | null;
  trackMetrics: TrackMetrics | null;
  trackError: string | null;
  /** 첫 주행이 시작되면 true. 새 판을 시작할 때만 false 로 돌아간다 */
  trackLocked: boolean;
  populationSize: number;
  speed: Speed;
  /** 카운트다운 남은 초 */
  countdown: number;
  /** 건너뛰기 계산 중 */
  skipping: boolean;
}

export type Action =
  | { type: 'generateTrack'; seed: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'startRun' }
  | { type: 'countdownTick' }
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'simStatus'; status: 'running' | 'paused' | 'finished'; skipping: boolean }
  | { type: 'newGame' };

export function initialState(seed: string, difficulty: Difficulty = 'medium'): AppState {
  return withTrack(
    {
      phase: 'trackSetup',
      difficulty,
      seed,
      track: null,
      trackMetrics: null,
      trackError: null,
      trackLocked: false,
      populationSize: DEFAULT_POPULATION,
      speed: 1,
      countdown: 0,
      skipping: false,
    },
    difficulty,
    seed,
  );
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'generateTrack':
      if (state.trackLocked) return state;
      return withTrack(state, state.difficulty, action.seed);
    case 'setDifficulty':
      if (state.trackLocked || action.difficulty === state.difficulty) return state;
      return withTrack(state, action.difficulty, state.seed);
    case 'startRun':
      // 첫 주행이 시작되는 순간 트랙을 고정한다
      if (!state.track || state.phase !== 'trackSetup') return state;
      return { ...state, trackLocked: true, phase: 'countdown', countdown: COUNTDOWN_SECONDS, skipping: false };
    case 'countdownTick':
      if (state.phase !== 'countdown') return state;
      return state.countdown > 1 ? { ...state, countdown: state.countdown - 1 } : { ...state, countdown: 0, phase: 'running' };
    case 'setSpeed':
      return { ...state, speed: action.speed };
    case 'simStatus':
      // 워커가 알려 주는 실제 주행 상태를 따른다 (카운트다운 중에 온 이전 상태는 무시)
      if (state.phase === 'trackSetup' || state.phase === 'countdown') return state;
      if (state.phase === action.status && state.skipping === action.skipping) return state;
      return { ...state, phase: action.status, skipping: action.skipping };
    case 'newGame':
      return { ...state, trackLocked: false, phase: 'trackSetup', countdown: 0, skipping: false };
  }
}

function withTrack(state: AppState, difficulty: Difficulty, seed: string): AppState {
  if (seed === '') {
    return { ...state, difficulty, seed, track: null, trackMetrics: null, trackError: '시드를 입력하세요' };
  }
  const result = generateTrack(difficulty, seed);
  if (!result.ok) {
    return {
      ...state,
      difficulty,
      seed,
      track: null,
      trackMetrics: null,
      trackError: '이 시드로는 조건에 맞는 트랙을 만들지 못했습니다. 다른 시드를 입력하세요',
    };
  }
  const track = result.track;
  return {
    ...state,
    difficulty,
    seed,
    track,
    trackMetrics: measureTrack(track.center, track.spacing, DIFFICULTY[difficulty].sharpRadius),
    trackError: null,
  };
}
