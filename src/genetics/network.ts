// 신경망. 가중치와 편향을 이어 붙인 숫자 배열(유전자) 하나로 표현한다.
// 층마다 [가중치(출력 × 입력, 행 우선), 편향(출력)] 순서. 활성 함수는 모두 tanh → 출력은 -1 ~ 1.

import { NETWORK_LAYERS } from './params';

export type Genome = number[];

export function parameterCount(layers: readonly number[] = NETWORK_LAYERS): number {
  let count = 0;
  for (let l = 0; l + 1 < layers.length; l++) count += layers[l]! * layers[l + 1]! + layers[l + 1]!;
  return count;
}

export function forward(genome: Genome, inputs: readonly number[], layers: readonly number[] = NETWORK_LAYERS): number[] {
  let values = inputs as number[];
  let offset = 0;
  for (let l = 0; l + 1 < layers.length; l++) {
    const nIn = layers[l]!;
    const nOut = layers[l + 1]!;
    const next = new Array<number>(nOut);
    const biasOffset = offset + nIn * nOut;
    for (let o = 0; o < nOut; o++) {
      let sum = genome[biasOffset + o]!;
      const row = offset + o * nIn;
      for (let i = 0; i < nIn; i++) sum += genome[row + i]! * values[i]!;
      next[o] = Math.tanh(sum);
    }
    offset = biasOffset + nOut;
    values = next;
  }
  return values;
}
