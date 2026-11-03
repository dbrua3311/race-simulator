import type { WorkerCommand, WorkerEvent } from './protocol';
import { SimLoop } from './simLoop';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerCommand>) => void) | null;
  postMessage(message: WorkerEvent, transfer?: Transferable[]): void;
};

const loop = new SimLoop({
  now: () => performance.now(),
  schedule: (fn, delay) => setTimeout(fn, delay),
  post: (event, transfer) => scope.postMessage(event, transfer ?? []),
});

scope.onmessage = (event) => loop.handle(event.data);
