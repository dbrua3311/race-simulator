// 한 세대의 주행. 모든 차가 같은 스텝에 동시에 출발하고, 서로 영향을 주지 않는다.
// 상태(World)는 평범한 데이터라 저장·복원·워커 전송이 그대로 된다.

import { nextUint32, type RngState } from '../core/rng';
import { forward, type Genome } from '../genetics/network';
import { gridSlots } from '../tracks/startGrid';
import type { Track } from '../tracks/types';
import { hitsWall, nearestIndex } from './collision';
import {
  BRAKE_STOP_SPEED,
  DT,
  MAX_RUN_TIME,
  MOVE_SPEED,
  NO_PROGRESS_TIME,
  PROGRESS_STEP,
} from './params';
import { stepPhysics } from './physics';
import { localS, updateProgress } from './progress';
import { readSensors, wallGrid } from './sensors';
import type { CarState, Control, EndReason } from './types';

export interface World {
  /** 지금까지 계산한 스텝 수. 시뮬레이션 시간 = tick × DT */
  tick: number;
  cars: CarState[];
  /** cars[i] 의 유전자(신경망 가중치) */
  genomes: Genome[];
  /** 모든 차가 종료되었는가 */
  finished: boolean;
}

/** 센서 값으로 명령을 정한다. 기본은 각 차의 신경망. 테스트에서 다른 조종기를 끼울 수 있다 */
export type Controller = (index: number, car: CarState, sensors: readonly number[]) => Control;

export const networkController =
  (world: World): Controller =>
  (index, _car, sensors) => {
    const [steer, throttle] = forward(world.genomes[index]!, sensors);
    return { steer: steer!, throttle: throttle! };
  };

/** 유전자마다 차 한 대를 출발 그리드에 무작위로 배치한다 (배치는 rng 로 결정 → 재현 가능) */
export function createWorld(track: Track, genomes: Genome[], rng: RngState): World {
  const slots = gridSlots(track, genomes.length);
  const order = shuffledIndices(genomes.length, rng);
  const n = track.center.length;
  const cars: CarState[] = order.map((slotId, i) => {
    const slot = slots[slotId]!;
    const trackIndex = (((Math.round(slot.s / track.spacing) % n) + n) % n);
    const raw = localS(track, trackIndex, slot.position.x, slot.position.y);
    // 출발선 뒤 자리는 음수 좌표로 (raw 는 트랙 끝쪽 값)
    const startS = raw > track.length / 2 ? raw - track.length : raw;
    return {
      id: i + 1,
      slot: slotId,
      x: slot.position.x,
      y: slot.position.y,
      heading: slot.heading,
      speed: 0,
      steer: 0,
      throttle: 0,
      trackIndex,
      ended: false,
      endReason: null,
      endTick: null,
      startS,
      s: startS,
      bestDistance: 0,
      bestTick: 0,
      nextGate: 0,
      hasMoved: false,
      progressMark: 0,
      progressMarkTick: 0,
    };
  });
  return { tick: 0, cars, genomes: genomes.map((g) => [...g]), finished: false };
}

const sensorBuffer: number[] = [];

/** 한 스텝(DT) 진행. 종료된 차는 위치·방향을 그대로 유지한다 */
export function stepWorld(world: World, track: Track, controller: Controller = networkController(world)) {
  if (world.finished) return;
  const grid = wallGrid(track);
  world.tick++;
  const tick = world.tick;
  let running = 0;
  for (let i = 0; i < world.cars.length; i++) {
    const car = world.cars[i]!;
    if (car.ended) continue;

    const sensors = readSensors(grid, car.x, car.y, car.heading, sensorBuffer);
    stepPhysics(car, controller(i, car, sensors), DT);
    if (car.speed >= MOVE_SPEED) car.hasMoved = true;

    if (!Number.isFinite(car.x) || !Number.isFinite(car.y) || !Number.isFinite(car.heading)) {
      end(car, tick, 'numeric');
      continue;
    }
    car.trackIndex = nearestIndex(track, car.trackIndex, car);
    const lapDone = updateProgress(car, track, tick);
    if (car.bestDistance >= car.progressMark + PROGRESS_STEP) {
      car.progressMark = car.bestDistance;
      car.progressMarkTick = tick;
    }

    // 정상 종료 3가지(벽·완주·브레이크)를 먼저, 그다음 안전 종료
    if (hitsWall(track, car.x, car.y, car.heading, car.trackIndex)) end(car, tick, 'wall');
    else if (lapDone) end(car, tick, 'finish');
    else if (car.hasMoved && car.throttle < 0 && car.speed <= BRAKE_STOP_SPEED) end(car, tick, 'brake');
    else if ((tick - car.progressMarkTick) * DT >= NO_PROGRESS_TIME) end(car, tick, 'noProgress');
    else if (tick * DT >= MAX_RUN_TIME) end(car, tick, 'timeLimit');
    else running++;
  }
  if (running === 0) world.finished = true;
}

/** steps 스텝 진행 (도중에 모두 종료되면 멈춘다). 실제로 진행한 스텝 수를 돌려준다 */
export function advance(world: World, track: Track, steps: number, controller?: Controller): number {
  const control = controller ?? networkController(world);
  let done = 0;
  while (done < steps && !world.finished) {
    stepWorld(world, track, control);
    done++;
  }
  return done;
}

function end(car: CarState, tick: number, reason: EndReason) {
  car.ended = true;
  car.endReason = reason;
  car.endTick = tick;
}

function shuffledIndices(count: number, rng: RngState): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = nextUint32(rng) % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}
