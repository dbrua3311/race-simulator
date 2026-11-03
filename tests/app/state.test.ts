import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../../src/app/state';

describe('화면 상태 — 트랙 생성과 고정', () => {
  it('처음에는 주어진 시드로 트랙을 만든다', () => {
    const s = initialState('ABC', 'easy');
    expect(s.track?.seed).toBe('ABC');
    expect(s.track?.difficulty).toBe('easy');
    expect(s.trackLocked).toBe(false);
    expect(s.populationSize).toBe(50);
  });

  it('난이도를 바꾸면 같은 시드로 다시 만든다', () => {
    const s = reducer(initialState('ABC', 'easy'), { type: 'setDifficulty', difficulty: 'hard' });
    expect(s.track?.difficulty).toBe('hard');
    expect(s.track?.seed).toBe('ABC');
  });

  it('빈 시드는 오류를 보여 준다', () => {
    const s = reducer(initialState('ABC'), { type: 'generateTrack', seed: '' });
    expect(s.track).toBeNull();
    expect(s.trackError).toBe('시드를 입력하세요');
  });

  it('주행을 시작하면 트랙이 고정되어 생성·난이도 변경이 무시된다', () => {
    const locked = reducer(initialState('ABC'), { type: 'startRun' });
    expect(locked.trackLocked).toBe(true);
    expect(locked.phase).toBe('countdown');
    expect(reducer(locked, { type: 'generateTrack', seed: 'XYZ' })).toBe(locked);
    expect(reducer(locked, { type: 'setDifficulty', difficulty: 'hard' })).toBe(locked);
  });

  it('새 판을 시작하면 고정이 풀리고 트랙은 남아 있다', () => {
    const locked = reducer(initialState('ABC'), { type: 'startRun' });
    const fresh = reducer(locked, { type: 'newGame' });
    expect(fresh.trackLocked).toBe(false);
    expect(fresh.phase).toBe('trackSetup');
    expect(fresh.track).toBe(locked.track);
  });

  it('카운트다운 3초가 끝나면 주행 중이 된다', () => {
    let s = reducer(initialState('ABC'), { type: 'startRun' });
    expect(s.countdown).toBe(3);
    s = reducer(s, { type: 'countdownTick' });
    s = reducer(s, { type: 'countdownTick' });
    expect(s.phase).toBe('countdown');
    s = reducer(s, { type: 'countdownTick' });
    expect(s.phase).toBe('running');
  });

  it('카운트다운 중에는 워커 상태를 무시하고, 이후에는 따른다', () => {
    const counting = reducer(initialState('ABC'), { type: 'startRun' });
    expect(reducer(counting, { type: 'simStatus', status: 'paused', skipping: false })).toBe(counting);
    const running = { ...counting, phase: 'running' as const, countdown: 0 };
    expect(reducer(running, { type: 'simStatus', status: 'paused', skipping: false }).phase).toBe('paused');
    expect(reducer(running, { type: 'simStatus', status: 'finished', skipping: false }).phase).toBe('finished');
  });

  it('트랙이 없으면 주행을 시작할 수 없다', () => {
    const empty = reducer(initialState('ABC'), { type: 'generateTrack', seed: '' });
    expect(reducer(empty, { type: 'startRun' })).toBe(empty);
  });
});
