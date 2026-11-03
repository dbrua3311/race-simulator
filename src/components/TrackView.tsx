import { useEffect, useRef } from 'react';
import { drawPlaceholder } from '../visualization/renderer';

export function TrackView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) drawPlaceholder(ctx, width, height, dpr);
    };

    resize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="track-view" aria-label="레이싱 화면">
      <div className="track-canvas" ref={containerRef}>
        <canvas ref={canvasRef} />
      </div>
      <div className="overlay overlay-left">
        <span className="overlay-label">세대</span>
        <span className="overlay-value">-</span>
      </div>
      <div className="overlay overlay-right">
        <span className="overlay-label">최고 완주 기록</span>
        <span className="overlay-value mono">--:--.--</span>
      </div>
    </section>
  );
}
