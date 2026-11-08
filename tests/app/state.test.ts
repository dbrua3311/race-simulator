import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState } from '../../src/app/state';

const worker = (status: 'ready' | 'running' | 'paused' | 'evaluated', generation = 1, auto = false) =>
  ({ type: 'worker', status, generation, auto, skipping: false }) as const;

function running(): AppState {
  let s = reducer(initialState('ABC'), { type: 'startRun' });
  for (let i = 0; i < 3; i++) s = reducer(s, { type: 'countdownTick' });
  return reducer(s, worker('running'));
}

describe('화면 상태 — 트랙 생성과 고정', () => {
  it('처음에는 주어진 시드로 트랙을 만들고, 기본 개체 수는 20대', () => {
    const s = initialState('ABC', 'easy');
    expect(s.track?.seed).toBe('ABC');
    expect(s.track?.difficulty).toBe('easy');
    expect(s.trackLocked).toBe(false);
    expect(s.settings.populationSize).toBe(20);
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

  it('새 판을 시작하면 고정이 풀리고 기록이 지워지며 트랙은 남아 있다', () => {
    const s = reducer(running(), { type: 'newGame' });
    expect(s.trackLocked).toBe(false);
    expect(s.phase).toBe('trackSetup');
    expect(s.history).toEqual([]);
    expect(s.track?.seed).toBe('ABC');
  });

  it('트랙이 없으면 주행을 시작할 수 없다', () => {
    const empty = reducer(initialState('ABC'), { type: 'generateTrack', seed: '' });
    expect(reducer(empty, { type: 'startRun' })).toBe(empty);
  });
});

describe('화면 상태 — 주행과 세대', () => {
  it('카운트다운 3초가 끝나면 주행 중이 된다', () => {
    let s = reducer(initialState('ABC'), { type: 'startRun' });
    expect(s.countdown).toBe(3);
    s = reducer(s, { type: 'countdownTick' });
    s = reducer(s, { type: 'countdownTick' });
    expect(s.phase).toBe('countdown');
    s = reducer(s, { type: 'countdownTick' });
    expect(s.phase).toBe('running');
  });

  it('카운트다운 중에는 출발 전 상태를 무시한다', () => {
    const counting = reducer(initialState('ABC'), { type: 'startRun' });
    expect(reducer(counting, worker('ready')).phase).toBe('countdown');
  });

  it('워커 상태를 따른다: 일시정지, 평가 완료 → 부모 선택', () => {
    const s = running();
    expect(reducer(s, worker('paused')).phase).toBe('paused');
    expect(reducer(s, worker('evaluated')).phase).toBe('parentSelection');
  });

  it('부모 선택: 클릭 토글, 드래그 추가(중복 없음), 초기화', () => {
    let s = reducer(running(), worker('evaluated'));
    s = reducer(s, { type: 'toggleSelect', id: 3 });
    s = reducer(s, { type: 'toggleSelect', id: 5 });
    s = reducer(s, { type: 'toggleSelect', id: 3 });
    expect(s.selection).toEqual([5]);
    s = reducer(s, { type: 'addSelection', ids: [5, 6, 7] });
    expect(s.selection).toEqual([5, 6, 7]);
    expect(reducer(s, { type: 'clearSelection' }).selection).toEqual([]);
  });

  it('주행 중에는 부모를 고를 수 없다', () => {
    const s = running();
    expect(reducer(s, { type: 'toggleSelect', id: 3 })).toBe(s);
  });

  it('결정완료 → 카운트다운, 다음 세대가 오면 선택이 비워진다', () => {
    let s = reducer(running(), worker('evaluated'));
    s = reducer(s, { type: 'addSelection', ids: [1, 2] });
    s = reducer(s, { type: 'confirmParents' });
    expect(s.phase).toBe('countdown');
    expect(s.selection).toEqual([]);
    // 결정완료 직후 도착한 이전 평가 상태는 무시
    expect(reducer(s, worker('evaluated')).phase).toBe('countdown');
    s = reducer(s, worker('ready', 2));
    expect(s.generation).toBe(2);
    expect(s.phase).toBe('countdown');
  });

  it('자동 학습 여부는 화면 단계와 따로 관리한다', () => {
    const s = reducer(running(), worker('running', 4, true));
    expect(s.auto).toBe(true);
    expect(s.phase).toBe('running');
    const stopped = reducer(s, worker('paused', 4, false));
    expect(stopped.auto).toBe(false);
    expect(stopped.phase).toBe('paused');
    expect(stopped.generation).toBe(4);
  });
});
