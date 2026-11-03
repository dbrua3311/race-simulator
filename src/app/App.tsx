import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LeftPanel, type RunControls } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { TrackView } from '../components/TrackView';
import { gridSlots } from '../tracks/startGrid';
import type { CarCounts } from '../workers/protocol';
import { randomSeed } from './seed';
import { createSimClient, type SimClient, type WorkerStatus } from './simClient';
import { PHASE_LABEL, initialState, reducer, type Speed } from './state';

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(randomSeed()));
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ kind: 'connecting' });
  const [counts, setCounts] = useState<CarCounts | null>(null);
  const clientRef = useRef<SimClient | null>(null);

  useEffect(() => {
    const client = createSimClient({
      onWorkerStatus: setWorkerStatus,
      onSnapshot: (snapshot) => {
        if (snapshot.status === 'running' || snapshot.status === 'paused' || snapshot.status === 'finished') {
          dispatch({ type: 'simStatus', status: snapshot.status, skipping: snapshot.skipping });
        }
        setCounts((prev) => (prev && sameCounts(prev, snapshot.counts) ? prev : snapshot.counts));
      },
    });
    clientRef.current = client;
    return () => client.dispose();
  }, []);

  // 카운트다운이 끝나는 순간 모든 차를 동시에 출발시킨다
  useEffect(() => {
    if (state.phase !== 'countdown') return;
    const timer = setTimeout(() => {
      if (state.countdown <= 1) clientRef.current?.go();
      dispatch({ type: 'countdownTick' });
    }, 1000);
    return () => clearTimeout(timer);
  }, [state.phase, state.countdown]);

  const getSnapshot = useCallback(() => clientRef.current?.latest() ?? null, []);

  const slots = useMemo(
    () => (state.track ? gridSlots(state.track, state.populationSize) : []),
    [state.track, state.populationSize],
  );

  const controls: RunControls = {
    start: () => {
      if (!state.track || state.phase !== 'trackSetup') return;
      dispatch({ type: 'startRun' });
      setCounts(null);
      clientRef.current?.setSpeed(state.speed);
      clientRef.current?.prepare(state.track, state.populationSize, `${state.track.seed}/1`);
    },
    pause: () => clientRef.current?.pause(),
    resume: () => clientRef.current?.resume(),
    skip: () => clientRef.current?.skip(),
    setSpeed: (speed: Speed) => {
      dispatch({ type: 'setSpeed', speed });
      clientRef.current?.setSpeed(speed);
    },
    newGame: () => {
      clientRef.current?.reset();
      setCounts(null);
      dispatch({ type: 'newGame' });
    },
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <h1>Race Simulator</h1>
        </div>
        <div className="topbar-status">
          <span className="chip" data-testid="phase">
            {state.skipping ? '건너뛰는 중…' : PHASE_LABEL[state.phase]}
          </span>
          {state.trackLocked && <span className="chip chip-gold">트랙 고정됨</span>}
          <WorkerBadge status={workerStatus} />
        </div>
      </header>
      <main className="layout">
        <LeftPanel state={state} dispatch={dispatch} controls={controls} />
        <TrackView
          track={state.track}
          slots={slots}
          error={state.trackError}
          getSnapshot={getSnapshot}
          generation={state.phase === 'trackSetup' ? null : 1}
          countdown={state.phase === 'countdown' ? state.countdown : 0}
        />
        <RightPanel generation={state.phase === 'trackSetup' ? null : 1} counts={counts} />
      </main>
    </div>
  );
}

function sameCounts(a: CarCounts, b: CarCounts) {
  return a.running === b.running && a.wall === b.wall && a.brake === b.brake && a.finish === b.finish && a.safety === b.safety;
}

function WorkerBadge({ status }: { status: WorkerStatus }) {
  switch (status.kind) {
    case 'connecting':
      return <span className="chip">시뮬레이션 엔진 연결 중…</span>;
    case 'connected':
      return (
        <span className="chip chip-ok" title={`응답 시간 ${status.roundTripMs.toFixed(1)} ms`}>
          시뮬레이션 엔진 연결됨
        </span>
      );
    case 'unavailable':
      return (
        <span className="chip chip-error" title={status.reason}>
          시뮬레이션 엔진 사용 불가
        </span>
      );
  }
}
