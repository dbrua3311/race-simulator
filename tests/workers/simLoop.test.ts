import { describe, expect, it } from 'vitest';
import { SimLoop, type LoopEnv } from '../../src/workers/simLoop';
import type { Snapshot, WorkerEvent } from '../../src/workers/protocol';
import { testTrack } from '../simulation/helpers';

/** 가짜 시계: now() 를 부를 때마다 조금씩 흐르고, 예약된 작업은 시간 순서로 실행된다 */
function fakeEnv() {
  let time = 0;
  const queue: { at: number; fn: () => void }[] = [];
  const events: WorkerEvent[] = [];
  const env: LoopEnv = {
    now: () => (time += 0.002),
    schedule: (fn, delay) => queue.push({ at: time + delay, fn }),
    post: (e) => events.push(e),
  };
  const run = (until: () => boolean, maxFrames = 200000) => {
    for (let i = 0; i < maxFrames && queue.length && !until(); i++) {
      queue.sort((a, b) => a.at - b.at);
      const next = queue.shift()!;
      time = Math.max(time, next.at);
      next.fn();
    }
  };
  const snapshots = () => events.filter((e): e is Snapshot => e.type === 'snapshot');
  const last = () => snapshots().at(-1)!;
  return { env, run, last, snapshots, advanceClock: (ms: number) => (time += ms) };
}

describe('워커 주행 루프', () => {
  const track = testTrack();

  function finishWith(speed: number, skipAfterTick?: number) {
    const f = fakeEnv();
    const loop = new SimLoop(f.env);
    loop.handle({ type: 'prepare', track, count: 20, seed: 'loop' });
    loop.handle({ type: 'setSpeed', speed });
    loop.handle({ type: 'go' });
    if (skipAfterTick !== undefined) {
      f.run(() => f.last().tick > skipAfterTick);
      loop.handle({ type: 'skip' });
      expect(f.last().skipping).toBe(true);
    }
    f.run(() => f.last().status === 'finished');
    return { final: f.last(), snapshots: f.snapshots() };
  }

  it('1배속, 10배속, 건너뛰기 모두 같은 최종 결과를 낸다', () => {
    const { final: slow, snapshots: slowSnaps } = finishWith(1);
    const { final: fast, snapshots: fastSnaps } = finishWith(10);
    const { final: skipped, snapshots: skipSnaps } = finishWith(1, 100);
    expect(slow.status).toBe('finished');
    // 실제로 배속·건너뛰기가 적용되었는지: 화면 갱신 횟수가 크게 줄어든다
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
    loop.handle({ type: 'prepare', track, count: 20, seed: 'loop' });
    expect(f.last()).toMatchObject({ status: 'ready', tick: 0 });
    f.run(() => false, 50);
    expect(f.last().tick).toBe(0);
    loop.handle({ type: 'go' });
    f.run(() => f.last().tick > 30);
    expect(f.last().status).toBe('running');
  });

  it('일시정지하면 시간이 흘러도 상태가 그대로이고, 재개하면 이어서 달린다', () => {
    const f = fakeEnv();
    const loop = new SimLoop(f.env);
    loop.handle({ type: 'prepare', track, count: 20, seed: 'loop' });
    loop.handle({ type: 'go' });
    f.run(() => f.last().tick > 120);
    loop.handle({ type: 'pause' });
    const paused = f.last();
    expect(paused.status).toBe('paused');
    f.advanceClock(5000);
    f.run(() => false, 1000);
    expect(f.last().tick).toBe(paused.tick);
    expect(Array.from(f.last().data)).toEqual(Array.from(paused.data));
    loop.handle({ type: 'resume' });
    f.run(() => f.last().tick > paused.tick + 30);
    expect(f.last().status).toBe('running');
  });

  it('일시정지해도 브레이크 종료로 판정되지 않는다', () => {
    const f = fakeEnv();
    const loop = new SimLoop(f.env);
    loop.handle({ type: 'prepare', track, count: 20, seed: 'loop' });
    loop.handle({ type: 'go' });
    f.run(() => f.last().tick > 60);
    loop.handle({ type: 'pause' });
    f.advanceClock(10000);
    expect(f.last().counts.brake).toBe(0);
  });

  it('ping 에 응답한다', () => {
    const f = fakeEnv();
    const events: WorkerEvent[] = [];
    const loop = new SimLoop({ ...f.env, post: (e) => events.push(e) });
    loop.handle({ type: 'ping', id: 3 });
    expect(events[0]).toMatchObject({ type: 'pong', id: 3 });
  });
});
