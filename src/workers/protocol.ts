// 메인 스레드 ↔ 시뮬레이션 워커 메시지 형식.
// 1단계에서는 연결 확인(ping/pong)만 있다. 이후 단계에서 시작·일시정지·배속·자동 학습 명령을 추가한다.

export const PROTOCOL_VERSION = 1;

export type WorkerCommand = { type: 'ping'; id: number };

export type WorkerEvent = { type: 'pong'; id: number; protocolVersion: number };

export function handleCommand(command: WorkerCommand): WorkerEvent[] {
  switch (command.type) {
    case 'ping':
      return [{ type: 'pong', id: command.id, protocolVersion: PROTOCOL_VERSION }];
  }
}
