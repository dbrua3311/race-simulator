import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, handleCommand } from '../../src/workers/protocol';

describe('워커 프로토콜', () => {
  it('ping 에 같은 id 의 pong 으로 답한다', () => {
    expect(handleCommand({ type: 'ping', id: 7 })).toEqual([
      { type: 'pong', id: 7, protocolVersion: PROTOCOL_VERSION },
    ]);
  });
});
