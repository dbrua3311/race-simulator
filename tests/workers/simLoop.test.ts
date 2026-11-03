import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/genetics/params';
import { SimLoop, type LoopEnv } from '../../src/workers/simLoop';
import type { Snapshot, WorkerEvent } from '../../src/workers/protocol';
import { testTrack } from '../simulation/helpers';

/** 가짜 시계: now() 를 부를 때마다 조금씩 흐르고, 예약된 작업은 시간 순서로 실행된다 */
function fakeEnv() {
  let time = 0;
  const queue: { at: number; fn: () => void }[] = [];
  const events: WorkerEvent[] = [];
  const env: LoopEnv = {
    now: () => (time += 0.5),
    schedule: (fn, delay) => queue.push({ at: time + delay, fn }),
    post: (e) => events.push(e),
  };
  const run = (until: () => boolean, maxFrames = 300000) => {
    for (let i = 0; i < maxFrames && queue.length && !until(); i++) {
      queue.sort((a, b) => a.at - b.at);
      const next = queue.shift()!;
      time = Math.max(time, next.at);
      next.fn();
    }
  };
  const snapshots = () => events.filter((e): e is Snapshot => e.type === 'snapshot');
  const last = () => snapshots().at(-1)!;
  const errors = () => events.filter((e) => e.type === 'error');
  const evaluated = () => events.filter((e) => e.type === 'evaluated');
  return { env, run, last, snapshots, errors, evaluated, advanceClock: (ms: number) => (time += ms) };
}

const track = testTrack();
const settings = { ...DEFAULT_SETTINGS, populationSize: 20 };

function started(speed = 1) {
  const f = fakeEnv();
  const loop = new SimLoop(f.env);
  loop.handle({ type: 'newExperiment', track, settings, seed: 'loop' });
  loop.handle({ type: 'setSpeed', speed });
  loop.handle({ type: 'go' });
  return { f, loop };
}

describe('워커 주행 루프', () => {
  function finishWith(speed: number, skipAfterTick?: number) {
    const { f, loop } = started(speed);
    if (skipAfterTick !== undefined) {
      f.run(() => f.last().tick > skipAfterTick);
      loop.handle({ type: 'skip' });
      expect(f.last().skipping).toBe(true);
    }
    f.run(() => f.last().status === 'evaluated');
    return { final: f.last(), snapshots: f.snapshots() };
  }

  it('1배속, 10배속, 건너뛰기 모두 같은 최종 결과를 낸다', () => {
    const { final: slow, snapshots: slowSnaps } = finishWith(1);
    const { final: fast, snapshots: fastSnaps } = finishWith(10);
    const { final: skipped, snapshots: skipSnaps } = finishWith(1, 100);
    expect(slow.status).toBe('evaluated');
    expect(fastSnaps.length).toBeLessThan(slowSnaps.length / 3);
    expect(skipSnaps.length).toBeLessThan(slowSnaps.length / 3);
    expect(fast.tick).toBe(slow.tick);
    expect(Array.from(fast.data)).toEqual(Array.from(slow.data));
    expect(skipped.tick).toBe(slow.tick);
    expect(Array.from(skipped.data)).toEqual(Array.from(slow.data));
  });

  it('준비 상태에서는 움직이지 않고, 출발 신호로 달리기 시작한다', () => {
    const f = fakeEnv();
    const loop = new SimLoop(f.env);
    loop.handle({ type: 'newExperiment', track, settings, seed: 'loop' });
    expect(f.last()).toMatchObject({ status: 'ready', tick: 0, generation: 1 });
    f.run(() => false, 50);
    expect(f.last().tick).toBe(0);
    loop.handle({ type: 'go' });
    f.run(() => f.last().tick > 30);
    expect(f.last().status).toBe('running');
  });

  it('일시정지하면 시간이 흘러도 상태가 그대로이고 브레이크 종료가 생기지 않으며, 재개하면 이어서 달린다', () => {
    const { f, loop } = started();
    f.run(() => f.last().tick > 120);
    loop.handle({ type: 'pause' });
    const paused = f.last();
    expect(paused.status).toBe('paused');
    f.advanceClock(10000);
    f.run(() => false, 1000);
    expect(f.last().tick).toBe(paused.tick);
    expect(Array.from(f.last().data)).toEqual(Array.from(paused.data));
    expect(f.last().counts.brake).toBe(paused.counts.brake);
    loop.handle({ type: 'resume' });
    f.run(() => f.last().tick > paused.tick + 30);
    expect(f.last().status).toBe('running');
  });

  it('수동 모드: 세대가 끝나면 평가 후 기다리고, 결정완료로 다음 세대가 하나만 생긴다', () => {
    const { f, loop } = started(10);
    f.run(() => f.last().status === 'evaluated');
    expect(f.evaluated()).toHaveLength(1);
    f.run(() => false, 200);
    expect(f.last()).toMatchObject({ status: 'evaluated', generation: 1 });
    loop.handle({ type: 'confirmParents', generation: 1, parentIds: [1, 2, 3] });
    loop.handle({ type: 'confirmParents', generation: 1, parentIds: [1, 2, 3] });
    expect(f.last()).toMatchObject({ status: 'ready', generation: 2 });
    expect(f.last().championIndex).toBe(0);
    expect(f.errors()).toHaveLength(1);
  });

  it('자동 선택 모드: 세대가 끝나면 다음 세대가 그리드에 서서 출발을 기다린다', () => {
    const f = fakeEnv();
    const loop = new SimLoop(f.env);
    loop.handle({ type: 'newExperiment', track, settings: { ...settings, selectionMode: 'auto' }, seed: 'loop' });
    loop.handle({ type: 'setSpeed', speed: 10 });
    loop.handle({ type: 'go' });
    f.run(() => f.last().generation === 2);
    expect(f.last().status).toBe('ready');
  });

  it('자동 학습: 입력 없이 세대가 계속 늘어나고, 정지하면 그 자리에서 일시정지·상태 보존', () => {
    const { f, loop } = started();
    loop.handle({ type: 'startAuto' });
    f.run(() => f.last().generation >= 4);
    expect(f.evaluated().length).toBeGreaterThanOrEqual(3);
    f.run(() => f.last().tick > 60);
    loop.handle({ type: 'stopAuto' });
    const stopped = f.last();
    expect(stopped).toMatchObject({ status: 'paused', auto: false });
    // 정지 후에는 새 세대가 생기지 않는다
    const evaluatedCount = f.evaluated().length;
    f.advanceClock(60000);
    f.run(() => false, 5000);
    expect(f.last().generation).toBe(stopped.generation);
    expect(f.last().tick).toBe(stopped.tick);
    expect(f.evaluated()).toHaveLength(evaluatedCount);
    // 일반 주행으로 남은 주행을 이어 갈 수 있다
    loop.handle({ type: 'resume' });
    f.run(() => f.last().tick > stopped.tick + 10);
    expect(f.last()).toMatchObject({ status: 'running', generation: stopped.generation });
    // 다시 자동 학습: 같은 세대에서 이어서
    loop.handle({ type: 'startAuto' });
    expect(f.last().generation).toBe(stopped.generation);
    f.run(() => f.last().generation > stopped.generation);
    expect(f.last().auto).toBe(true);
  });

  it('자동 학습 중 실험을 내보내도 진행 상태가 그대로 담긴다', () => {
    const { f, loop } = started();
    loop.handle({ type: 'startAuto' });
    f.run(() => f.last().generation >= 2);
    loop.handle({ type: 'stopAuto' });
    const events: WorkerEvent[] = [];
    const probe = new SimLoop({ ...f.env, post: (e) => events.push(e) });
    expect(probe.experiment).toBeNull();
    loop.handle({ type: 'exportExperiment', requestId: 7 });
    expect(loop.experiment!.generation).toBe(f.last().generation);
    expect(loop.experiment!.history.length).toBe(f.last().generation - 1);
  });

  it('ping 에 응답한다', () => {
    const f = fakeEnv();
    const events: WorkerEvent[] = [];
    const loop = new SimLoop({ ...f.env, post: (e) => events.push(e) });
    loop.handle({ type: 'ping', id: 3 });
    expect(events[0]).toMatchObject({ type: 'pong', id: 3 });
  });
});
