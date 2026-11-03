import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { randomGenome } from '../../src/genetics/genome';
import { forward, parameterCount } from '../../src/genetics/network';

describe('신경망', () => {
  it('5-6-2 구조는 파라미터 50개', () => {
    expect(parameterCount([5, 6, 2])).toBe(50);
    expect(randomGenome(createRng('g'))).toHaveLength(50);
  });

  it('출력 2개는 -1 ~ 1 이고, 같은 유전자·입력이면 같은 출력', () => {
    const g = randomGenome(createRng('g'));
    const out = forward(g, [0.1, 0.5, 0.9, 0.3, 1]);
    expect(out).toHaveLength(2);
    for (const v of out) expect(Math.abs(v)).toBeLessThan(1);
    expect(forward(g, [0.1, 0.5, 0.9, 0.3, 1])).toEqual(out);
  });

  it('손으로 계산한 값과 같다', () => {
    // 1-1-1 신경망: h = tanh(w1·x + b1), y = tanh(w2·h + b2)
    const out = forward([2, 0.5, -1, 0.25], [0.3], [1, 1, 1]);
    const h = Math.tanh(2 * 0.3 + 0.5);
    expect(out[0]).toBeCloseTo(Math.tanh(-1 * h + 0.25), 12);
  });

  it('유전자가 다르면 운전이 달라진다 (입력에 실제로 반응한다)', () => {
    const rng = createRng('diff');
    const a = randomGenome(rng);
    const b = randomGenome(rng);
    expect(forward(a, [0.2, 0.2, 0.2, 0.2, 0.2])).not.toEqual(forward(b, [0.2, 0.2, 0.2, 0.2, 0.2]));
    expect(forward(a, [0.2, 0.2, 0.2, 0.2, 0.2])).not.toEqual(forward(a, [1, 0, 1, 0, 1]));
  });
});
