// 메인 스레드 ↔ 시뮬레이션 워커 메시지 형식.

import type { Track } from '../tracks/types';
import type { EndReason } from '../simulation/types';

export const PROTOCOL_VERSION = 3;

export type SimStatus = 'idle' | 'ready' | 'running' | 'paused' | 'finished';

export type WorkerCommand =
  | { type: 'ping'; id: number }
  /** 자동차를 출발 그리드에 세운다 (아직 출발하지 않음) */
  | { type: 'prepare'; track: Track; count: number; seed: string }
  /** 모든 차 동시 출발 */
  | { type: 'go' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setSpeed'; speed: number }
  /** 남은 주행을 화면 갱신 없이 최대한 빨리 계산 (강제 종료가 아님) */
  | { type: 'skip' }
  | { type: 'reset' };

/** 스냅샷 한 대당 값 개수: x, y, heading, speed, 종료 사유 코드 */
export const CAR_STRIDE = 5;

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
  skipping: boolean;
  tick: number;
  /** 차 번호 (cars 배열 순서) */
  ids: number[];
  /** 차마다 CAR_STRIDE 개 값 */
  data: Float32Array;
  counts: CarCounts;
  /** 유효 진행률 (0 ~ 1) 최고·평균 */
  bestProgress: number;
  averageProgress: number;
  /** 이번 세대 가장 빠른 완주 (시뮬레이션 스텝) */
  bestFinish: { tick: number; id: number } | null;
}

export type WorkerEvent = { type: 'pong'; id: number; protocolVersion: number } | Snapshot;
