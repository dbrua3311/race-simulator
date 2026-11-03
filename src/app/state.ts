// 화면 상태. 트랙은 명시적인 조작(생성·다시 생성·시드 입력·난이도 변경)에서만 만들어지고,
// 첫 주행이 시작되면 고정된다. 렌더링·리렌더가 트랙을 다시 만들지 않는다 (요구 65).

import { generateTrack } from '../tracks/generate';
import { measureTrack, type TrackMetrics } from '../tracks/metrics';
import { DIFFICULTY } from '../tracks/params';
import type { Difficulty, Track } from '../tracks/types';

export type Phase = 'trackSetup' | 'ready';

export const PHASE_LABEL: Record<Phase, string> = {
  trackSetup: '트랙 선택',
  ready: '주행 준비',
};

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
}

export type Action =
  | { type: 'generateTrack'; seed: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'startRun' }
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
      if (!state.track || state.trackLocked) return state;
      return { ...state, trackLocked: true, phase: 'ready' };
    case 'newGame':
      return { ...state, trackLocked: false, phase: 'trackSetup' };
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
