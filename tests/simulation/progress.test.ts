import { describe, expect, it } from 'vitest';
import { nearestIndex } from '../../src/simulation/collision';
import { DT } from '../../src/simulation/params';
import { gateDistances, progressOf, updateProgress } from '../../src/simulation/progress';
import { advance } from '../../src/simulation/world';
import { tangentAt } from '../../src/tracks/generate';
import { blankCar, followCenterline, only, randomWorld, testTrack } from './helpers';


describe('진행률·완주', () => {
  for (const difficulty of ['easy', 'hard'] as const) {
    const track = testTrack('LAP1', difficulty);
    const base = randomWorld(track, 50, 'lap');

    it(`${difficulty}: 중심선을 따라 한 바퀴 돌면 완주로 끝나고 진행률 100%`, () => {
      const front = base.cars.findIndex((c) => c.slot === 2);
      const world = only(base, front);
      advance(world, track, 60 * 300, followCenterline(track));
      const car = world.cars[0]!;
      expect(car.endReason).toBe('finish');
      expect(progressOf(car)).toBe(1);
      expect(car.nextGate).toBe(gateDistances(track, car.startS, car.goal).length);
      // 목표 거리(한 바퀴 - 그리드 길이 - 여유)를 넘지 않고 바로 멈춘다
      expect(car.goal).toBeLessThan(track.length);
      expect(car.s - car.startS).toBeGreaterThanOrEqual(car.goal);
      expect(car.s - car.startS).toBeLessThan(car.goal + 0.6);
      expect(car.endTick! * DT).toBeGreaterThan(car.goal / 13);
    });

    it(`${difficulty}: 맨 뒷줄에서 출발해도 같은 거리를 달려야 완주 (자기 출발점 기준)`, () => {
      const back = base.cars.findIndex((c) => c.slot === 47);
      const front = base.cars.findIndex((c) => c.slot === 2);
      const a = only(base, back);
      const b = only(base, front);
      advance(a, track, 60 * 300, followCenterline(track));
      advance(b, track, 60 * 300, followCenterline(track));
      expect(a.cars[0]!.endReason).toBe('finish');
      expect(a.cars[0]!.startS).toBeLessThan(b.cars[0]!.startS - 40);
      // 같은 운전이면 완주 시간이 거의 같다 (앞줄 이득 없음)
      expect(Math.abs(a.cars[0]!.endTick! - b.cars[0]!.endTick!) * DT).toBeLessThan(1.5);
    });
  }

  it('트랙을 한 바퀴 따라 움직이면 위치가 끊김 없이 늘어난다 (헤어핀에서도 건너뛰지 않음)', () => {
    for (const seed of ['C1', 'C2', 'C3']) {
      const track = testTrack(seed, 'hard');
      const car = { ...blankCar(), trackIndex: 0, goal: track.length * 2 };
      const n = track.center.length;
      let prev = car.s;
      for (let k = 1; k <= n * 5; k++) {
        const t = k / 5;
        const i = Math.floor(t) % n;
        const a = track.center[i]!;
        const b = track.center[(i + 1) % n]!;
        const f = t - Math.floor(t);
        car.x = a.x + (b.x - a.x) * f;
        car.y = a.y + (b.y - a.y) * f;
        car.trackIndex = nearestIndex(track, car.trackIndex, car);
        updateProgress(car, track, k);
        const step = car.s - prev;
        expect(step).toBeGreaterThan(0);
        expect(step).toBeLessThan(track.spacing);
        prev = car.s;
      }
      expect(car.s).toBeCloseTo(track.length, 6);
    }
  });

  it('결승선(출발선)을 앞뒤로 계속 넘나들어도 완주가 아니고 진행률도 늘지 않는다', () => {
    const track = testTrack();
    const car = { ...blankCar(), startS: -4, s: -4, goal: track.length + 70, trackIndex: track.center.length - 2 };
    const f = tangentAt(track.center, 0);
    const p0 = track.center[0]!;
    for (let k = 0; k < 2000; k++) {
      const along = -4 + 8 * Math.abs(Math.sin(k / 20)); // -4 m ~ +4 m 왕복
      car.x = p0.x + f.x * along;
      car.y = p0.y + f.y * along;
      car.trackIndex = nearestIndex(track, car.trackIndex, car);
      expect(updateProgress(car, track, k)).toBe(false);
    }
    expect(car.bestDistance).toBeLessThanOrEqual(8.01);
  });

  it('반대 방향으로 달리면 진행률이 늘지 않고 완주하지 못한다', () => {
    const track = testTrack();
    const world = only(randomWorld(track, 50, 'rev'), 0);
    world.cars[0]!.heading += Math.PI;
    advance(world, track, 60 * 60, followCenterline(track, 10, -6));
    const car = world.cars[0]!;
    expect(car.endReason).not.toBe('finish');
    expect(car.bestDistance).toBeLessThan(3);
    expect(car.s).toBeLessThan(car.startS - 20);
  });

  it('체크포인트 목록: 출발점부터 순서대로, 마지막은 목표 지점', () => {
    const track = testTrack();
    const gates = gateDistances(track, -30);
    expect(gates.at(-1)).toBe(track.length);
    expect(gates).toEqual([...gates].sort((a, b) => a - b));
    expect(gates).toHaveLength(track.checkpoints.length + 2);
    expect(gates[0]).toBeCloseTo(30, 9); // 처음 지나는 것은 출발선
    // 목표가 한 바퀴보다 길면 출발선(결승선)을 한 번 더 지나야 한다
    const longer = gateDistances(track, -30, track.length + 70);
    expect(longer).toContain(track.length + 30);
    expect(longer.at(-1)).toBe(track.length + 70);
  });

  it('완주한 차는 출발 그리드 맨 뒷줄보다 뒤(도착 구간)에 멈춘다 (그리드에 남은 차와 겹치지 않게)', () => {
    const track = testTrack();
    const base = randomWorld(track, 50, 'zone');
    const backRow = Math.min(...base.cars.map((c) => c.startS));
    for (const slot of [0, 2, 49]) {
      const world = only(base, base.cars.findIndex((c) => c.slot === slot));
      advance(world, track, 60 * 300, followCenterline(track));
      const car = world.cars[0]!;
      expect(car.endReason).toBe('finish');
      // 출발선 기준 위치 (한 바퀴 전)
      const finishS = car.s - track.length;
      expect(finishS).toBeLessThan(backRow - 5);
    }
  });

  it('그리드 자리의 출발 좌표는 출발선 뒤(음수)이고 앞줄일수록 출발선에 가깝다', () => {
    const track = testTrack();
    const world = randomWorld(track, 50, 'start');
    for (const car of world.cars) expect(car.startS).toBeLessThan(0);
    const front = world.cars.find((c) => c.slot === 0)!;
    const back = world.cars.find((c) => c.slot === 45)!;
    expect(front.startS).toBeGreaterThan(back.startS);
  });
});
