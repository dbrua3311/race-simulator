import type { WorkerCommand, WorkerEvent } from '../workers/protocol';

export type WorkerStatus =
  | { kind: 'connecting' }
  | { kind: 'connected'; roundTripMs: number; protocolVersion: number }
  | { kind: 'unavailable'; reason: string };

/** 시뮬레이션 워커를 띄우고 연결을 확인한다. 반환값은 정리 함수. */
export function connectSimWorker(onStatus: (status: WorkerStatus) => void): () => void {
  if (typeof Worker === 'undefined') {
    onStatus({ kind: 'unavailable', reason: '이 환경은 Web Worker 를 지원하지 않습니다' });
    return () => {};
  }

  const worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' });
  const sentAt = new Map<number, number>();

  const send = (command: WorkerCommand) => worker.postMessage(command);

  worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
    const message = event.data;
    if (message.type === 'pong') {
      const start = sentAt.get(message.id);
      sentAt.delete(message.id);
      if (start !== undefined) {
        onStatus({
          kind: 'connected',
          roundTripMs: performance.now() - start,
          protocolVersion: message.protocolVersion,
        });
      }
    }
  };
  worker.onerror = (event) => {
    onStatus({ kind: 'unavailable', reason: `워커 오류: ${event.message}` });
  };

  const pingId = 1;
  sentAt.set(pingId, performance.now());
  send({ type: 'ping', id: pingId });

  return () => worker.terminate();
}
