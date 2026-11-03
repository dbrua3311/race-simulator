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
  it('1세대에는 금색 챔피언이 없고, 2세대부터 정확히 한 대', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 30 }, 's1');
    expect(exp.world.cars.filter((c) => c.champion)).toHaveLength(0);
    runToEnd(exp);
    nextGeneration(exp, null, 1);
    expect(exp.generation).toBe(2);
    expect(exp.world.cars.filter((c) => c.champion)).toHaveLength(1);
  });

  it('챔피언은 직전 1등의 유전자·출발 자리 그대로라 직전 1등 기록을 정확히 재현한다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 30 }, 's2');
    for (let g = 1; g <= 4; g++) {
      const record = runToEnd(exp);
      if (g > 1) {
        const champion = exp.world.cars.find((c) => c.champion)!;
        const previous = exp.history[g - 2]!.winner;
        expect(champion.slot).toBe(previous.slot);
        expect(champion.bestDistance / champion.goal).toBeCloseTo(previous.progress, 12);
        // 최고 진행률은 떨어지지 않는다
        expect(record.bestProgress).toBeGreaterThanOrEqual(previous.progress);
      }
      nextGeneration(exp, null, exp.generation);
      expect(exp.world.genomes[0]).toEqual(exp.history.at(-1)!.winner.genome);
    }
  });

  it('수동으로 고른 부모가 기록되고, 1등을 고르지 않아도 챔피언은 보존된다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 's3');
    const record = runToEnd(exp);
    const others = exp.world.cars.map((c) => c.id).filter((id) => id !== record.winner.id).slice(0, 3);
    nextGeneration(exp, others, 1);
    expect(exp.history[0]!.parents).toEqual({ mode: 'manual', ids: others });
    expect(exp.world.genomes[0]).toEqual(record.winner.genome);
    expect(exp.lineage!.slice(1).every((l) => l.ids.every((id) => others.includes(id)))).toBe(true);
  });

  it('부모가 2대 미만이면 거부하고, 같은 세대를 두 번 만들 수 없다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 's4');
    runToEnd(exp);
    expect(() => nextGeneration(exp, [1], 1)).toThrow('2대 이상');
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

  it('세대를 거듭하면 실제로 더 멀리 간다 (유전 알고리즘이 작동)', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 40 }, 'learn');
    const first = runToEnd(exp);
    for (let g = 1; g < 12; g++) {
      nextGeneration(exp, null, exp.generation);
      runToEnd(exp);
    }
    const last = exp.history.at(-1)!;
    expect(last.bestProgress).toBeGreaterThan(first.bestProgress);
    expect(last.averageProgress).toBeGreaterThan(first.averageProgress);
  }, 60000);
});
