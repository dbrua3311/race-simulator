import { handleCommand, type WorkerCommand, type WorkerEvent } from './protocol';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerCommand>) => void) | null;
  postMessage(message: WorkerEvent): void;
};

scope.onmessage = (event) => {
  for (const reply of handleCommand(event.data)) scope.postMessage(reply);
};
