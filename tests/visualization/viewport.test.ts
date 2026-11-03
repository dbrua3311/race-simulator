import { describe, expect, it } from 'vitest';
import { fitViewport, screenToWorld, worldToScreen } from '../../src/visualization/viewport';

describe('화면 좌표 변환', () => {
  const bounds = { minX: -200, minY: -100, maxX: 200, maxY: 100 };
  const view = fitViewport(bounds, 800, 600, 20);

  it('트랙 전체가 여백 안에 들어간다', () => {
    const tl = worldToScreen(view, { x: bounds.minX, y: bounds.maxY });
    const br = worldToScreen(view, { x: bounds.maxX, y: bounds.minY });
    expect(tl.x).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(tl.y).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(br.x).toBeLessThanOrEqual(780 + 1e-9);
    expect(br.y).toBeLessThanOrEqual(580 + 1e-9);
  });

  it('위쪽(y+)이 화면 위로 가고, 되돌리면 원래 좌표', () => {
    const p = { x: 37, y: -12 };
    expect(worldToScreen(view, { x: 0, y: 10 }).y).toBeLessThan(worldToScreen(view, { x: 0, y: 0 }).y);
    const back = screenToWorld(view, worldToScreen(view, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });
});
