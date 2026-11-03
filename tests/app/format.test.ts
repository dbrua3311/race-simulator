import { describe, expect, it } from 'vitest';
import { finishRecordText, formatSimTime } from '../../src/app/format';

describe('시간 표시', () => {
  it('mm:ss.cc 형식', () => {
    expect(formatSimTime(0)).toBe('00:00.00');
    expect(formatSimTime(5.25)).toBe('00:05.25');
    expect(formatSimTime(83.4)).toBe('01:23.40');
    expect(formatSimTime(1 / 60)).toBe('00:00.01');
  });

  it('완주 기록: 아직 없음 / 시간 / 세대 끝났는데 없음', () => {
    expect(finishRecordText(null, false)).toBe('--:--.--');
    expect(finishRecordText(null, true)).toBe('완주 기록 없음');
    expect(finishRecordText({ tick: 60 * 75 + 30 }, true)).toBe('01:15.50');
  });
});
