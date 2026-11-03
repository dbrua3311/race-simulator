import type { Track } from '../tracks/types';
import type { Snapshot, WorkerCommand, WorkerEvent } from '../workers/protocol';

export type WorkerStatus =
  | { kind: 'connecting' }
  | { kind: 'connected'; roundTripMs: number; protocolVersion: number }
  | { kind: 'unavailable'; reason: string };

export interface SimClient {
  prepare(track: Track, count: number, seed: string): void;
  go(): void;
  pause(): void;
  resume(): void;
  setSpeed(speed: number): void;
  skip(): void;
  reset(): void;
  /** 가장 최근 스냅샷 (렌더 루프가 매 프레임 읽는다) */
  latest(): Snapshot | null;
  dispose(): void;
}

interface Handlers {
  onWorkerStatus(status: WorkerStatus): void;
  /** 스냅샷마다 호출된다. 무거운 일(React 상태 갱신)은 받는 쪽에서 걸러야 한다 */
  onSnapshot(snapshot: Snapshot): void;
}

/** 시뮬레이션 워커를 띄우고 명령을 보낸다 */
export function createSimClient(handlers: Handlers): SimClient {
  let latest: Snapshot | null = null;

  if (typeof Worker === 'undefined') {
    handlers.onWorkerStatus({ kind: 'unavailable', reason: '이 환경은 Web Worker 를 지원하지 않습니다' });
    const noop = () => {};
    return {
      prepare: noop,
      go: noop,
      pause: noop,
      resume: noop,
      setSpeed: noop,
      skip: noop,
      reset: noop,
      latest: () => null,
      dispose: noop,
    };
  }

  const worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' });
  const send = (command: WorkerCommand) => worker.postMessage(command);
  const pingSentAt = performance.now();

  worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
    const message = event.data;
    if (message.type === 'pong') {
      handlers.onWorkerStatus({
        kind: 'connected',
        roundTripMs: performance.now() - pingSentAt,
        protocolVersion: message.protocolVersion,
      });
    } else {
      latest = message;
      handlers.onSnapshot(message);
    }
  };
  worker.onerror = (event) => {
    handlers.onWorkerStatus({ kind: 'unavailable', reason: `워커 오류: ${event.message}` });
  };
  send({ type: 'ping', id: 1 });

  return {
    prepare: (track, count, seed) => {
      latest = null;
      send({ type: 'prepare', track, count, seed });
    },
    go: () => send({ type: 'go' }),
    pause: () => send({ type: 'pause' }),
    resume: () => send({ type: 'resume' }),
    setSpeed: (speed) => send({ type: 'setSpeed', speed }),
    skip: () => send({ type: 'skip' }),
    reset: () => {
      latest = null;
      send({ type: 'reset' });
    },
    latest: () => latest,
    dispose: () => worker.terminate(),
  };
}
