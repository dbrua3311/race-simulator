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
