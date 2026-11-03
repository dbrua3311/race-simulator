// 픽셀아트 트랙: 잔디 타일, 도트 아스팔트, 빨강·흰색 연석, 점선 중앙선.
// 낮은 해상도 캔버스에 그려서 보간 없이 키우면 도트 그림이 된다. 도로 경계는 충돌 판정과 같은 선이다.

import type { Vec } from '../core/vec';
import type { Track } from '../tracks/types';
import { worldToScreen, type Viewport } from './viewport';

const GRASS = ['#2f6b35', '#2a6230'];
const GRASS_DOT = '#3b7d40';
const ASPHALT = ['#585d68', '#535863'];
const CURB = ['#d6453d', '#f2f2f2'];
const CENTER = '#c9ccd2';

/** 결정론적 해시 (같은 칸은 항상 같은 무늬) */
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function clearPixel(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const tile = 6;
  for (let ty = 0; ty * tile < height; ty++) {
    for (let tx = 0; tx * tile < width; tx++) {
      ctx.fillStyle = GRASS[(tx + ty) % 2]!;
      ctx.fillRect(tx * tile, ty * tile, tile, tile);
      if (hash(tx, ty) < 0.35) {
        ctx.fillStyle = GRASS_DOT;
        ctx.fillRect(tx * tile + Math.floor(hash(ty, tx) * tile), ty * tile + Math.floor(hash(tx + 7, ty) * tile), 1, 1);
      }
    }
  }
}

function asphaltPattern(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  const tile = document.createElement('canvas');
  tile.width = 4;
  tile.height = 4;
  const t = tile.getContext('2d');
  if (!t) return ASPHALT[0]!;
  t.fillStyle = ASPHALT[0]!;
  t.fillRect(0, 0, 4, 4);
  t.fillStyle = ASPHALT[1]!;
  t.fillRect(0, 0, 1, 1);
  t.fillRect(2, 2, 1, 1);
  t.fillRect(3, 0, 1, 1);
  return ctx.createPattern(tile, 'repeat') ?? ASPHALT[0]!;
}

export function drawPixelRoad(ctx: CanvasRenderingContext2D, track: Track, view: Viewport) {
  const toScreen = (p: Vec) => worldToScreen(view, p);
  ctx.save();
  ctx.lineJoin = 'miter';
  // 도로
  ctx.beginPath();
  trace(ctx, track.left.map(toScreen));
  trace(ctx, track.right.map(toScreen));
  ctx.fillStyle = asphaltPattern(ctx);
  ctx.fill('evenodd');

  // 연석: 벽선을 따라 약 4 m 마다 빨강·흰색 번갈아
  const width = Math.max(2, Math.round(1.4 * view.scale));
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  for (const wall of [track.left, track.right]) {
    for (let i = 0; i < wall.length; i++) {
      const a = toScreen(wall[i]!);
      const b = toScreen(wall[(i + 1) % wall.length]!);
      ctx.strokeStyle = CURB[Math.floor(i / 2) % 2]!;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // 중앙 점선
  ctx.strokeStyle = CENTER;
  ctx.lineWidth = 1;
  for (let i = 0; i < track.center.length; i += 6) {
    const a = toScreen(track.center[i]!);
    const b = toScreen(track.center[(i + 2) % track.center.length]!);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function trace(ctx: CanvasRenderingContext2D, points: Vec[]) {
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}
