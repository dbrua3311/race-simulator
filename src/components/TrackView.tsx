import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_LABEL, type GridSlot, type Track } from '../tracks/types';
import { clear, drawMessage, drawTrack } from '../visualization/renderer';
import { fitViewport } from '../visualization/viewport';

const PADDING = 28;

interface Props {
  track: Track | null;
  slots: GridSlot[];
  error: string | null;
}

export function TrackView({ track, slots, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      setSize({ width, height });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 트랙·크기가 바뀔 때만 다시 그린다. 트랙 데이터는 상태에서 받기만 하고 여기서 만들지 않는다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    clear(ctx, size.width, size.height, dpr);
    if (track) drawTrack(ctx, track, fitViewport(track.bounds, size.width, size.height, PADDING), slots);
    else drawMessage(ctx, size.width, size.height, error ?? '트랙이 없습니다');
  }, [track, slots, size, error]);

  return (
    <section className="track-view" aria-label="레이싱 화면">
      <div className="track-canvas" ref={containerRef}>
        <canvas ref={canvasRef} data-testid="track-canvas" />
      </div>
      <div className="overlay overlay-left">
        <span className="overlay-label">세대</span>
        <span className="overlay-value">-</span>
      </div>
      <div className="overlay overlay-right">
        <span className="overlay-label">최고 완주 기록</span>
        <span className="overlay-value mono">--:--.--</span>
      </div>
      {track && (
        <div className="overlay overlay-bottom-left" data-testid="track-label">
          난이도 {DIFFICULTY_LABEL[track.difficulty]} · 시드 <span className="mono">{track.seed}</span>
        </div>
      )}
    </section>
  );
}
