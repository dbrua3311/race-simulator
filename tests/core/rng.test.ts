import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, randomInt } from '../../src/core/rng';

describe('시드 난수', () => {
  it('같은 시드는 같은 수열을 만든다', () => {
    const a = createRng('ABC');
    const b = createRng('ABC');
    const seqA = Array.from({ length: 20 }, () => nextFloat(a));
    const seqB = Array.from({ length: 20 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 수열을 만든다', () => {
    const a = createRng('ABC');
    const b = createRng('ABD');
    expect(nextFloat(a)).not.toBe(nextFloat(b));
  });

  it('상태를 JSON 으로 저장했다가 이어서 같은 수를 낸다', () => {
    const rng = createRng('save');
    nextFloat(rng);
    const restored = JSON.parse(JSON.stringify(rng));
    expect(nextFloat(restored)).toBe(nextFloat(rng));
  });

  it('[0, 1) 범위이고 정수 범위를 지킨다', () => {
    const rng = createRng('range');
    for (let i = 0; i < 10000; i++) {
      const f = nextFloat(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = randomInt(rng, 3, 5);
      expect([3, 4, 5]).toContain(n);
    }
  });
});
