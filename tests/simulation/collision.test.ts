import { describe, expect, it } from 'vitest';
import { add, leftNormal, scale } from '../../src/core/vec';
import { hitsWall, nearestIndex } from '../../src/simulation/collision';
import { CAR } from '../../src/simulation/params';
import { tangentAt } from '../../src/tracks/generate';
import { testTrack } from './helpers';

describe('벽 충돌', () => {
  const track = testTrack();
  const i = 120;
  const center = track.center[i]!;
  const forward = tangentAt(track.center, i);
  const heading = Math.atan2(forward.y, forward.x);
  const side = leftNormal(forward);
  const halfRoad = track.roadWidth / 2;

  it('도로 가운데에 진행 방향으로 서 있으면 충돌이 아니다', () => {
    expect(hitsWall(track, center.x, center.y, heading, i)).toBe(false);
  });

  it('차체가 벽 안쪽에 딱 들어오면 충돌이 아니고, 벽을 넘으면 충돌이다', () => {
    const inside = add(center, scale(side, halfRoad - CAR.width / 2 - 0.3));
    expect(hitsWall(track, inside.x, inside.y, heading, i)).toBe(false);
    const over = add(center, scale(side, halfRoad - CAR.width / 2 + 0.3));
    expect(hitsWall(track, over.x, over.y, heading, i)).toBe(true);
    const otherSide = add(center, scale(side, -(halfRoad - CAR.width / 2 + 0.3)));
    expect(hitsWall(track, otherSide.x, otherSide.y, heading, i)).toBe(true);
  });

  it('도로를 가로질러 서면 앞뒤 꼭짓점이 벽에 닿지 않는 한 충돌이 아니다', () => {
    expect(hitsWall(track, center.x, center.y, heading + Math.PI / 2, i)).toBe(false);
  });

  it('가장 가까운 중심선 점은 이전 위치 주변에서만 찾는다', () => {
    expect(nearestIndex(track, i - 3, center)).toBe(i);
    const n = track.center.length;
    expect(nearestIndex(track, 0, track.center[n - 2]!)).toBe(n - 2);
  });
});
