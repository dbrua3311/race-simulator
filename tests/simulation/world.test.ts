import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { DT, MAX_RUN_TIME } from '../../src/simulation/params';
import { advance, createWorld, createWorldFromSeed, stepWorld, type World } from '../../src/simulation/world';
import { gridSlots } from '../../src/tracks/startGrid';
import { testTrack } from './helpers';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('한 세대 주행', () => {
  const track = testTrack();

  it('50대가 서로 다른 그리드 자리에 정지 상태로 선다', () => {
    const world = createWorldFromSeed(track, 50, 'A');
    expect(world.cars.map((c) => c.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(new Set(world.cars.map((c) => c.slot)).size).toBe(50);
    const slots = gridSlots(track, 50);
    for (const car of world.cars) {
      expect(car.speed).toBe(0);
      expect({ x: car.x, y: car.y }).toEqual(slots[car.slot]!.position);
    }
  });

  it('같은 시드는 같은 배치·같은 주행, 다른 시드는 다른 배치', () => {
    const a = createWorldFromSeed(track, 50, 'A');
    const b = createWorldFromSeed(track, 50, 'A');
    advance(a, track, 600);
    advance(b, track, 600);
    expect(a).toEqual(b);
    expect(createWorldFromSeed(track, 50, 'B').cars.map((c) => c.slot)).not.toEqual(
      createWorldFromSeed(track, 50, 'A').cars.map((c) => c.slot),
    );
  });

  it('모든 차가 같은 스텝에 동시에 출발한다', () => {
    const world = createWorldFromSeed(track, 50, 'A');
    stepWorld(world, track);
    expect(world.tick).toBe(1);
    expect(world.cars.every((c) => c.speed > 0)).toBe(true);
  });

  it('자동차끼리는 서로 영향을 주지 않는다: 혼자 달려도 50대 속에서 달려도 똑같다', () => {
    const crowd = createWorldFromSeed(track, 50, 'A');
    for (const k of [0, 17, 49]) {
      const alone: World = { tick: 0, cars: [clone(crowd.cars[k]!)], drivers: [clone(crowd.drivers[k]!)], finished: false };
      const together = clone(crowd);
      advance(alone, track, 1500);
      advance(together, track, 1500);
      expect(alone.cars[0]).toEqual(together.cars[k]);
    }
  });

  it('벽에 닿으면 종료되고, 그 뒤로 위치·방향이 그대로다', () => {
    const world = createWorldFromSeed(track, 50, 'A');
    let crashed = -1;
    while (crashed < 0 && !world.finished) {
      stepWorld(world, track);
      crashed = world.cars.findIndex((c) => c.endReason === 'wall');
    }
    expect(crashed).toBeGreaterThanOrEqual(0);
    const frozen = clone(world.cars[crashed]!);
    advance(world, track, 600);
    expect(world.cars[crashed]).toEqual(frozen);
    expect(frozen.endTick).toBeGreaterThan(0);
  });

  it('스텝을 나눠 계산해도 한 번에 계산한 것과 같다 (배속과 무관)', () => {
    const a = createWorldFromSeed(track, 50, 'C');
    const b = createWorldFromSeed(track, 50, 'C');
    for (let i = 0; i < 900; i++) advance(a, track, 1);
    advance(b, track, 900);
    expect(a).toEqual(b);
  });

  it('언젠가 모든 차가 종료되고, 시간 제한을 넘지 않는다', () => {
    const world = createWorld(track, 30, createRng('end'));
    advance(world, track, Math.ceil(MAX_RUN_TIME / DT) + 10);
    expect(world.finished).toBe(true);
    expect(world.cars.every((c) => c.ended)).toBe(true);
    expect(world.tick * DT).toBeLessThanOrEqual(MAX_RUN_TIME + DT);
  });
});
