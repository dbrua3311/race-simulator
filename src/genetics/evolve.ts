// 다음 세대 만들기 (원문 22~24, 31, 33절).
//
// 1. 직전 세대 공식 1등의 유전자를 그대로 복제 → 금색 챔피언 1대 (직전 1등의 출발 자리에서 출발)
// 2. 나머지는 부모를 골라 교차·돌연변이로 만든 자손
//    - 수동: 사용자가 고른 부모들 안에서 무작위로 짝을 짓는다 (1대만 골랐으면 그 차를 조금씩 바꾼 자손들)
//    - 자동: 토너먼트 선택 (적합도 높은 차가 부모가 될 확률이 높다)

import { nextUint32, nextFloat, type RngState } from '../core/rng';
import type { Genome } from './network';
import { crossover, mutate } from './operators';
import type { Brain, GaSettings } from './params';
import { crossoverSequence, frontierStep, mutateSequence, randomCut } from './sequence';

export interface ParentInfo {
  /** 직전 세대에서의 차 번호 */
  ids: number[];
  /** 교차했는가 (아니면 첫 부모 복제 후 돌연변이) */
  crossed: boolean;
  /** 돌연변이로 바뀐 유전자 수 */
  mutatedGenes: number;
}

export interface Offspring {
  genomes: Genome[];
  /** genomes[i] 의 계보. 0번은 챔피언 */
  lineage: ParentInfo[];
}

export interface Candidate {
  id: number;
  genome: Genome;
  fitness: number;
  /** 도달한 최대 거리 (m). 완주했으면 null (조작 순서 방식의 변주 위치에 쓴다) */
  reached: number | null;
}

/**
 * ranked: 직전 세대 차들을 공식 순위 순으로 (0 = 1등).
 * parentIds: 수동 선택이면 사용자가 고른 차 번호들, 자동이면 null.
 */
export function breed(
  ranked: readonly Candidate[],
  parentIds: readonly number[] | null,
  settings: GaSettings,
  rng: RngState,
  brain: Brain = 'network',
): Offspring {
  const champion = ranked[0]!;
  const genomes: Genome[] = [[...champion.genome]];
  const lineage: ParentInfo[] = [{ ids: [champion.id], crossed: false, mutatedGenes: 0 }];

  const pool = parentIds ? ranked.filter((c) => parentIds.includes(c.id)) : null;
  if (pool && pool.length === 0) throw new Error('부모가 없습니다');
  const pick = (): Candidate => (pool ? pool[nextUint32(rng) % pool.length]! : tournament(ranked, settings.tournamentSize, rng));

  for (let k = 1; k < settings.populationSize; k++) {
    const a = pick();
    let b = pick();
    // 가능하면 서로 다른 두 부모
    for (let tries = 0; b.id === a.id && tries < 8; tries++) b = pick();
    const crossed = nextFloat(rng) < settings.crossoverRate && b.id !== a.id;
    let child: Genome;
    let mutatedGenes: number;
    if (brain === 'sequence') {
      // a 가 멈추기 조금 전까지는 a 그대로, 그 뒤는 (교차면 b 의 조작을 가져와) 새로 시도
      const frontier = frontierStep(a, rng);
      child = crossed ? crossoverSequence(a.genome, b.genome, frontier ?? randomCut(rng)) : [...a.genome];
      mutatedGenes = mutateSequence(child, frontier, settings.mutationRate, settings.mutationStrength, rng);
    } else {
      child = crossed ? crossover(a.genome, b.genome, rng) : [...a.genome];
      mutatedGenes = mutate(child, settings.mutationRate, settings.mutationStrength, rng);
    }
    genomes.push(child);
    lineage.push({ ids: crossed ? [a.id, b.id] : [a.id], crossed, mutatedGenes });
  }
  return { genomes, lineage };
}

/** 무작위로 size 대를 뽑아 그중 적합도가 가장 높은 차 (동률이면 순위가 앞선 차) */
function tournament(ranked: readonly Candidate[], size: number, rng: RngState): Candidate {
  let best = nextUint32(rng) % ranked.length;
  for (let k = 1; k < size; k++) {
    const i = nextUint32(rng) % ranked.length;
    if (ranked[i]!.fitness > ranked[best]!.fitness || (ranked[i]!.fitness === ranked[best]!.fitness && i < best)) best = i;
  }
  return ranked[best]!;
}
