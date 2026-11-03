import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { finishRecordText, formatSimTime } from '../app/format';
import { DT } from '../simulation/params';
import { END_REASON_LABEL } from '../simulation/types';
import { DIFFICULTY_LABEL, type GridSlot, type Track } from '../tracks/types';
import { CAR_STRIDE, END_CODES, type Snapshot } from '../workers/protocol';
import { drawCars } from '../visualization/drawCars';
import { clear, drawMessage, drawTrack } from '../visualization/renderer';
import { MIN_HIT_RADIUS, carScreenPositions, carsInRect, hitTest } from '../visualization/selection';
import { drawGhostCar } from '../visualization/effects';
import { ghostPose } from '../visualization/ghost';
import { fitViewport, type Viewport } from '../visualization/viewport';
import type { Ghost } from '../simulation/experiment';
import type { Vec } from '../core/vec';

const PADDING = 28;
/** 이만큼 움직여야 클릭이 아니라 드래그로 본다 (px) */
const DRAG_THRESHOLD = 4;

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
  /** 수동 부모 선택 중 (클릭·드래그 가능) */
  selecting: boolean;
  selection: number[];
  onToggle(id: number): void;
  onSelectMany(ids: number[]): void;
  /** 비교용 고스트 (없으면 null) */
  ghost: Ghost | null;
  showGhost: boolean;
}

interface Hover {
  x: number;
  y: number;
  text: string;
}

export function TrackView(props: Props) {
  const { track, slots, error, getSnapshot, generation, countdown, bestFinish, runFinished, selecting, selection } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const viewRef = useRef<Viewport | null>(null);
  const dragRef = useRef<{ start: Vec; current: Vec; dragging: boolean } | null>(null);
  const selectionRef = useRef<number[]>(selection);
  const ghostRef = useRef<{ ghost: Ghost | null; show: boolean }>({ ghost: props.ghost, show: props.showGhost });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    ghostRef.current = { ghost: props.ghost, show: props.showGhost };
  }, [props.ghost, props.showGhost]);

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
    viewRef.current = view;
    // 개발 모드 전용: 브라우저 테스트가 자동차의 화면 위치를 알 수 있게 한다
    if (import.meta.env.DEV) {
      (window as unknown as { __raceCars?: () => { id: number; x: number; y: number }[] }).__raceCars = () => {
        const snapshot = getSnapshot();
        if (!snapshot || !view) return [];
        return carScreenPositions(snapshot, view).map((p, i) => ({ id: snapshot.ids[i]!, ...p }));
      };
    }

    let frame = 0;
    let lastTick = -1;
    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      const snapshot = getSnapshot();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(background, 0, 0);
      if (snapshot && view) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // 고스트는 실제 차들 아래에, 같은 시뮬레이션 시간으로 재생한다
        const { ghost, show } = ghostRef.current;
        if (ghost && show) {
          const pose = ghostPose(ghost.samples, snapshot.tick * DT);
          if (pose) drawGhostCar(ctx, view, pose.x, pose.y, pose.heading, pose.done);
        }
        drawCars(ctx, snapshot, view, { selection: selectionRef.current, time });
        const drag = dragRef.current;
        if (drag?.dragging) drawDragRect(ctx, drag.start, drag.current);
      }
      const tick = snapshot?.tick ?? 0;
      if (tick !== lastTick && timeRef.current) {
        timeRef.current.textContent = formatSimTime(tick * DT);
        lastTick = tick;
      }
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [track, slots, size, error, getSnapshot]);

  const pointerPos = (e: PointerEvent<HTMLCanvasElement>): Vec => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!selecting || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    dragRef.current = { start: p, current: p, dragging: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = pointerPos(e);
    const drag = dragRef.current;
    if (drag) {
      drag.current = p;
      if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > DRAG_THRESHOLD) drag.dragging = true;
    }
    updateHover(p);
  };

  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    const snapshot = getSnapshot();
    const view = viewRef.current;
    if (!drag || !snapshot || !view || !selecting) return;
    const positions = carScreenPositions(snapshot, view);
    if (drag.dragging) {
      // 드래그: 사각형 안의 차를 모두 기존 선택에 더한다
      const ids = carsInRect(positions, drag.start, pointerPos(e)).map((i) => snapshot.ids[i]!);
      if (ids.length) props.onSelectMany(ids);
    } else {
      // 클릭: 가장 가까운 차 하나를 선택/해제
      const i = hitTest(positions, drag.start, Math.max(MIN_HIT_RADIUS, view.scale * 3));
      if (i >= 0) props.onToggle(snapshot.ids[i]!);
    }
  };

  const updateHover = (p: Vec) => {
    const snapshot = getSnapshot();
    const view = viewRef.current;
    if (!snapshot || !view) return setHover(null);
    const i = hitTest(carScreenPositions(snapshot, view), p, Math.max(MIN_HIT_RADIUS, view.scale * 3));
    if (i < 0) return setHover(null);
    const o = i * CAR_STRIDE;
    const reason = END_CODES[snapshot.data[o + 4]!];
    const parts = [
      `${snapshot.ids[i]}번${i === snapshot.championIndex ? ' (금색 챔피언)' : ''}`,
      `진행률 ${(snapshot.data[o + 5]! * 100).toFixed(1)}%`,
      reason ? END_REASON_LABEL[reason] : '주행 중',
    ];
    setHover({ x: p.x, y: p.y, text: parts.join(' · ') });
  };

  return (
    <section className="track-view" aria-label="레이싱 화면">
      <div className="track-canvas" ref={containerRef}>
        <canvas
          ref={canvasRef}
          data-testid="track-canvas"
          className={selecting ? 'selecting' : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)}
        />
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
      {hover && (
        <div className="car-tooltip" style={{ left: hover.x + 14, top: hover.y + 10 }} data-testid="car-tooltip">
          {hover.text}
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

function drawDragRect(ctx: CanvasRenderingContext2D, a: Vec, b: Vec) {
  ctx.save();
  ctx.fillStyle = 'rgba(60, 200, 216, 0.12)';
  ctx.strokeStyle = 'rgba(60, 200, 216, 0.9)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  ctx.fillRect(x, y, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  ctx.restore();
}

