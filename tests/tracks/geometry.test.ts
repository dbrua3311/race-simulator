import { describe, expect, it } from 'vitest';
import {
  closedLength,
  closedPolylinesIntersect,
  findCloseApproach,
  resampleClosed,
  segmentsIntersect,
  signedCurvatures,
} from '../../src/tracks/geometry';
import { figureEight, polarShape } from './shapes';

describe('기하 함수', () => {
  it('선분 교차', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })).toBe(true);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(false);
    // 끝점이 다른 선분 위에 닿기만 해도 교차로 본다
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 5 })).toBe(true);
    // 한 직선 위 겹침 / 떨어짐
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 })).toBe(true);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 })).toBe(false);
  });

  it('다시 샘플링하면 간격이 일정하고 첫 점이 유지된다', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const points = resampleClosed(square, 2);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points).toHaveLength(200);
    expect(closedLength(points)).toBeCloseTo(400, 0);
  });

  it('원은 자기 교차가 없고, 8자는 있다', () => {
    const circle = polarShape(() => 100);
    expect(closedPolylinesIntersect(circle, circle)).toBe(false);
    const eight = figureEight(150);
    expect(closedPolylinesIntersect(eight, eight)).toBe(true);
  });

  it('잘록한 곳에서 다른 구간과 가까워지면 찾아낸다', () => {
    // 가운데가 잘록한 아령 모양: 위아래 도로가 가운데에서 9 m 까지 가까워진다
    const dumbbell = polarShape((t) => 180 * (1 - 0.95 * Math.sin(t) ** 2));
    expect(findCloseApproach(dumbbell, 2, 60, 26)).not.toBeNull();
    expect(findCloseApproach(polarShape(() => 180), 2, 60, 26)).toBeNull();
  });

  it('원의 곡률은 1/반지름, 반시계면 양수', () => {
    const circle = polarShape(() => 50, 1);
    for (const k of signedCurvatures(circle, 3)) expect(k).toBeCloseTo(1 / 50, 3);
  });
});
