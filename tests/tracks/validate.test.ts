import { describe, expect, it } from 'vitest';
import { offsetWalls } from '../../src/tracks/generate';
import { closedLength } from '../../src/tracks/geometry';
import { TRACK } from '../../src/tracks/params';
import { validateTrack } from '../../src/tracks/validate';
import type { Vec } from '../../src/core/vec';
import { figureEight, polarShape } from './shapes';

function check(center: Vec[]) {
  const { left, right } = offsetWalls(center, TRACK.roadWidth / 2);
  return validateTrack(center, left, right, closedLength(center) / center.length, 'easy');
}

describe('트랙 검증', () => {
  it('넓은 원형 트랙은 통과한다', () => {
    expect(check(polarShape(() => 90))).toMatchObject({ ok: true, issues: [] });
  });

  it('8자(교차로가 있는 트랙)는 거부한다', () => {
    const result = check(figureEight(260));
    expect(result.ok).toBe(false);
  });

  it('좁고 깊게 파인 곳(양쪽 도로가 맞닿음)이 있는 트랙은 거부한다', () => {
    const inlet = (t: number) => 75 * (1 - 0.85 * Math.exp(-(((t - Math.PI / 2) / 0.12) ** 2)));
    const result = check(polarShape(inlet));
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatch(/tooClose|tooSharp|wallIntersection|centerIntersection/);
  });

  it('너무 짧은 트랙은 거부한다', () => {
    expect(check(polarShape(() => 60)).issues).toEqual(['length']);
  });
});
