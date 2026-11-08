import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { breed, type Candidate } from '../../src/genetics/evolve';
import { randomGenome } from '../../src/genetics/genome';
import { crossover, gaussian, mutate, neuronBlocks } from '../../src/genetics/operators';
import { DEFAULT_SETTINGS } from '../../src/genetics/params';

describe('유전 연산', () => {
  it('뉴런 블록은 유전자 50개를 겹치지 않고 모두 덮는다', () => {
    const genes = neuronBlocks().flat().sort((a, b) => a - b);
    expect(genes).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(neuronBlocks()).toHaveLength(8);
  });

  it('교차: 자식의 각 뉴런은 두 부모 중 한쪽 것을 통째로 물려받고, 실제로 섞인다', () => {
    const rng = createRng('x');
    const a = randomGenome(rng);
    const b = randomGenome(rng);
    const child = crossover(a, b, rng);
    let fromA = 0;
    let fromB = 0;
    for (const block of neuronBlocks()) {
      const isA = block.every((g) => child[g] === a[g]);
      const isB = block.every((g) => child[g] === b[g]);
      expect(isA || isB).toBe(true);
      if (isA) fromA++;
      if (isB) fromB++;
    }
    expect(fromA).toBeGreaterThan(0);
    expect(fromB).toBeGreaterThan(0);
  });

  it('돌연변이: 확률만큼 유전자를 바꾼다 (0 이면 그대로)', () => {
    const rng = createRng('m');
    const g = randomGenome(rng);
    const copy = [...g];
    expect(mutate(copy, 0, 0.5, rng)).toBe(0);
    expect(copy).toEqual(g);
    let changed = 0;
    for (let k = 0; k < 200; k++) changed += mutate([...g], 0.15, 0.5, rng);
    expect(changed / (200 * 50)).toBeCloseTo(0.15, 1);
  });

  it('정규분포 노이즈: 평균 0, 표준편차 1', () => {
    const rng = createRng('n');
    const xs = Array.from({ length: 20000 }, () => gaussian(rng));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
});

describe('다음 세대 만들기', () => {
  const rng = createRng('breed');
  const ranked: Candidate[] = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    genome: randomGenome(rng),
    fitness: 100 - i,
    reached: null,
  }));

  it('모든 자리를 실제 부모와 변형 기록이 있는 자손으로 채운다', () => {
    const { genomes, lineage } = breed(ranked, null, { ...DEFAULT_SETTINGS, populationSize: 30 }, createRng('a'));
    expect(genomes).toHaveLength(30);
    expect(lineage.every((l) => l.variation === 'local' || l.variation === 'standard')).toBe(true);
    expect(lineage.every((l) => l.ids.length > 0)).toBe(true);
    // 자손은 부모와 똑같지 않다 (교차·돌연변이가 실제로 적용됨)
    const identical = genomes.filter((g) => ranked.some((c) => c.genome.every((v, i) => v === g[i])));
    expect(identical.length).toBeLessThan(5);
  });

  it('수동 선택이면 고른 부모의 유전자로만 자손을 만든다', () => {
    const settings = { ...DEFAULT_SETTINGS, populationSize: 40, mutationRate: 0 };
    const { genomes, lineage } = breed(ranked, [7, 12], settings, createRng('b'));
    const p7 = ranked[6]!.genome;
    const p12 = ranked[11]!.genome;
    for (let k = 0; k < genomes.length; k++) {
      for (const id of lineage[k]!.ids) expect([7, 12]).toContain(id);
      genomes[k]!.forEach((v, i) => expect(v === p7[i] || v === p12[i]).toBe(true));
    }
    expect(lineage.every((l) => !l.ids.includes(1))).toBe(true);
  });

  it('자동(토너먼트)은 적합도 높은 차를 더 자주 부모로 고른다', () => {
    const { lineage } = breed(ranked, null, { ...DEFAULT_SETTINGS, preserveDriving: false, populationSize: 400 }, createRng('c'));
    const ids = lineage.flatMap((l) => l.ids);
    const top = ids.filter((id) => id <= 5).length;
    const bottom = ids.filter((id) => id >= 16).length;
    expect(top).toBeGreaterThan(bottom * 3);
  });
});


describe('신경망 주행 보존', () => {
  const makeRows = () => {
    const rng = createRng('preserve-parents');
    return Array.from({ length: 20 }, (_, i) => ({ id: i + 1, genome: randomGenome(rng), fitness: 100 - i, reached: 100 }));
  };
  it('우수 부모가 충분하면 일부는 작은 변이, 나머지는 기존 탐색으로 만들며 계보를 기록한다', () => {
    const rows = makeRows();
    const result = breed(rows, null, DEFAULT_SETTINGS, createRng('preserve'));
    const local = result.lineage.filter((l) => l.variation === 'local');
    const standard = result.lineage.filter((l) => l.variation === 'standard');
    expect(local).toHaveLength(16);
    expect(standard).toHaveLength(4);
    expect(local.every((l) => !l.crossed && l.ids.length === 1 && [0.1, 0.3].includes(l.mutationScale!))).toBe(true);
    expect(local.some((l) => l.mutatedGenes > 0)).toBe(true);
    for (let i = 0; i < result.genomes.length; i++) {
      const info = result.lineage[i]!;
      if (info.variation !== 'local') continue;
      const parent = rows.find((p) => p.id === info.ids[0])!;
      expect(info.mutatedGenes).toBe(result.genomes[i]!.filter((v, g) => v !== parent.genome[g]).length);
    }
  });
  it('초기 탐색 중이거나 우수 부모가 4대 미만이면 작은 변이를 강제하지 않는다', () => {
    const rows = makeRows().map((r, i) => ({ ...r, fitness: i < 3 ? 90 : 0 }));
    const result = breed(rows, null, DEFAULT_SETTINGS, createRng('not-ready'));
    expect(result.lineage.some((l) => l.variation === 'local')).toBe(false);
  });
  it('수동 제외한 우승을 일반 자손의 부모로 다시 넣지 않고 선택한 부모 안에서 보존한다', () => {
    const rows = makeRows(), ids = [7, 8, 9, 10];
    const result = breed(rows, ids, { ...DEFAULT_SETTINGS, mutationRate: 0 }, createRng('manual-preserve'));
    for (let i = 0; i < result.genomes.length; i++) {
      expect(result.lineage[i]!.ids.every((id) => ids.includes(id))).toBe(true);
      if (result.lineage[i]!.variation === 'local')
        expect(result.genomes[i]).toEqual(rows.find((r) => r.id === result.lineage[i]!.ids[0])!.genome);
    }
  });
  it('끄면 기존 교차 확률과 변이 폭만 사용하고 0% 교차·변이를 존중한다', () => {
    const rows = makeRows();
    const result = breed(rows, [1, 2, 3, 4], { ...DEFAULT_SETTINGS, preserveDriving: false, mutationRate: 0, crossoverRate: 0 }, createRng('off'));
    expect(result.lineage.some((l) => l.variation === 'local')).toBe(false);
    expect(result.genomes.every((g) => rows.some((p) => JSON.stringify(g) === JSON.stringify(p.genome)))).toBe(true);
  });
});
