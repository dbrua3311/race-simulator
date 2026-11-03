import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  // jsdom 에는 ResizeObserver 가 없다 (Recharts 의 ResponsiveContainer 가 사용)
  const g = globalThis as { ResizeObserver?: unknown };
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // jsdom 은 캔버스를 그리지 못한다. 경고 대신 null 을 돌려주게 해 둔다.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
