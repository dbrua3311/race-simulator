import { describe, expect, it } from 'vitest';
import { compareCars, fitnessOf, rankCars } from '../../src/genetics/fitness';
import { DT } from '../../src/simulation/params';
import type { CarState } from '../../src/simulation/types';
import { blankCar, testTrack } from '../simulation/helpers';

const track = testTrack();
const L = track.length;
const car = (id: number, progress: number, extra: Partial<CarState> = {}): CarState => ({
  ...blankCar(),
  id,
  bestDistance: progress * L,
  ended: true,
  endReason: 'wall',
  ...extra,
});

describe('공식 순위와 적합도', () => {
  it('완주하지 못해도 가장 멀리 간 차가 1등 (예시: 35 / 82 / 64 / 91%)', () => {
    const cars = [car(1, 0.35), car(2, 0.82, { endReason: 'brake' }), car(3, 0.64), car(4, 0.91)];
    expect(rankCars(cars, track).map((i) => cars[i]!.id)).toEqual([4, 2, 3, 1]);
  });

  it('완주한 차끼리는 완주 시간이 짧은 차가 앞선다', () => {
    const a = car(1, 1, { endReason: 'finish', endTick: 90 / DT });
    const b = car(2, 1, { endReason: 'finish', endTick: 80 / DT });
    expect(compareCars(b, a, track)).toBeLessThan(0);
    expect(fitnessOf(b, track)).toBeGreaterThan(fitnessOf(a, track));
  });

  it('진행률이 같으면 먼저 도달한 차, 그래도 같으면 번호가 작은 차', () => {
    const late = car(1, 0.5, { bestTick: 900 });
    const early = car(2, 0.5, { bestTick: 600 });
    expect(compareCars(early, late, track)).toBeLessThan(0);
    const same = car(3, 0.5, { bestTick: 600 });
    expect(compareCars(early, same, track)).toBeLessThan(0);
  });

  it('적합도 순서는 공식 순위와 항상 같다 (빠르기만 한 차가 더 멀리 간 차를 이기지 못함)', () => {
    const cars = [
      car(1, 0.999),
      car(2, 1, { endReason: 'finish', endTick: 299 / DT }),
      car(3, 0.4),
      car(4, 1, { endReason: 'finish', endTick: 70 / DT }),
    ];
    const byRank = rankCars(cars, track).map((i) => fitnessOf(cars[i]!, track));
    expect(byRank).toEqual([...byRank].sort((a, b) => b - a));
    expect(fitnessOf(cars[1]!, track)).toBeGreaterThan(fitnessOf(cars[0]!, track));
  });
});
