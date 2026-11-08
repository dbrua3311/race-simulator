// 세대별 통계 CSV (원문 49절). 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 붙인다.

import type { Genome } from '../genetics/network';
import { NETWORK_LAYERS } from '../genetics/params';
import type { GenerationRecord } from '../simulation/experiment';

const HEADER = [
  '세대',
  '개체 수',
  '최고 적합도',
  '평균 적합도',
  '최고 진행률(%)',
  '평균 진행률(%)',
  '완주',
  '벽 충돌',
  '브레이크 정지',
  '안전 종료',
  '최고 완주 시간(초)',
  '1등 자동차',
  '부모 선택',
  '부모 자동차',
];

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function historyToCsv(history: readonly GenerationRecord[]): string {
  const rows = history.map((r) => [
    r.generation,
    r.population,
    r.bestFitness.toFixed(3),
    r.averageFitness.toFixed(3),
    (r.bestProgress * 100).toFixed(2),
    (r.averageProgress * 100).toFixed(2),
    r.finishCount,
    r.wallCount,
    r.brakeCount,
    r.safetyCount,
    r.bestFinishTime === null ? '' : r.bestFinishTime.toFixed(2),
    r.winner.id,
    r.parents ? (r.parents.mode === 'manual' ? '수동' : '자동') : '',
    r.parents ? r.parents.ids.join(' ') : '',
  ]);
  return '﻿' + [HEADER, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** 최고 자동차 유전자 파일 */
export function genomeFile(record: GenerationRecord): {
  format: 'race-simulator-genome';
  network: number[];
  generation: number;
  carId: number;
  progress: number;
  fitness: number;
  genome: Genome;
} {
  return {
    format: 'race-simulator-genome',
    network: [...NETWORK_LAYERS],
    generation: record.generation,
    carId: record.winner.id,
    progress: record.winner.progress,
    fitness: record.winner.fitness,
    genome: [...record.winner.genome],
  };
}
