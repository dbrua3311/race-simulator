// 한 세대의 주행. 모든 차가 같은 스텝에 동시에 출발하고, 서로 영향을 주지 않는다.
// 상태(World)는 평범한 데이터라 저장·복원·워커 전송이 그대로 된다.

import { createRng, nextUint32, type RngState } from '../core/rng';
import { gridSlots } from '../tracks/startGrid';
import type { Track } from '../tracks/types';
import { hitsWall, nearestIndex } from './collision';
import { DT, MAX_RUN_TIME } from './params';
import { stepPhysics } from './physics';
import { randomTestDriver, testDriverControl, type TestDriver } from './testDriver';
import type { CarState, EndReason } from './types';

export interface World {
  /** 지금까지 계산한 스텝 수. 시뮬레이션 시간 = tick × DT */
  tick: number;
  cars: CarState[];
  drivers: TestDriver[];
  /** 모든 차가 종료되었는가 */
  finished: boolean;
}

/** 자동차 count 대를 출발 그리드에 무작위로 배치한다 (배치는 rng 로 결정 → 재현 가능) */
export function createWorld(track: Track, count: number, rng: RngState): World {
  const slots = gridSlots(track, count);
  const order = shuffledIndices(count, rng);
  const n = track.center.length;
  const cars: CarState[] = order.map((slotId, i) => {
    const slot = slots[slotId]!;
    return {
      id: i + 1,
      slot: slotId,
      x: slot.position.x,
      y: slot.position.y,
      heading: slot.heading,
      speed: 0,
      steer: 0,
      throttle: 0,
      trackIndex: (((Math.round(slot.s / track.spacing) % n) + n) % n),
      ended: false,
      endReason: null,
      endTick: null,
    };
  });
  return { tick: 0, cars, drivers: cars.map(() => randomTestDriver(rng)), finished: false };
}

export function createWorldFromSeed(track: Track, count: number, seed: string): World {
  return createWorld(track, count, createRng(`race-simulator/run/${seed}`));
}

/** 한 스텝(DT) 진행. 종료된 차는 위치·방향을 그대로 유지한다 */
export function stepWorld(world: World, track: Track) {
  if (world.finished) return;
  const time = world.tick * DT;
  world.tick++;
  let running = 0;
  for (let i = 0; i < world.cars.length; i++) {
    const car = world.cars[i]!;
    if (car.ended) continue;
    stepPhysics(car, testDriverControl(world.drivers[i]!, time), DT);
    car.trackIndex = nearestIndex(track, car.trackIndex, car);

    if (!Number.isFinite(car.x) || !Number.isFinite(car.y) || !Number.isFinite(car.heading)) end(car, world, 'numeric');
    else if (hitsWall(track, car.x, car.y, car.heading, car.trackIndex)) end(car, world, 'wall');
    else if (world.tick * DT >= MAX_RUN_TIME) end(car, world, 'timeLimit');
    else running++;
  }
  if (running === 0) world.finished = true;
}

/** steps 스텝 진행 (도중에 모두 종료되면 멈춘다). 실제로 진행한 스텝 수를 돌려준다 */
export function advance(world: World, track: Track, steps: number): number {
  let done = 0;
  while (done < steps && !world.finished) {
    stepWorld(world, track);
    done++;
  }
  return done;
}

function end(car: CarState, world: World, reason: EndReason) {
  car.ended = true;
  car.endReason = reason;
  car.endTick = world.tick;
  car.speed = 0;
}

function shuffledIndices(count: number, rng: RngState): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = nextUint32(rng) % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}
