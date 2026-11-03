import { describe, expect, it } from 'vitest';
import type { Ghost } from '../../src/simulation/experiment';
import { ghostPose, pickGhost } from '../../src/visualization/ghost';

const ghost = (generation: number, progress: number, finishTime: number | null = null): Ghost => ({
  generation,
  carId: generation,
  progress,
  finishTime,
  samples: [0, 0, 0, 0, 1, 0, 0, 10, 2, 0, 0, 10],
});

describe('고스트', () => {
  const ghosts = [ghost(1, 0.2), ghost(2, 0.6), ghost(3, 0.5), ghost(4, 1, 90), ghost(5, 1, 80)];

  it('역대 최고 = 진행률 우선, 완주끼리는 빠른 기록', () => {
    expect(pickGhost(ghosts, 'best', 6, null)?.generation).toBe(5);
    expect(pickGhost(ghosts.slice(0, 3), 'best', 4, null)?.generation).toBe(2);
  });

  it('이전 세대 1등 / 특정 세대 1등 / 표시 안 함', () => {
    expect(pickGhost(ghosts, 'previous', 4, null)?.generation).toBe(3);
    expect(pickGhost(ghosts, 'generation', 6, 2)?.generation).toBe(2);
    expect(pickGhost(ghosts, 'off', 6, null)).toBeNull();
  });

  it('지금 세대와 그 뒤 기록은 비교 대상이 아니다', () => {
    expect(pickGhost(ghosts, 'best', 3, null)?.generation).toBe(2);
    expect(pickGhost(ghosts, 'best', 1, null)).toBeNull();
  });

  it('0.1초 간격 기록 사이를 보간하고, 기록이 끝나면 마지막 위치에 머문다', () => {
    const samples = ghost(1, 0).samples;
    expect(ghostPose(samples, 0)).toEqual({ x: 0, y: 0, heading: 0, done: false });
    expect(ghostPose(samples, 0.05)!.x).toBeCloseTo(0.5, 9);
    expect(ghostPose(samples, 0.15)!.x).toBeCloseTo(1.5, 9);
    expect(ghostPose(samples, 99)).toMatchObject({ x: 2, done: true });
    expect(ghostPose([], 1)).toBeNull();
  });
});
