// 공식 순위와 적합도 (원문 19~21절).
//
// 공식 순위 (금색 챔피언·1등·고스트 기준):
//   1. 유효 진행률 높은 순 (완주 = 100%). 종료 사유(벽·브레이크)는 진행률보다 우선하지 않는다
//   2. 둘 다 완주했으면 완주 시간이 짧은 순
//   3. 진행률이 같으면 그 진행률에 먼저 도달한 순 (bestTick)
//   4. 그래도 같으면 번호가 작은 순
// 적합도: 미완주 = 진행률 × 100, 완주 = 100 + 시간 보너스(0 ~ 50).
//   → 적합도 순서가 공식 순위와 항상 같다. 빠르기만 하고 덜 간 차가 더 멀리 간 차보다 높아질 수 없다.

import { DT, MAX_RUN_TIME } from '../simulation/params';
import { progressOf } from '../simulation/progress';
import type { CarState } from '../simulation/types';
import type { Track } from '../tracks/types';

const FINISH_BONUS = 50;

export function finishTime(car: CarState): number | null {
  return car.endReason === 'finish' && car.endTick !== null ? car.endTick * DT : null;
}

export function fitnessOf(car: CarState, track: Track): number {
  const time = finishTime(car);
  if (time !== null) return 100 + FINISH_BONUS * Math.max(0, 1 - time / MAX_RUN_TIME);
  return progressOf(car, track) * 100;
}

/** 공식 순위 비교: 음수면 a 가 앞선다 */
export function compareCars(a: CarState, b: CarState, track: Track): number {
  const pa = progressOf(a, track);
  const pb = progressOf(b, track);
  if (pa !== pb) return pb - pa;
  const ta = finishTime(a);
  const tb = finishTime(b);
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;
  if (a.bestTick !== b.bestTick) return a.bestTick - b.bestTick;
  return a.id - b.id;
}

/** 공식 순위대로 정렬한 차 인덱스 (0번이 1등) */
export function rankCars(cars: readonly CarState[], track: Track): number[] {
  return cars.map((_, i) => i).sort((i, j) => compareCars(cars[i]!, cars[j]!, track));
}
