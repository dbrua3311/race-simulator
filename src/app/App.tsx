import { useEffect, useMemo, useReducer, useState } from 'react';
import { LeftPanel } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { TrackView } from '../components/TrackView';
import { gridSlots } from '../tracks/startGrid';
import { randomSeed } from './seed';
import { connectSimWorker, type WorkerStatus } from './simClient';
import { PHASE_LABEL, initialState, reducer } from './state';

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(randomSeed()));
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ kind: 'connecting' });

  useEffect(() => connectSimWorker(setWorkerStatus), []);

  const slots = useMemo(
    () => (state.track ? gridSlots(state.track, state.populationSize) : []),
    [state.track, state.populationSize],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <h1>Race Simulator</h1>
        </div>
        <div className="topbar-status">
          <span className="chip" data-testid="phase">
            {PHASE_LABEL[state.phase]}
          </span>
          {state.trackLocked && <span className="chip chip-gold">트랙 고정됨</span>}
          <WorkerBadge status={workerStatus} />
        </div>
      </header>
      <main className="layout">
        <LeftPanel state={state} dispatch={dispatch} />
        <TrackView track={state.track} slots={slots} error={state.trackError} />
        <RightPanel />
      </main>
    </div>
  );
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
