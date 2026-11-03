import type { GaSettings } from '../genetics/params';
import type { Experiment, GenerationRecord, Ghost } from '../simulation/experiment';
import type { Track } from '../tracks/types';
import type { Snapshot, WorkerCommand, WorkerEvent } from '../workers/protocol';

export type WorkerStatus =
  | { kind: 'connecting' }
  | { kind: 'connected'; roundTripMs: number; protocolVersion: number }
  | { kind: 'unavailable'; reason: string };

export interface SimClient {
  newExperiment(track: Track, settings: GaSettings, seed: string): void;
  resetLearning(seed: string): void;
  updateSettings(settings: GaSettings): void;
  go(): void;
  pause(): void;
  resume(): void;
  setSpeed(speed: number): void;
  skip(): void;
  confirmParents(generation: number, parentIds: number[]): void;
  autoSelect(generation: number): void;
  startAuto(): void;
  stopAuto(): void;
  /** 실험 전체를 받아 온다 (저장용) */
  exportExperiment(): Promise<Experiment>;
  loadExperiment(experiment: Experiment): void;
  reset(): void;
  /** 가장 최근 스냅샷 (렌더 루프가 매 프레임 읽는다) */
  latest(): Snapshot | null;
  dispose(): void;
}

export interface SimHandlers {
  onWorkerStatus(status: WorkerStatus): void;
  /** 스냅샷마다 호출된다. 무거운 일(React 상태 갱신)은 받는 쪽에서 걸러야 한다 */
  onSnapshot(snapshot: Snapshot): void;
  onEvaluated(record: GenerationRecord, ghost: Ghost): void;
  /** 불러오기 직후 워커가 보내는 실험 전체 */
  onLoaded(experiment: Experiment): void;
  onError(message: string): void;
}

/** 시뮬레이션 워커를 띄우고 명령을 보낸다 */
export function createSimClient(handlers: SimHandlers): SimClient {
  let latest: Snapshot | null = null;

  if (typeof Worker === 'undefined') {
    handlers.onWorkerStatus({ kind: 'unavailable', reason: '이 환경은 Web Worker 를 지원하지 않습니다' });
    const noop = () => {};
    return {
      newExperiment: noop,
      resetLearning: noop,
      updateSettings: noop,
      go: noop,
      pause: noop,
      resume: noop,
      setSpeed: noop,
      skip: noop,
      confirmParents: noop,
      autoSelect: noop,
      startAuto: noop,
      stopAuto: noop,
      exportExperiment: () => Promise.reject(new Error('시뮬레이션 엔진을 사용할 수 없습니다')),
      loadExperiment: noop,
      reset: noop,
      latest: () => null,
      dispose: noop,
    };
  }

  const worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' });
  const send = (command: WorkerCommand) => worker.postMessage(command);
  const pingSentAt = performance.now();
  const pending = new Map<number, (experiment: Experiment) => void>();
  let nextRequest = 1;

  worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
    const message = event.data;
    switch (message.type) {
      case 'pong':
        handlers.onWorkerStatus({
          kind: 'connected',
          roundTripMs: performance.now() - pingSentAt,
          protocolVersion: message.protocolVersion,
        });
        return;
      case 'snapshot':
        latest = message;
        handlers.onSnapshot(message);
        return;
      case 'evaluated':
        handlers.onEvaluated(message.record, message.ghost);
        return;
      case 'experiment': {
        const resolve = pending.get(message.requestId);
        if (resolve) {
          pending.delete(message.requestId);
          resolve(message.experiment);
        } else handlers.onLoaded(message.experiment);
        return;
      }
      case 'error':
        handlers.onError(message.message);
        return;
    }
  };
  worker.onerror = (event) => {
    handlers.onWorkerStatus({ kind: 'unavailable', reason: `워커 오류: ${event.message}` });
  };
  send({ type: 'ping', id: 1 });

  return {
    newExperiment: (track, settings, seed) => {
      latest = null;
      send({ type: 'newExperiment', track, settings, seed });
    },
    resetLearning: (seed) => send({ type: 'resetLearning', seed }),
    updateSettings: (settings) => send({ type: 'updateSettings', settings }),
    go: () => send({ type: 'go' }),
    pause: () => send({ type: 'pause' }),
    resume: () => send({ type: 'resume' }),
    setSpeed: (speed) => send({ type: 'setSpeed', speed }),
    skip: () => send({ type: 'skip' }),
    confirmParents: (generation, parentIds) => send({ type: 'confirmParents', generation, parentIds }),
    autoSelect: (generation) => send({ type: 'autoSelect', generation }),
    startAuto: () => send({ type: 'startAuto' }),
    stopAuto: () => send({ type: 'stopAuto' }),
    exportExperiment: () =>
      new Promise((resolve) => {
        const requestId = nextRequest++;
        pending.set(requestId, resolve);
        send({ type: 'exportExperiment', requestId });
      }),
    loadExperiment: (experiment) => send({ type: 'loadExperiment', experiment }),
    reset: () => {
      latest = null;
      send({ type: 'reset' });
    },
    latest: () => latest,
    dispose: () => worker.terminate(),
  };
}
