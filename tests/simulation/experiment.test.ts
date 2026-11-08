import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/genetics/params';
import { evaluate, newExperiment, nextGeneration, type Experiment } from '../../src/simulation/experiment';
import { DT, MAX_RUN_TIME } from '../../src/simulation/params';
import { advance } from '../../src/simulation/world';
import { testTrack } from './helpers';

const track = testTrack('EXP1', 'easy');

function runToEnd(exp: Experiment) {
  advance(exp.world, exp.track, Math.ceil(MAX_RUN_TIME / DT) + 10);
  return evaluate(exp);
}

describe('세대 진화', () => {
  it('다음 세대의 모든 차는 특별 표시 없이 무작위 그리드에 배치된다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 30 }, 's1');
    runToEnd(exp);
    nextGeneration(exp, null, 1);
    expect(exp.generation).toBe(2);
    expect(exp.world.cars).toHaveLength(30);
    expect(exp.world.cars.every((c) => !('champion' in c))).toBe(true);
    expect(exp.lineage!.every((l) => l.variation === 'local' || l.variation === 'standard')).toBe(true);
    expect(new Set(exp.world.cars.map((c) => c.slot)).size).toBe(30);
  });

  it('같은 완료 세대와 난수에서 생성한 다음 세대는 유전자와 배치가 같다', () => {
    const a = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 30 }, 's2');
    runToEnd(a);
    const b: Experiment = structuredClone(a);
    nextGeneration(a, null, 1);
    nextGeneration(b, null, 1);
    expect(b).toEqual(a);
  });

  it('수동으로 제외한 1등을 별도 자리로 다시 넣지 않는다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 's3');
    const record = runToEnd(exp);
    const others = exp.world.cars.map((c) => c.id).filter((id) => id !== record.winner.id).slice(0, 3);
    nextGeneration(exp, others, 1);
    expect(exp.history[0]!.parents).toEqual({ mode: 'manual', ids: others });
    expect(exp.lineage!.every((l) => l.ids.every((id) => others.includes(id)))).toBe(true);
  });

  it('부모가 없으면 거부하고, 같은 세대를 두 번 만들 수 없다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 's4');
    runToEnd(exp);
    expect(() => nextGeneration(exp, [], 1)).toThrow('1대 이상');
    expect(() => nextGeneration(exp, [999], 1)).toThrow('1대 이상');
    nextGeneration(exp, [1, 2], 1);
    expect(() => nextGeneration(exp, [1, 2], 1)).toThrow();
    expect(exp.generation).toBe(2);
  });

  it('주행이 끝나기 전에는 평가·다음 세대를 만들 수 없다', () => {
    const exp = newExperiment(track, DEFAULT_SETTINGS, 's5');
    expect(() => evaluate(exp)).toThrow();
    expect(() => nextGeneration(exp, null, 1)).toThrow();
  });

  it('개체 수를 바꾸면 다음 세대에 적용된다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 's6');
    runToEnd(exp);
    exp.settings = { ...exp.settings, populationSize: 35 };
    nextGeneration(exp, null, 1);
    expect(exp.world.cars).toHaveLength(35);
  });

  it('실험은 JSON 으로 저장했다가 그대로 이어서 같은 결과를 낸다', () => {
    const a = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 's7');
    runToEnd(a);
    nextGeneration(a, null, 1);
    advance(a.world, track, 300);
    const b: Experiment = JSON.parse(JSON.stringify(a));
    advance(a.world, a.track, 3000);
    advance(b.world, b.track, 3000);
    expect(b.world).toEqual(a.world);
    runToEnd(a);
    runToEnd(b);
    nextGeneration(a, null, 2);
    nextGeneration(b, null, 2);
    expect(b.world.genomes).toEqual(a.world.genomes);
  });

  it('부모 1대만 고르면 모든 자손이 그 차를 조금씩 바꾼 것', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 's8');
    runToEnd(exp);
    nextGeneration(exp, [5], 1);
    expect(exp.lineage!.every((l) => l.ids.length === 1 && l.ids[0] === 5 && !l.crossed)).toBe(true);
  });

  it('조작 순서 방식: 실제 평가·변이를 반복하며 조작표 구조를 유지한다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 40, brain: 'sequence' }, 'seq');
    expect(exp.world.brain).toBe('sequence');
    const first = runToEnd(exp);
    // 1세대는 모두 일단 출발한다
    expect(exp.world.cars.every((c) => c.hasMoved)).toBe(true);
    for (let g = 1; g < 15; g++) {
      nextGeneration(exp, null, exp.generation);
      runToEnd(exp);
      expect(exp.world.genomes.every((genes) => genes.length === 600)).toBe(true);
    }
    const last = exp.history.at(-1)!;
    expect(last.bestProgress).toBeGreaterThan(first.bestProgress * 2);
    expect(last.averageProgress).toBeGreaterThan(first.averageProgress * 2);
  }, 60000);

  it('세대를 거듭하면 실제로 더 멀리 간다 (유전 알고리즘이 작동)', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 40 }, 'learn');
    const first = runToEnd(exp);
    for (let g = 1; g < 12; g++) {
      nextGeneration(exp, null, exp.generation);
      runToEnd(exp);
    }
    const last = exp.history.at(-1)!;
    expect(last.bestProgress).toBeGreaterThanOrEqual(first.bestProgress);
    expect(last.averageProgress).toBeGreaterThan(first.averageProgress * 3);
  }, 60000);
});
