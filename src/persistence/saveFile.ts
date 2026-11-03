// 실험 저장 파일 (JSON, 원문 45~48절).
// 실험 전체(트랙 좌표, 설정, 현재 세대의 모든 차 상태와 유전자, 세대별 기록, 고스트, 난수 상태)와
// 화면에서만 들고 있는 값(부모 선택 중인 차)을 함께 담는다. 주행 도중 상태도 정확히 저장된다.

import type { Experiment } from '../simulation/experiment';
import { DT } from '../simulation/params';

export const SAVE_FORMAT = 'race-simulator-experiment';
/** 2: 목표 거리(도착 구간) 추가, 트랙 크기 변경 (2026-11-04) */
export const SAVE_FORMAT_VERSION = 2;

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  formatVersion: number;
  name: string;
  /** 저장 시각 (ISO 8601) */
  savedAt: string;
  /** 저장 시점 설명 (사용자 안내용) */
  savedPoint: string;
  experiment: Experiment;
  ui: {
    /** 부모 선택 단계에서 결정완료 전에 고른 차 번호 */
    selection: number[];
  };
}

/** 저장 시점을 사람이 읽을 수 있게 */
export function describePoint(exp: Experiment): string {
  const time = (exp.world.tick * DT).toFixed(1);
  switch (exp.status) {
    case 'ready':
      return `${exp.generation}세대 출발 전`;
    case 'running':
    case 'paused':
      return `${exp.generation}세대 주행 중 (${time}초)`;
    case 'evaluated':
      return `${exp.generation}세대 주행 완료, 부모 선택 전`;
  }
}

/** 고스트·궤적은 화면용이라 소수 셋째 자리까지만 저장해 파일을 줄인다. 차 상태·유전자·난수는 그대로 */
function roundSamples(samples: number[]): number[] {
  return samples.map((v) => Math.round(v * 1000) / 1000);
}

export function createSaveFile(exp: Experiment, name: string, selection: number[], now: Date): SaveFile {
  return {
    format: SAVE_FORMAT,
    formatVersion: SAVE_FORMAT_VERSION,
    name,
    savedAt: now.toISOString(),
    savedPoint: describePoint(exp),
    experiment: {
      ...exp,
      world: { ...exp.world, trails: exp.world.trails.map(roundSamples) },
      ghosts: exp.ghosts.map((g) => ({ ...g, samples: roundSamples(g.samples) })),
    },
    ui: { selection: exp.status === 'evaluated' ? [...selection] : [] },
  };
}

export function saveFileName(exp: Experiment, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `race-${exp.track.seed}-${exp.generation}세대-${stamp}.race.json`;
}
