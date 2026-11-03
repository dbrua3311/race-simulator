// 실험 = 한 판의 진화 전체. 트랙, 설정, 현재 세대의 주행, 세대별 기록, 고스트, 진화용 난수 상태.
// 평범한 데이터라 그대로 JSON 으로 저장·복원된다 (원문 45절). 워커가 이 상태의 주인이다.

import { createRng, type RngState } from '../core/rng';
import { breed, type Candidate, type ParentInfo } from '../genetics/evolve';
import { fitnessOf, finishTime, rankCars } from '../genetics/fitness';
import { randomGenome } from '../genetics/genome';
import { randomSequence } from '../genetics/sequence';
import type { Genome } from '../genetics/network';
import { MIN_PARENTS, type GaSettings } from '../genetics/params';
import type { Track } from '../tracks/types';
import { progressOf } from './progress';
import type { EndReason } from './types';
import { createWorld, type World } from './world';

export type ExperimentStatus = 'ready' | 'running' | 'paused' | 'evaluated';

/** 한 세대의 평가 결과 (그래프·CSV·최고 자동차 정보) */
export interface GenerationRecord {
  generation: number;
  population: number;
  bestFitness: number;
  averageFitness: number;
  bestProgress: number;
  averageProgress: number;
  finishCount: number;
  wallCount: number;
  brakeCount: number;
  safetyCount: number;
  /** 가장 빠른 완주 시간 (s) */
  bestFinishTime: number | null;
  /** 공식 1등 */
  winner: {
    id: number;
    slot: number;
    progress: number;
    fitness: number;
    finishTime: number | null;
    endReason: EndReason | null;
    champion: boolean;
    genome: Genome;
  };
  /** 이번 세대의 금색 챔피언 번호 (1세대는 없음) */
  championId: number | null;
  /** 이 세대에서 다음 세대 부모를 어떻게 골랐는가 (다음 세대를 만들 때 채운다) */
  parents: { mode: 'manual' | 'auto'; ids: number[] } | null;
}

/** 세대 1등의 실제 주행 기록 (원문 41~44절). samples = [x, y, heading, speed] × 0.1 s 간격 */
export interface Ghost {
  generation: number;
  carId: number;
  progress: number;
  finishTime: number | null;
  samples: number[];
}

export interface Experiment {
  track: Track;
  settings: GaSettings;
  seed: string;
  /** 현재 세대 번호 (1부터) */
  generation: number;
  /** 진화용 난수 상태 (배치·교차·돌연변이·선택) */
  rng: RngState;
  world: World;
  /** world 의 차들의 계보 (0번이 챔피언이면 직전 1등) */
  lineage: ParentInfo[] | null;
  status: ExperimentStatus;
  /** 평가가 끝난 세대들 */
  history: GenerationRecord[];
  ghosts: Ghost[];
}

export function newExperiment(track: Track, settings: GaSettings, seed: string): Experiment {
  const rng = createRng(`race-simulator/experiment/${seed}`);
  const brain = settings.brain ?? 'network';
  const genomes = Array.from({ length: settings.populationSize }, () =>
    brain === 'sequence' ? randomSequence(rng) : randomGenome(rng),
  );
  return {
    track,
    settings: { ...settings },
    seed,
    generation: 1,
    rng,
    world: createWorld(track, genomes, rng, { brain }),
    lineage: null,
    status: 'ready',
    history: [],
    ghosts: [],
  };
}

/** 현재 세대 차들을 공식 순위대로 (평가용 후보) */
export function rankedCandidates(exp: Experiment): Candidate[] {
  const { world } = exp;
  return rankCars(world.cars).map((i) => {
    const car = world.cars[i]!;
    return {
      id: car.id,
      genome: world.genomes[i]!,
      fitness: fitnessOf(car),
      reached: car.endReason === 'finish' ? null : car.bestDistance,
    };
  });
}

/** 모든 차가 종료된 세대를 평가해 기록·고스트를 남긴다 */
export function evaluate(exp: Experiment): GenerationRecord {
  const { world } = exp;
  if (!world.finished) throw new Error('아직 주행 중인 세대는 평가할 수 없습니다');
  if (exp.status === 'evaluated') return exp.history.at(-1)!;

  const order = rankCars(world.cars);
  const cars = world.cars;
  const fitness = cars.map((c) => fitnessOf(c));
  const progress = cars.map((c) => progressOf(c));
  const times = cars.map(finishTime).filter((t): t is number => t !== null);
  const w = order[0]!;
  const winner = cars[w]!;
  const count = (reasons: EndReason[]) => cars.filter((c) => c.endReason && reasons.includes(c.endReason)).length;
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

  const record: GenerationRecord = {
    generation: exp.generation,
    population: cars.length,
    bestFitness: fitness[w]!,
    averageFitness: mean(fitness),
    bestProgress: progress[w]!,
    averageProgress: mean(progress),
    finishCount: count(['finish']),
    wallCount: count(['wall']),
    brakeCount: count(['brake']),
    safetyCount: count(['noProgress', 'timeLimit', 'numeric']),
    bestFinishTime: times.length ? Math.min(...times) : null,
    winner: {
      id: winner.id,
      slot: winner.slot,
      progress: progress[w]!,
      fitness: fitness[w]!,
      finishTime: finishTime(winner),
      endReason: winner.endReason,
      champion: winner.champion,
      genome: [...world.genomes[w]!],
    },
    championId: cars.find((c) => c.champion)?.id ?? null,
    parents: null,
  };
  exp.history.push(record);
  exp.ghosts.push({
    generation: exp.generation,
    carId: winner.id,
    progress: progress[w]!,
    finishTime: finishTime(winner),
    samples: [...world.trails[w]!],
  });
  exp.status = 'evaluated';
  return record;
}

export class GenerationError extends Error {}

/**
 * 평가가 끝난 세대에서 다음 세대를 만든다. 세대를 만드는 곳은 여기 하나뿐이다.
 * expectedGeneration 이 현재 세대와 다르면 거부한다 → 중복 클릭·겹친 명령으로 한 세대가 두 번 생기지 않는다 (원문 64절).
 * parentIds: 수동 선택이면 고른 차 번호들(1대 이상), 자동이면 null.
 */
export function nextGeneration(exp: Experiment, parentIds: number[] | null, expectedGeneration: number): void {
  if (exp.status !== 'evaluated') throw new GenerationError('세대 평가가 끝나야 다음 세대를 만들 수 있습니다');
  if (expectedGeneration !== exp.generation) throw new GenerationError('이미 다음 세대가 만들어졌습니다');
  const ranked = rankedCandidates(exp);
  if (parentIds) {
    const valid = [...new Set(parentIds)].filter((id) => ranked.some((c) => c.id === id));
    if (valid.length < MIN_PARENTS) throw new GenerationError(`부모 자동차를 ${MIN_PARENTS}대 이상 골라야 합니다`);
    parentIds = valid;
  }
  const record = exp.history.at(-1)!;
  record.parents = { mode: parentIds ? 'manual' : 'auto', ids: parentIds ?? [] };

  const brain = exp.world.brain;
  const { genomes, lineage } = breed(ranked, parentIds, exp.settings, exp.rng, brain);
  exp.world = createWorld(exp.track, genomes, exp.rng, { championSlot: record.winner.slot, brain });
  exp.lineage = lineage;
  exp.generation++;
  exp.status = 'ready';
}

/** 같은 트랙으로 학습만 처음부터 (유전자·세대·기록 초기화, 원문 11절) */
export function resetLearning(exp: Experiment, seed: string): Experiment {
  return newExperiment(exp.track, exp.settings, seed);
}
