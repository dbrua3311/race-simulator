import { describe, expect, it } from 'vitest';
import { dot, leftNormal, sub } from '../../src/core/vec';
import { generateTrack, tangentAt } from '../../src/tracks/generate';
import { closedPolylinesIntersect, signedCurvatures } from '../../src/tracks/geometry';
import { DIFFICULTY, GENERATOR_VERSION, GRID, TRACK } from '../../src/tracks/params';
import { gridSlots } from '../../src/tracks/startGrid';
import type { Difficulty, Track } from '../../src/tracks/types';
import { validateTrack } from '../../src/tracks/validate';

// 기본은 난이도별 40개 시드. 더 많이 확인하려면: TRACK_SEEDS=1000 npm test
const SEED_COUNT = Number(process.env.TRACK_SEEDS ?? 40);
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const TIMEOUT = 5000 + SEED_COUNT * 20;

function mustGenerate(difficulty: Difficulty, seed: string): Track {
  const result = generateTrack(difficulty, seed);
  if (!result.ok) throw new Error(`${difficulty}/${seed} 생성 실패: ${JSON.stringify(result.issueCounts)}`);
  return result.track;
}

describe('트랙 생성 — 재현성', () => {
  it('같은 난이도·시드는 완전히 같은 트랙', () => {
    expect(mustGenerate('hard', 'R1')).toEqual(mustGenerate('hard', 'R1'));
  });

  it('시드나 난이도가 다르면 다른 트랙', () => {
    const base = mustGenerate('medium', 'R1');
    expect(mustGenerate('medium', 'R2').center).not.toEqual(base.center);
    expect(mustGenerate('hard', 'R1').center).not.toEqual(base.center);
  });

  it('생성 정보와 시드를 담고, JSON 으로 그대로 저장된다', () => {
    const track = mustGenerate('easy', '시드 테스트');
    expect(track).toMatchObject({ generatorVersion: GENERATOR_VERSION, difficulty: 'easy', seed: '시드 테스트' });
    expect(JSON.parse(JSON.stringify(track))).toEqual(track);
  });
});

describe.each(DIFFICULTIES)('트랙 생성 — 난이도 %s, 시드 여러 개', (difficulty) => {
  const tracks = Array.from({ length: SEED_COUNT }, (_, i) => mustGenerate(difficulty, `T${i}`));
  const params = DIFFICULTY[difficulty];

  it('모두 검증을 통과하는 단일 폐회로다 (교차·맞닿음 없음)', () => {
    for (const t of tracks) {
      const result = validateTrack(t.center, t.left, t.right, t.spacing, difficulty);
      expect(result.issues).toEqual([]);
      expect(closedPolylinesIntersect(t.left, t.right)).toBe(false);
      expect(t.length).toBeGreaterThanOrEqual(params.lengthRange[0]);
      expect(t.length).toBeLessThanOrEqual(params.lengthRange[1]);
    }
  }, TIMEOUT);

  it('출발선은 중심선 0번이고 체크포인트는 순서대로 고르게 놓인다', () => {
    for (const t of tracks) {
      expect(t.startLine.index).toBe(0);
      const indices = t.checkpoints.map((c) => c.index);
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
      expect(indices[0]).toBeGreaterThan(0);
      expect(indices.at(-1)).toBeLessThan(t.center.length);
      const gaps = [...indices, t.center.length].map((v, i, all) => v - (i === 0 ? 0 : all[i - 1]!));
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    }
  });

  it.each([50, 100])('출발 그리드 %i자리는 모두 정확한 직선 위, 도로 안에 겹치지 않게 놓인다', (count) => {
    for (const t of tracks) {
      const slots = gridSlots(t, count);
      expect(slots).toHaveLength(count);
      const curvature = signedCurvatures(t.center, 3);
      const n = t.center.length;
      for (const slot of slots) {
        const i = (Math.round(slot.s / t.spacing) + n) % n;
        expect(Math.abs(curvature[i]!)).toBeLessThan(1e-6);
        const lateral = dot(sub(slot.position, t.center[i]!), leftNormal(tangentAt(t.center, i)));
        // 바깥 줄 차와 벽 사이 2.5 m 이상 여유 (출발하자마자 벽에 닿지 않게)
        expect(TRACK.roadWidth / 2 - (Math.abs(lateral) + 1.1)).toBeGreaterThanOrEqual(2.5 - 1e-9);
      }
      const rows = Math.ceil(count / GRID.columns);
      const rowGap = rows > 1 ? slots[GRID.columns]!.s - slots[0]!.s : -GRID.rowSpacing;
      expect(-rowGap).toBeGreaterThanOrEqual(GRID.minRowSpacing);
    }
  }, TIMEOUT);
});

describe('난이도 차이', () => {
  const stats = (d: Difficulty) => {
    const ts = Array.from({ length: 20 }, (_, i) => mustGenerate(d, `D${i}`));
    const radius = ts.map((t) => {
      let max = 0;
      for (const k of signedCurvatures(t.center, 3)) max = Math.max(max, Math.abs(k));
      return 1 / max;
    });
    return radius.reduce((a, b) => a + b, 0) / radius.length;
  };

  it('상 < 중 < 하 순으로 가장 급한 커브가 더 급하다', () => {
    const easy = stats('easy');
    const medium = stats('medium');
    const hard = stats('hard');
    expect(hard).toBeLessThan(medium);
    expect(medium).toBeLessThan(easy);
  });
});
