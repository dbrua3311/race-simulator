import { add, leftNormal, scale } from '../core/vec';
import { tangentAt } from './generate';
import { GRID, TRACK } from './params';
import type { GridSlot, Track } from './types';

/** 출발선 뒤 직선에서 그리드로 쓸 수 있는 길이 (m) */
const USABLE_BEHIND = TRACK.straightBehind - 5;

/** 출발 그리드 자리. 가로 5칸, 앞줄부터 채운다. 자리가 많으면 줄 간격을 줄여 직선 안에 넣는다. */
export function gridSlots(track: Track, count: number): GridSlot[] {
  const rows = Math.ceil(count / GRID.columns);
  const rowSpacing =
    rows <= 1
      ? GRID.rowSpacing
      : Math.min(GRID.rowSpacing, Math.max(GRID.minRowSpacing, (USABLE_BEHIND - GRID.frontOffset) / (rows - 1)));

  const start = track.center[0]!;
  const forward = tangentAt(track.center, 0);
  const left = leftNormal(forward);
  const heading = Math.atan2(forward.y, forward.x);
  const middle = (GRID.columns - 1) / 2;

  const slots: GridSlot[] = [];
  for (let id = 0; id < count; id++) {
    const row = Math.floor(id / GRID.columns);
    const column = id % GRID.columns;
    const s = -GRID.frontOffset - row * rowSpacing;
    // column 0 이 진행 방향 기준 가장 왼쪽
    const lateral = (middle - column) * GRID.columnSpacing;
    slots.push({ id, row, column, heading, s, position: add(add(start, scale(forward, s)), scale(left, lateral)) });
  }
  return slots;
}
