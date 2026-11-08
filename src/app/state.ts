// 화면 상태. 시뮬레이션의 실제 상태(세대·주행·평가)는 워커가 주인이고, 여기서는 워커 스냅샷을 따라간다.
// 트랙은 명시적인 조작(생성·다시 생성·시드 입력·난이도 변경)에서만 만들어지고, 첫 주행이 시작되면 고정된다 (요구 65).

import { DEFAULT_SETTINGS, type GaSettings } from '../genetics/params';
import type { GenerationRecord, Ghost } from '../simulation/experiment';
import { generateTrack } from '../tracks/generate';
import { measureTrack, type TrackMetrics } from '../tracks/metrics';
import { DIFFICULTY } from '../tracks/params';
import type { Difficulty, Track } from '../tracks/types';
import type { GhostMode } from '../visualization/ghost';
import type { RenderStyle } from '../visualization/style';
import type { SimStatus } from '../workers/protocol';

/**
 * trackSetup: 트랙 선택 / ready: 세대가 출발 그리드에 서 있음 / countdown: 출발 카운트다운
 * running / paused / parentSelection: 세대 평가 완료, 수동 부모 선택 (원문 50절)
 * 자동 학습 여부(auto)는 phase 와 따로 둔다.
 */
export type Phase = 'trackSetup' | 'ready' | 'countdown' | 'running' | 'paused' | 'parentSelection';

export const PHASE_LABEL: Record<Phase, string> = {
  trackSetup: '트랙 선택',
  ready: '주행 준비',
  countdown: '출발 카운트다운',
  running: '주행 중',
  paused: '일시정지',
  parentSelection: '부모 선택',
};

export const SPEEDS = [1, 2, 5, 10, 20, 50] as const;
export type Speed = (typeof SPEEDS)[number];

/** 출발 카운트다운 (초). 실제 시간이며 시뮬레이션 시간에는 들어가지 않는다 */
export const COUNTDOWN_SECONDS = 3;

export interface AppState {
  phase: Phase;
  difficulty: Difficulty;
  seed: string;
  track: Track | null;
  trackMetrics: TrackMetrics | null;
  trackError: string | null;
  /** 첫 주행이 시작되면 true. 새 판을 시작할 때만 false 로 돌아간다 */
  trackLocked: boolean;
  settings: GaSettings;
  speed: Speed;
  /** 카운트다운 남은 초 */
  countdown: number;
  /** 건너뛰기 계산 중 */
  skipping: boolean;
  /** 자동 학습 중 */
  auto: boolean;
  /** 현재 세대 (실험이 없으면 0) */
  generation: number;
  /** 수동 부모 선택: 고른 차 번호 */
  selection: number[];
  /** 평가가 끝난 세대 기록 */
  history: GenerationRecord[];
  ghosts: Ghost[];
  /** 학습 초기화할 때마다 늘려 실험 시드를 바꾼다 */
  runNumber: number;
  /** 사용자에게 보여 줄 알림 */
  message: Notice | null;
  /** 저장 파일에 들어갈 실험 이름 */
  experimentName: string;
  /** 고스트 비교 대상 (기본: 역대 최고) */
  ghostMode: GhostMode;
  /** ghostMode 가 'generation' 일 때 비교할 세대 */
  ghostGeneration: number | null;
  /** 화면 그림 방식 (기본: 픽셀아트) */
  renderStyle: RenderStyle;
}

export interface Notice {
  text: string;
  kind: 'info' | 'error';
}

export type Action =
  | { type: 'generateTrack'; seed: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'startRun' }
  | { type: 'startCountdown' }
  | { type: 'countdownTick' }
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'setSettings'; settings: GaSettings }
  | { type: 'worker'; status: SimStatus; generation: number; auto: boolean; skipping: boolean }
  | { type: 'evaluated'; record: GenerationRecord; ghost: Ghost }
  | { type: 'toggleSelect'; id: number }
  | { type: 'addSelection'; ids: number[] }
  | { type: 'clearSelection' }
  | { type: 'confirmParents' }
  | { type: 'resetLearning' }
  | {
      type: 'loaded';
      track: Track;
      settings: GaSettings;
      generation: number;
      history: GenerationRecord[];
      ghosts: Ghost[];
      selection: number[];
      name: string;
    }
  | { type: 'message'; message: Notice | null }
  | { type: 'setName'; name: string }
  | { type: 'setGhost'; mode: GhostMode; generation: number | null }
  | { type: 'setRenderStyle'; style: RenderStyle }
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
      settings: { ...DEFAULT_SETTINGS },
      speed: 1,
      countdown: 0,
      skipping: false,
      auto: false,
      generation: 0,
      selection: [],
      history: [],
      ghosts: [],
      runNumber: 1,
      message: null,
      experimentName: '',
      ghostMode: 'best',
      ghostGeneration: null,
      renderStyle: 'pixel',
    },
    difficulty,
    seed,
  );
}

const STATUS_PHASE: Record<Exclude<SimStatus, 'idle'>, Phase> = {
  ready: 'ready',
  running: 'running',
  paused: 'paused',
  evaluated: 'parentSelection',
};

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
      return { ...state, trackLocked: true, phase: 'countdown', countdown: COUNTDOWN_SECONDS, skipping: false, generation: 1 };
    case 'startCountdown':
      if (state.phase !== 'ready') return state;
      return { ...state, phase: 'countdown', countdown: COUNTDOWN_SECONDS };
    case 'countdownTick':
      if (state.phase !== 'countdown') return state;
      return state.countdown > 1 ? { ...state, countdown: state.countdown - 1 } : { ...state, countdown: 0, phase: 'running' };
    case 'setSpeed':
      return { ...state, speed: action.speed };
    case 'setSettings':
      return { ...state, settings: action.settings };
    case 'worker': {
      if (state.phase === 'trackSetup' || action.status === 'idle') return state;
      // 카운트다운 중에는 출발 전(ready)·평가 완료(결정완료 직후 아직 다음 세대가 오기 전) 상태를 무시한다
      const holdCountdown =
        state.phase === 'countdown' && !action.auto && (action.status === 'ready' || action.status === 'evaluated');
      const phase = holdCountdown ? 'countdown' : STATUS_PHASE[action.status];
      const generationChanged = action.generation !== state.generation;
      if (phase === state.phase && !generationChanged && action.auto === state.auto && action.skipping === state.skipping) {
        return state;
      }
      return {
        ...state,
        phase,
        countdown: phase === 'countdown' ? state.countdown : 0,
        generation: action.generation,
        auto: action.auto,
        skipping: action.skipping,
        selection: generationChanged || phase !== 'parentSelection' ? [] : state.selection,
      };
    }
    case 'evaluated':
      if (state.history.some((r) => r.generation === action.record.generation)) return state;
      return { ...state, history: [...state.history, action.record], ghosts: [...state.ghosts, action.ghost] };
    case 'toggleSelect':
      if (state.phase !== 'parentSelection') return state;
      return {
        ...state,
        selection: state.selection.includes(action.id)
          ? state.selection.filter((id) => id !== action.id)
          : [...state.selection, action.id],
      };
    case 'addSelection':
      if (state.phase !== 'parentSelection') return state;
      return { ...state, selection: [...new Set([...state.selection, ...action.ids])] };
    case 'clearSelection':
      return { ...state, selection: [] };
    case 'confirmParents':
      // 결정완료: 다음 세대가 만들어지고 카운트다운 뒤 동시 출발
      if (state.phase !== 'parentSelection') return state;
      return { ...state, phase: 'countdown', countdown: COUNTDOWN_SECONDS, selection: [] };
    case 'resetLearning':
      return {
        ...state,
        phase: 'ready',
        generation: 1,
        history: [],
        ghosts: [],
        selection: [],
        auto: false,
        skipping: false,
        runNumber: state.runNumber + 1,
      };
    case 'loaded':
      return {
        ...state,
        track: action.track,
        difficulty: action.track.difficulty,
        seed: action.track.seed,
        trackMetrics: measureTrack(action.track.center, action.track.spacing, DIFFICULTY[action.track.difficulty].sharpRadius),
        trackError: null,
        trackLocked: true,
        settings: action.settings,
        generation: action.generation,
        history: action.history,
        ghosts: action.ghosts,
        selection: action.selection,
        experimentName: action.name,
        countdown: 0,
        auto: false,
        skipping: false,
        // 실제 단계는 곧 도착하는 워커 스냅샷으로 맞춰진다
        phase: 'paused',
      };
    case 'message':
      return { ...state, message: action.message };
    case 'setName':
      return { ...state, experimentName: action.name };
    case 'setGhost':
      return { ...state, ghostMode: action.mode, ghostGeneration: action.generation };
    case 'setRenderStyle':
      return { ...state, renderStyle: action.style };
    case 'newGame':
      return {
        ...state,
        trackLocked: false,
        phase: 'trackSetup',
        countdown: 0,
        skipping: false,
        auto: false,
        generation: 0,
        selection: [],
        history: [],
        ghosts: [],
      };
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
