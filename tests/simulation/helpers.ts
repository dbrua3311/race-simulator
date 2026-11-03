import { createRng } from '../../src/core/rng';
import { randomGenome } from '../../src/genetics/genome';
import type { CarState, Control } from '../../src/simulation/types';
import { createWorld, type Controller, type World } from '../../src/simulation/world';
import { generateTrack } from '../../src/tracks/generate';
import type { Track } from '../../src/tracks/types';

const cache = new Map<string, Track>();

export function testTrack(seed = 'SIM1', difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Track {
  const key = `${difficulty}/${seed}`;
  let track = cache.get(key);
  if (!track) {
    const result = generateTrack(difficulty, seed);
    if (!result.ok) throw new Error('트랙 생성 실패');
    track = result.track;
    cache.set(key, track);
  }
  return track;
}

/** 무작위 유전자 count 개로 만든 세대 */
export function randomWorld(track: Track, count: number, seed: string): World {
  const rng = createRng(seed);
  const genomes = Array.from({ length: count }, () => randomGenome(rng));
  return createWorld(track, genomes, rng);
}

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function blankCar(): CarState {
  return {
    id: 1, slot: 0, champion: false, x: 0, y: 0, heading: 0, speed: 0, steer: 0, throttle: 0, trackIndex: 0,
    ended: false, endReason: null, endTick: null,
    startS: 0, goal: 1000, s: 0, bestDistance: 0, bestTick: 0, nextGate: 0,
    hasMoved: false, progressMark: 0, progressMarkTick: 0,
  };
}

/**
 * 테스트 전용 모범 운전자: 트랙 중심선 앞쪽 점을 따라간다 (pure pursuit).
 * 트랙 정보를 직접 쓰므로 실제 게임에는 쓰지 않는다. 완주 판정·시간 측정 검증용.
 */
export function followCenterline(track: Track, speed = 12, lookAhead = 6): Controller {
  return (_i, car): Control => {
    const n = track.center.length;
    const target = track.center[(car.trackIndex + lookAhead) % n]!;
    let angle = Math.atan2(target.y - car.y, target.x - car.x) - car.heading;
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    return { steer: Math.max(-1, Math.min(1, angle * 2.5)), throttle: car.speed < speed ? 1 : 0 };
  };
}

/** 세대에서 k 번째 차만 남긴 세계 */
export function only(world: World, k: number): World {
  return {
    tick: 0,
    brain: world.brain,
    cars: [clone(world.cars[k]!)],
    genomes: [clone(world.genomes[k]!)],
    trails: [clone(world.trails[k]!)],
    finished: false,
  };
}
