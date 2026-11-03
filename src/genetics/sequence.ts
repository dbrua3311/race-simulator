// "조작 순서" 운전 방식 (DECISIONS D35).
// 유전자 = 트랙을 따라 SEGMENT 미터마다의 [조향, 가속/제동] 쌍. 차는 센서를 쓰지 않고, 출발점에서 몇 m 왔는지에 따라
// 정해진 조작을 한다 → 이 트랙의 "어디서 어떻게 꺾을지"를 외워서 달린다.
//
// 시간이 아니라 거리로 나누는 이유: 앞부분을 고쳐 차가 조금 다르게 달려도 뒷부분 조작이 여전히 같은 장소에 적용되어,
// 배운 것이 쌓인다 (시간으로 나누면 앞을 조금만 바꿔도 뒤 조작이 모두 엉뚱한 장소로 밀린다).
//
// 변주는 부모가 멈춘 지점 조금 앞부터 뒤쪽만 바꾼다. 앞부분은 그대로 둬서 이미 배운 구간을 지킨다.

import { nextFloat, nextUint32, uniform, type RngState } from '../core/rng';
import type { Control } from '../simulation/types';
import type { Genome } from './network';
import { gaussian } from './operators';

/** 조작 한 쌍이 맡는 거리 (m) */
export const SEQUENCE_SEGMENT = 3;
/** 외울 수 있는 최대 거리 (m). 목표 거리보다 길어야 한다 */
export const SEQUENCE_DISTANCE = 900;
export const SEQUENCE_STEPS = Math.ceil(SEQUENCE_DISTANCE / SEQUENCE_SEGMENT);
export const SEQUENCE_GENES = SEQUENCE_STEPS * 2;

/** 변주 설정 (실험으로 정함, DECISIONS D35) */
export const SEQUENCE_TUNING = {
  /** 부모가 멈춘 지점보다 이만큼 앞부터 바꾼다 (m): 최소 + 지수분포(평균) */
  backoffMin: 3,
  backoffMean: 12,
  /** 구간 변주 개수·길이(구간 수)·시작 위치 범위(구간 수) */
  blocks: [1, 3] as [number, number],
  blockLength: [2, 8] as [number, number],
  blockSpread: 6,
  /** 구간 변주: shift = 기존 조작에 더하기 / set = 일정한 값으로 새로 정하기 */
  blockMode: 'set' as 'shift' | 'set',
  blockSize: 3,
  /** 그 밖의 뒤쪽 조작 낱개 변주: 확률 = 돌연변이 확률 × lateRate, 크기 = 돌연변이 크기 × lateSize */
  lateRate: 1,
  lateSize: 1,
  /** 첫 세대: 조향 무작위 걸음 크기·0 쪽으로 돌아오는 정도, 페달 범위 */
  initialSteerStep: 0.2,
  initialSteerPull: 0.15,
  initialThrottle: [0.15, 1] as [number, number],
};

/** 첫 세대: 조향은 부드러운 무작위 걸음, 페달은 대부분 앞으로 (모두 일단 달리다 비틀대며 부딪힌다) */
export function randomSequence(rng: RngState): Genome {
  const t = SEQUENCE_TUNING;
  const genes = new Array<number>(SEQUENCE_GENES);
  let steer = uniform(rng, -0.3, 0.3);
  for (let k = 0; k < SEQUENCE_STEPS; k++) {
    steer = Math.max(-1, Math.min(1, steer * (1 - t.initialSteerPull) + uniform(rng, -t.initialSteerStep, t.initialSteerStep)));
    genes[2 * k] = steer;
    genes[2 * k + 1] = uniform(rng, t.initialThrottle[0], t.initialThrottle[1]);
  }
  return genes;
}

/** 출발점에서 distance m 온 차가 할 조작 */
export function sequenceControl(genome: Genome, distance: number): Control {
  const k = Math.max(0, Math.floor(distance / SEQUENCE_SEGMENT));
  if (k >= SEQUENCE_STEPS) return { steer: 0, throttle: 0 };
  return { steer: genome[2 * k]!, throttle: genome[2 * k + 1]! };
}

export interface SequenceParent {
  /** 부모가 도달한 최대 거리 (m). 완주했으면 null */
  reached: number | null;
}

/** 부모가 멈춘 지점보다 조금 앞 (구간 번호). 여기 앞은 그대로 물려준다. 완주한 부모면 null */
export function frontierStep(parent: SequenceParent, rng: RngState): number | null {
  if (parent.reached === null) return null;
  const t = SEQUENCE_TUNING;
  const back = t.backoffMin - Math.log(1 - nextFloat(rng)) * t.backoffMean;
  return Math.max(0, Math.floor((parent.reached - back) / SEQUENCE_SEGMENT));
}

/** 교차: cut 구간 앞까지는 a, 그 뒤는 b 의 조작 */
export function crossoverSequence(a: Genome, b: Genome, cut: number): Genome {
  return [...a.slice(0, 2 * cut), ...b.slice(2 * cut)];
}

/** 완주한 부모끼리 교차할 때 자를 지점 */
export function randomCut(rng: RngState): number {
  return nextUint32(rng) % SEQUENCE_STEPS;
}

/**
 * 변주: frontier 뒤쪽만 바꾼다 — 연속된 구간을 한쪽으로 함께 옮기는 "구간 변주" + 낱개 변주.
 * 완주한 부모(frontier = null)는 전체를 작게 바꿔 더 빠른 길을 찾는다. 바뀐 유전자 수를 돌려준다
 */
export function mutateSequence(
  genome: Genome,
  frontier: number | null,
  rate: number,
  strength: number,
  rng: RngState,
): number {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  let changed = 0;
  if (frontier === null) {
    for (let g = 0; g < genome.length; g++) {
      if (nextFloat(rng) < rate / 4) {
        genome[g] = clamp(genome[g]! + gaussian(rng) * strength * 0.4);
        changed++;
      }
    }
    return changed;
  }
  const t = SEQUENCE_TUNING;
  const blocks = t.blocks[0] + (nextUint32(rng) % (t.blocks[1] - t.blocks[0] + 1));
  for (let b = 0; b < blocks; b++) {
    const start = frontier + (nextUint32(rng) % t.blockSpread);
    const len = t.blockLength[0] + (nextUint32(rng) % (t.blockLength[1] - t.blockLength[0] + 1));
    const set = t.blockMode === 'set';
    const steer = set ? uniform(rng, -1, 1) : gaussian(rng) * strength * t.blockSize;
    const pedal = set ? uniform(rng, -0.3, 1) : gaussian(rng) * strength * t.blockSize * 0.5;
    for (let k = start; k < Math.min(SEQUENCE_STEPS, start + len); k++) {
      genome[2 * k] = set ? steer : clamp(genome[2 * k]! + steer);
      genome[2 * k + 1] = set ? pedal : clamp(genome[2 * k + 1]! + pedal);
      changed += 2;
    }
  }
  for (let g = 2 * frontier; g < genome.length; g++) {
    if (nextFloat(rng) < Math.min(1, rate * t.lateRate)) {
      genome[g] = clamp(genome[g]! + gaussian(rng) * strength * t.lateSize);
      changed++;
    }
  }
  return changed;
}
