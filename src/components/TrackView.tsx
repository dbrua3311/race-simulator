import { useEffect, useRef, useState } from 'react';
import { finishRecordText, formatSimTime } from '../app/format';
import { DT } from '../simulation/params';
import { DIFFICULTY_LABEL, type GridSlot, type Track } from '../tracks/types';
import type { Snapshot } from '../workers/protocol';
import { drawCars } from '../visualization/drawCars';
import { clear, drawMessage, drawTrack } from '../visualization/renderer';
import { fitViewport, type Viewport } from '../visualization/viewport';

const PADDING = 28;

interface Props {
  track: Track | null;
  slots: GridSlot[];
  error: string | null;
  /** 렌더 루프가 매 프레임 최신 스냅샷을 읽는다 (React 상태를 거치지 않음) */
  getSnapshot: () => Snapshot | null;
  generation: number | null;
  countdown: number;
  /** 이번 세대 가장 빠른 완주 */
  bestFinish: { tick: number; id: number } | null;
  /** 이번 세대 주행이 모두 끝났는가 */
  runFinished: boolean;
}

export function TrackView({ track, slots, error, getSnapshot, generation, countdown, bestFinish, runFinished }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
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

  // 트랙(정적 배경)은 크기·트랙이 바뀔 때만 오프스크린 캔버스에 그리고,
  // 매 프레임 그 위에 최신 스냅샷의 자동차를 그린다. 렌더링은 물리 계산에 영향을 주지 않는다.
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

    const background = document.createElement('canvas');
    background.width = canvas.width;
    background.height = canvas.height;
    const bg = background.getContext('2d');
    let view: Viewport | null = null;
    if (bg) {
      clear(bg, size.width, size.height, dpr);
      if (track) {
        view = fitViewport(track.bounds, size.width, size.height, PADDING);
        drawTrack(bg, track, view, slots);
      } else drawMessage(bg, size.width, size.height, error ?? '트랙이 없습니다');
    }

    let frame = 0;
    let lastTick = -1;
    const render = () => {
      frame = requestAnimationFrame(render);
      const snapshot = getSnapshot();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(background, 0, 0);
      if (snapshot && view) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawCars(ctx, snapshot, view);
      }
      const tick = snapshot?.tick ?? 0;
      if (tick !== lastTick && timeRef.current) {
        timeRef.current.textContent = formatSimTime(tick * DT);
        lastTick = tick;
      }
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [track, slots, size, error, getSnapshot]);

  return (
    <section className="track-view" aria-label="레이싱 화면">
      <div className="track-canvas" ref={containerRef}>
        <canvas ref={canvasRef} data-testid="track-canvas" />
      </div>
      <div className="overlay overlay-left">
        <span className="overlay-label">세대</span>
        <span className="overlay-value" data-testid="generation">
          {generation ?? '-'}
        </span>
        <span className="overlay-label">주행 시간</span>
        <span className="overlay-time mono" ref={timeRef} data-testid="sim-time">
          00:00.00
        </span>
      </div>
      <div className="overlay overlay-right">
        <span className="overlay-label">최고 완주 기록</span>
        <span className="overlay-value mono" data-testid="finish-record">
          {finishRecordText(bestFinish, runFinished)}
        </span>
        {bestFinish && <span className="overlay-label">{bestFinish.id}번 자동차</span>}
      </div>
      {countdown > 0 && (
        <div className="countdown" data-testid="countdown">
          {countdown}
        </div>
      )}
      {track && (
        <div className="overlay overlay-bottom-left" data-testid="track-label">
          난이도 {DIFFICULTY_LABEL[track.difficulty]} · 시드 <span className="mono">{track.seed}</span>
        </div>
      )}
    </section>
  );
}
