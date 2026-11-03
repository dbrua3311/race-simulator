import type { Snapshot } from '../workers/protocol';

/** 통계 패널과 완주 기록 표시에 쓰는 스냅샷 요약 */
export type RunStats = Pick<
  Snapshot,
  'counts' | 'bestProgress' | 'averageProgress' | 'bestFitness' | 'averageFitness' | 'bestFinish' | 'actualSpeed'
>;

export function toRunStats(s: Snapshot): RunStats {
  return {
    counts: s.counts,
    bestProgress: s.bestProgress,
    averageProgress: s.averageProgress,
    bestFitness: s.bestFitness,
    averageFitness: s.averageFitness,
    bestFinish: s.bestFinish,
    actualSpeed: s.actualSpeed,
  };
}
