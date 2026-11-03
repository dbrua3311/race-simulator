import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/genetics/params';
import { historyToCsv, genomeFile } from '../../src/persistence/csv';
import { createSaveFile, describePoint } from '../../src/persistence/saveFile';
import { parseSaveFile, SaveFileError } from '../../src/persistence/validate';
import { evaluate, newExperiment, nextGeneration, type Experiment } from '../../src/simulation/experiment';
import { DT, MAX_RUN_TIME } from '../../src/simulation/params';
import { advance } from '../../src/simulation/world';
import { testTrack } from '../simulation/helpers';

const track = testTrack('SAVE1', 'easy');

function twoGenerations(): Experiment {
  const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 'save');
  advance(exp.world, track, Math.ceil(MAX_RUN_TIME / DT) + 10);
  evaluate(exp);
  nextGeneration(exp, [1, 2, 3], 1);
  exp.status = 'paused'; // 실제로는 워커가 출발·일시정지하며 바꾼다
  advance(exp.world, track, 600);
  return exp;
}

const roundTrip = (exp: Experiment, selection: number[] = []) =>
  parseSaveFile(JSON.stringify(createSaveFile(exp, '테스트', selection, new Date('2026-11-04T10:00:00Z'))));

describe('실험 저장·불러오기', () => {
  it('주행 도중 저장한 실험을 불러와 이어서 계산하면 원래와 똑같다', () => {
    const original = twoGenerations();
    const loaded = roundTrip(original).experiment;
    expect(loaded.world.cars).toEqual(original.world.cars);
    expect(loaded.world.genomes).toEqual(original.world.genomes);
    expect(loaded.rng).toEqual(original.rng);
    expect(loaded.track).toEqual(original.track);
    advance(original.world, track, 5000);
    advance(loaded.world, loaded.track, 5000);
    expect(loaded.world.cars).toEqual(original.world.cars);
  });

  it('저장 파일에 원문 45절 항목이 모두 들어 있다', () => {
    const file = roundTrip(twoGenerations());
    expect(file).toMatchObject({ format: 'race-simulator-experiment', formatVersion: 1, name: '테스트' });
    expect(file.savedAt).toBe('2026-11-04T10:00:00.000Z');
    const e = file.experiment;
    expect(e.track.seed).toBe('SAVE1');
    expect(e.track.difficulty).toBe('easy');
    expect(e.track.center.length).toBeGreaterThan(100);
    expect(e.track.startLine).toBeDefined();
    expect(e.track.checkpoints.length).toBeGreaterThan(5);
    expect(e.generation).toBe(2);
    expect(e.settings.populationSize).toBe(20);
    expect(e.world.genomes).toHaveLength(20);
    expect(e.history[0]!.parents).toEqual({ mode: 'manual', ids: [1, 2, 3] });
    expect(e.history[0]!.bestFitness).toBeGreaterThan(0);
    expect(e.ghosts).toHaveLength(1);
    expect(e.rng).toBeDefined();
    expect(file.savedPoint).toMatch(/2세대 주행 중/);
  });

  it('부모 선택 중(결정완료 전)에 저장하면 고른 차와 미확정 상태가 그대로 담긴다', () => {
    const exp = newExperiment(track, { ...DEFAULT_SETTINGS, populationSize: 20 }, 'sel');
    advance(exp.world, track, Math.ceil(MAX_RUN_TIME / DT) + 10);
    evaluate(exp);
    const file = roundTrip(exp, [4, 9]);
    expect(file.experiment.status).toBe('evaluated');
    expect(file.ui.selection).toEqual([4, 9]);
    expect(describePoint(exp)).toBe('1세대 주행 완료, 부모 선택 전');
  });

  it('손상되었거나 다른 파일은 이유와 함께 거부한다', () => {
    const good = JSON.parse(JSON.stringify(createSaveFile(twoGenerations(), 'x', [], new Date())));
    const broken = (mutate: (f: typeof good) => void) => {
      const f = JSON.parse(JSON.stringify(good));
      mutate(f);
      return () => parseSaveFile(JSON.stringify(f));
    };
    expect(() => parseSaveFile('{ 이건 json 아님')).toThrow(SaveFileError);
    expect(() => parseSaveFile('{"hello": 1}')).toThrow('Race Simulator 실험 파일이 아닙니다');
    expect(broken((f) => (f.formatVersion = 99))).toThrow('형식 버전');
    expect(broken((f) => f.experiment.world.genomes[0].pop())).toThrow('유전자 길이');
    expect(broken((f) => (f.experiment.world.cars[0].x = 'NaN'))).toThrow(SaveFileError);
    expect(broken((f) => f.experiment.world.cars.pop())).toThrow('자동차·유전자 수');
    expect(broken((f) => (f.experiment.track.center = []))).toThrow('트랙 중심선');
    expect(broken((f) => (f.experiment.settings.populationSize = 5000))).toThrow('개체 수');
    expect(broken((f) => delete f.experiment.rng)).toThrow('난수 상태');
  });
});

describe('CSV·유전자 내보내기', () => {
  it('세대별 통계 CSV: 한글 머리글, 세대마다 한 줄', () => {
    const exp = twoGenerations();
    const csv = historyToCsv(exp.history);
    expect(csv.startsWith('﻿세대,개체 수,최고 적합도,평균 적합도,최고 진행률(%)')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]!.split(',')[0]).toBe('1');
    expect(lines[1]).toContain('수동,1 2 3');
  });

  it('최고 유전자 파일에는 신경망 구조와 유전자 50개', () => {
    const file = genomeFile(twoGenerations().history[0]!);
    expect(file.network).toEqual([5, 6, 2]);
    expect(file.genome).toHaveLength(50);
  });
});
