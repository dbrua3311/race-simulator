// 고스트: 과거 세대 1등의 실제 주행 기록을 반투명 차로 재생한다 (원문 41~44절).
// 화면(메인 스레드)에서만 쓰는 읽기 전용 데이터라 물리·센서·적합도·진화에 전혀 관여하지 않는다.

import type { Ghost } from '../simulation/experiment';
import { DT, TRAIL_EVERY } from '../simulation/params';

export type GhostMode = 'off' | 'best' | 'previous' | 'generation';

export const GHOST_MODE_LABEL: Record<GhostMode, string> = {
  off: '표시 안 함',
  best: '역대 최고 자동차',
  previous: '이전 세대 1등',
  generation: '특정 세대 1등',
};

const SAMPLE_INTERVAL = TRAIL_EVERY * DT;

/** 공식 순위 기준: 진행률 → 완주 시간 → 먼저 기록된 세대 */
function better(a: Ghost, b: Ghost): boolean {
  if (a.progress !== b.progress) return a.progress > b.progress;
  if (a.finishTime !== null && b.finishTime !== null && a.finishTime !== b.finishTime) return a.finishTime < b.finishTime;
  return a.generation < b.generation;
}

/** 비교할 고스트 고르기. 지금 세대(currentGeneration)의 기록은 쓰지 않는다 (아직 주행 중일 수 있음) */
export function pickGhost(
  ghosts: readonly Ghost[],
  mode: GhostMode,
  currentGeneration: number,
  generation: number | null,
): Ghost | null {
  const past = ghosts.filter((g) => g.generation < currentGeneration);
  if (mode === 'off' || past.length === 0) return null;
  if (mode === 'previous') return past.find((g) => g.generation === currentGeneration - 1) ?? null;
  if (mode === 'generation') return past.find((g) => g.generation === generation) ?? null;
  return past.reduce((best, g) => (better(g, best) ? g : best));
}

export interface GhostPose {
  x: number;
  y: number;
  heading: number;
  /** 기록이 끝나 마지막 위치에 머무는 중 */
  done: boolean;
}

/** 시뮬레이션 시간 time(s) 의 고스트 위치. 0.1 s 간격 기록 사이를 보간한다 */
export function ghostPose(samples: readonly number[], time: number): GhostPose | null {
  const count = Math.floor(samples.length / 4);
  if (count === 0) return null;
  const f = Math.max(0, time / SAMPLE_INTERVAL);
  const i = Math.floor(f);
  if (i >= count - 1) {
    const o = (count - 1) * 4;
    return { x: samples[o]!, y: samples[o + 1]!, heading: samples[o + 2]!, done: true };
  }
  const t = f - i;
  const a = i * 4;
  const b = a + 4;
  let dh = samples[b + 2]! - samples[a + 2]!;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  return {
    x: samples[a]! + (samples[b]! - samples[a]!) * t,
    y: samples[a + 1]! + (samples[b + 1]! - samples[a + 1]!) * t,
    heading: samples[a + 2]! + dh * t,
    done: false,
  };
}
