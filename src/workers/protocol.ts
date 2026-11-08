// 메인 스레드 ↔ 시뮬레이션 워커 메시지 형식.

import type { GaSettings } from '../genetics/params';
import type { Experiment, GenerationRecord, Ghost } from '../simulation/experiment';
import type { EndReason } from '../simulation/types';
import type { Track } from '../tracks/types';

export const PROTOCOL_VERSION = 5;

/** idle: 실험 없음 / ready: 출발 그리드에 정렬 / running / paused / evaluated: 세대 평가 끝, 부모 선택 대기 */
export type SimStatus = 'idle' | 'ready' | 'running' | 'paused' | 'evaluated';

export type WorkerCommand =
  | { type: 'ping'; id: number }
  /** 새 실험: 1세대를 출발 그리드에 세운다 */
  | { type: 'newExperiment'; track: Track; settings: GaSettings; seed: string }
  /** 같은 트랙으로 학습만 처음부터 */
  | { type: 'resetLearning'; seed: string }
  | { type: 'updateSettings'; settings: GaSettings }
  /** 모든 차 동시 출발 */
  | { type: 'go' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setSpeed'; speed: number }
  /** 남은 주행을 화면 갱신 없이 최대한 빨리 계산 (강제 종료가 아님) */
  | { type: 'skip' }
  /** 수동 선택 결정완료. generation 은 지금 세대 번호 (중복 방지 토큰) */
  | { type: 'confirmParents'; generation: number; parentIds: number[] }
  /** 자동 선택 모드에서 다음 세대 만들기 */
  | { type: 'autoSelect'; generation: number }
  | { type: 'startAuto' }
  | { type: 'stopAuto' }
  | { type: 'exportExperiment'; requestId: number }
  | { type: 'loadExperiment'; experiment: Experiment }
  | { type: 'reset' };

/** 스냅샷 한 대당 값 개수: x, y, heading, speed, 종료 사유 코드, 유효 진행률 */
export const CAR_STRIDE = 6;

/** 종료 사유 코드 (0 = 주행 중) */
export const END_CODES: readonly (EndReason | null)[] = [null, 'wall', 'brake', 'finish', 'timeLimit', 'noProgress', 'numeric'];

export interface CarCounts {
  running: number;
  wall: number;
  brake: number;
  finish: number;
  safety: number;
}

export interface Snapshot {
  type: 'snapshot';
  status: SimStatus;
  /** 자동 학습 중 */
  auto: boolean;
  skipping: boolean;
  generation: number;
  tick: number;
  /** 차 번호 (cars 배열 순서) */
  ids: number[];
  /** 차마다 CAR_STRIDE 개 값 */
  data: Float32Array;
  counts: CarCounts;
  /** 유효 진행률 (0 ~ 1) 최고·평균 */
  bestProgress: number;
  averageProgress: number;
  bestFitness: number;
  averageFitness: number;
  /** 이번 세대 가장 빠른 완주 (시뮬레이션 스텝) */
  bestFinish: { tick: number; id: number } | null;
  /** 실제로 계산되는 배속 (자동 학습 표시용) */
  actualSpeed: number;
}

export type WorkerEvent =
  | { type: 'pong'; id: number; protocolVersion: number }
  | Snapshot
  /** 한 세대 평가가 끝났다 */
  | { type: 'evaluated'; record: GenerationRecord; ghost: Ghost }
  /** 실험 전체 (저장용 / 불러오기 직후 화면 동기화용) */
  | { type: 'experiment'; requestId: number; experiment: Experiment }
  | { type: 'error'; message: string };
