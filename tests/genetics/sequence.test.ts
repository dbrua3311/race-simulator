import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import {
  SEQUENCE_GENES,
  SEQUENCE_SEGMENT,
  crossoverSequence,
  frontierStep,
  mutateSequence,
  randomSequence,
  sequenceControl,
} from '../../src/genetics/sequence';

describe('조작 순서 유전자', () => {
  it('구간마다 [조향, 페달] 쌍, 값은 -1 ~ 1', () => {
    const g = randomSequence(createRng('s'));
    expect(g).toHaveLength(SEQUENCE_GENES);
    for (const v of g) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });

  it('출발점에서 온 거리에 맞는 조작을 한다', () => {
    const g = randomSequence(createRng('s'));
    expect(sequenceControl(g, 0)).toEqual({ steer: g[0], throttle: g[1] });
    expect(sequenceControl(g, SEQUENCE_SEGMENT * 3 + 0.5)).toEqual({ steer: g[6], throttle: g[7] });
    expect(sequenceControl(g, 1e9)).toEqual({ steer: 0, throttle: 0 });
  });

  it('변주는 부모가 멈춘 지점 앞쪽은 그대로 두고 뒤쪽만 바꾼다', () => {
    const rng = createRng('m');
    for (let k = 0; k < 50; k++) {
      const parent = randomSequence(rng);
      const child = [...parent];
      const frontier = frontierStep({ reached: 150 }, rng)!;
      expect(frontier).toBeLessThan(150 / SEQUENCE_SEGMENT);
      const changed = mutateSequence(child, frontier, 0.15, 0.25, rng);
      expect(changed).toBeGreaterThan(0);
      expect(child.slice(0, 2 * frontier)).toEqual(parent.slice(0, 2 * frontier));
      expect(child).not.toEqual(parent);
    }
  });

  it('교차: 자른 지점 앞은 a, 뒤는 b', () => {
    const rng = createRng('c');
    const a = randomSequence(rng);
    const b = randomSequence(rng);
    const c = crossoverSequence(a, b, 10);
    expect(c.slice(0, 20)).toEqual(a.slice(0, 20));
    expect(c.slice(20)).toEqual(b.slice(20));
  });
});
