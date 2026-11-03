import { describe, expect, it } from 'vitest';
import { createRng, uniform } from '../../src/core/rng';
import { leftNormal, add, scale } from '../../src/core/vec';
import { SENSOR } from '../../src/simulation/params';
import { castRay, castRayBruteForce, readSensors, wallGrid } from '../../src/simulation/sensors';
import { tangentAt } from '../../src/tracks/generate';
import { testTrack } from './helpers';

describe('거리 센서', () => {
  const track = testTrack();
  const grid = wallGrid(track);

  it('도로 가운데 직선에서 좌우 90° 센서는 도로 폭의 절반을 잰다', () => {
    const p = track.center[0]!;
    const f = tangentAt(track.center, 0);
    const sensors = readSensors(grid, p.x, p.y, Math.atan2(f.y, f.x));
    expect(sensors[3]! * SENSOR.range).toBeCloseTo(track.roadWidth / 2, 3);
    expect(sensors[4]! * SENSOR.range).toBeCloseTo(track.roadWidth / 2, 3);
    // 정면은 직선을 따라 멀리 본다
    expect(sensors[0]!).toBeGreaterThan(0.3);
  });

  it('값은 0 ~ 1 이고, 벽에 가까울수록 작다', () => {
    const p = track.center[0]!;
    const f = tangentAt(track.center, 0);
    const near = add(p, scale(leftNormal(f), track.roadWidth / 2 - 1));
    const sensors = readSensors(grid, near.x, near.y, Math.atan2(f.y, f.x));
    for (const v of sensors) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(sensors[3]! * SENSOR.range).toBeCloseTo(1, 3);
  });

  it('격자 탐색 결과가 모든 벽을 검사한 결과와 같다 (무작위 광선 1000개)', () => {
    const rng = createRng('rays');
    for (let k = 0; k < 1000; k++) {
      const i = Math.floor(uniform(rng, 0, track.center.length));
      const c = track.center[i]!;
      const ox = c.x + uniform(rng, -8, 8);
      const oy = c.y + uniform(rng, -8, 8);
      const a = uniform(rng, 0, 2 * Math.PI);
      const fast = castRay(grid, ox, oy, Math.cos(a), Math.sin(a), SENSOR.range);
      const slow = castRayBruteForce(track, ox, oy, Math.cos(a), Math.sin(a), SENSOR.range);
      expect(fast).toBeCloseTo(slow, 9);
    }
  });
});
