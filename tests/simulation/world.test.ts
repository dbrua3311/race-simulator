import { describe, expect, it } from 'vitest';
import { DT, MAX_RUN_TIME, NO_PROGRESS_TIME } from '../../src/simulation/params';
import { advance, stepWorld, type Controller } from '../../src/simulation/world';
import { gridSlots } from '../../src/tracks/startGrid';
import { clone, followCenterline, only, randomWorld, testTrack } from './helpers';


describe('한 세대 주행', () => {
  const track = testTrack();

  it('50대가 서로 다른 그리드 자리에 정지 상태로 선다', () => {
    const world = randomWorld(track, 50, 'A');
    expect(world.cars.map((c) => c.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(new Set(world.cars.map((c) => c.slot)).size).toBe(50);
    const slots = gridSlots(track, 50);
    for (const car of world.cars) {
      expect(car.speed).toBe(0);
      expect({ x: car.x, y: car.y }).toEqual(slots[car.slot]!.position);
    }
  });

  it('같은 시드는 같은 배치·같은 주행', () => {
    const a = randomWorld(track, 50, 'A');
    const b = randomWorld(track, 50, 'A');
    advance(a, track, 900);
    advance(b, track, 900);
    expect(a).toEqual(b);
  });

  it('모든 차가 같은 스텝에 동시에 출발한다 (같은 tick 으로 계산)', () => {
    const world = randomWorld(track, 50, 'A');
    stepWorld(world, track);
    expect(world.tick).toBe(1);
    expect(world.cars.every((c) => c.endReason === null)).toBe(true);
  });

  it('자동차끼리는 서로 영향을 주지 않는다: 혼자 달려도 50대 속에서 달려도 똑같다', () => {
    const crowd = randomWorld(track, 50, 'A');
    const together = clone(crowd);
    advance(together, track, 60 * 40);
    for (const k of [0, 17, 49]) {
      const alone = only(crowd, k);
      advance(alone, track, 60 * 40);
      expect(alone.cars[0]).toEqual(together.cars[k]);
    }
  });

  it('종료되면 그 뒤로 위치·방향이 그대로다', () => {
    const world = randomWorld(track, 50, 'A');
    let k = -1;
    while (k < 0 && !world.finished) {
      stepWorld(world, track);
      k = world.cars.findIndex((c) => c.ended);
    }
    const frozen = clone(world.cars[k]!);
    advance(world, track, 600);
    expect(world.cars[k]).toEqual(frozen);
  });

  it('스텝을 나눠 계산해도 한 번에 계산한 것과 같다 (배속과 무관)', () => {
    const a = randomWorld(track, 50, 'C');
    const b = randomWorld(track, 50, 'C');
    for (let i = 0; i < 900; i++) advance(a, track, 1);
    advance(b, track, 900);
    expect(a).toEqual(b);
  });

  it('무작위 신경망 세대는 언젠가 모두 종료되고, 실제로 서로 다르게 달린다', () => {
    const world = randomWorld(track, 50, 'gen1');
    advance(world, track, Math.ceil(MAX_RUN_TIME / DT) + 10);
    expect(world.finished).toBe(true);
    const distances = new Set(world.cars.map((c) => c.bestDistance.toFixed(1)));
    expect(distances.size).toBeGreaterThan(10);
  });
});

describe('종료 조건', () => {
  const track = testTrack();
  const base = randomWorld(track, 50, 'end');
  const front = base.cars.findIndex((c) => c.slot === 2);
  const steerOnly = followCenterline(track);
  const run = (controller: Controller, seconds = 60) => {
    const world = only(base, front);
    advance(world, track, Math.round(seconds / DT), controller);
    return world.cars[0]!;
  };

  it('달리다가 브레이크로 완전히 멈추면 브레이크 정지', () => {
    const car = run((i, c, s) => ({ ...steerOnly(i, c, s), throttle: c.hasMoved && c.speed > 0 ? -1 : 1 }));
    expect(car.endReason).toBe('brake');
    expect(car.speed).toBeLessThanOrEqual(0.05);
  });

  it('처음부터 제동만 하면(출발 직후 속도 0) 브레이크 정지가 아니라 안전 종료(진행 없음)', () => {
    const car = run(() => ({ steer: 0, throttle: -1 }));
    expect(car.endReason).toBe('noProgress');
    expect(car.endTick! * DT).toBeCloseTo(NO_PROGRESS_TIME, 1);
  });

  it('가속도 제동도 안 하면 진행 없음으로 안전 종료', () => {
    expect(run(() => ({ steer: 0, throttle: 0 })).endReason).toBe('noProgress');
  });

  it('제동 없이 저절로 느려지는 것은 브레이크 정지가 아니다', () => {
    const car = run((i, c, s) => ({ ...steerOnly(i, c, s), throttle: c.speed > 8 || c.hasMoved ? 0 : 1 }), 200);
    expect(car.endReason).not.toBe('brake');
  });

  it('벽으로 돌진하면 벽 충돌', () => {
    expect(run(() => ({ steer: 1, throttle: 1 })).endReason).toBe('wall');
  });

  it('아주 천천히 계속 나아가면 시간 제한으로 안전 종료', () => {
    const car = run((i, c, s) => ({ ...steerOnly(i, c, s), throttle: c.speed < 0.6 ? 0.2 : -0.02 }), MAX_RUN_TIME + 5);
    expect(car.endReason).toBe('timeLimit');
  });
});
