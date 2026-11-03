// 유전 연산: 교차와 돌연변이. 모두 시드 난수(rng)만 쓰므로 재현 가능하다.

import { nextFloat, type RngState } from '../core/rng';
import type { Genome } from './network';
import { NETWORK_LAYERS } from './params';

/**
 * 뉴런마다 그 뉴런에 들어오는 가중치 + 편향의 유전자 위치.
 * 교차할 때 뉴런 단위로 통째로 물려줘야 부모가 학습한 "기능"이 덜 깨진다.
 */
export function neuronBlocks(layers: readonly number[] = NETWORK_LAYERS): number[][] {
  const blocks: number[][] = [];
  let offset = 0;
  for (let l = 0; l + 1 < layers.length; l++) {
    const nIn = layers[l]!;
    const nOut = layers[l + 1]!;
    const biasOffset = offset + nIn * nOut;
    for (let o = 0; o < nOut; o++) {
      const genes = Array.from({ length: nIn }, (_, i) => offset + o * nIn + i);
      genes.push(biasOffset + o);
      blocks.push(genes);
    }
    offset = biasOffset + nOut;
  }
  return blocks;
}

const BLOCKS = neuronBlocks();

/** 뉴런 단위 균등 교차: 뉴런마다 두 부모 중 하나의 것을 물려받는다 */
export function crossover(a: Genome, b: Genome, rng: RngState, blocks: number[][] = BLOCKS): Genome {
  const child = [...a];
  for (const block of blocks) {
    if (nextFloat(rng) < 0.5) for (const g of block) child[g] = b[g]!;
  }
  return child;
}

/** 유전자마다 rate 확률로 정규분포 노이즈(표준편차 strength)를 더한다. 바뀐 유전자 수를 돌려준다 */
export function mutate(genome: Genome, rate: number, strength: number, rng: RngState): number {
  let changed = 0;
  for (let i = 0; i < genome.length; i++) {
    if (nextFloat(rng) < rate) {
      genome[i] = genome[i]! + gaussian(rng) * strength;
      changed++;
    }
  }
  return changed;
}

/** 표준 정규분포 (Box–Muller) */
export function gaussian(rng: RngState): number {
  let u = 0;
  while (u === 0) u = nextFloat(rng);
  const v = nextFloat(rng);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
