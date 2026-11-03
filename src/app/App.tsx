import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LeftPanel, type RunControls } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { TrackView } from '../components/TrackView';
import type { GaSettings } from '../genetics/params';
import { gridSlots } from '../tracks/startGrid';
import { toRunStats, type RunStats } from './runStats';
import { randomSeed } from './seed';
import { createSimClient, type SimClient, type WorkerStatus } from './simClient';
import { PHASE_LABEL, initialState, reducer, type Speed } from './state';

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(randomSeed()));
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ kind: 'connecting' });
  const [stats, setStats] = useState<RunStats | null>(null);
  const clientRef = useRef<SimClient | null>(null);
  const lastStatsUpdate = useRef(0);

  useEffect(() => {
    const client = createSimClient({
      onWorkerStatus: setWorkerStatus,
      onSnapshot: (snapshot) => {
        dispatch({
          type: 'worker',
          status: snapshot.status,
          generation: snapshot.generation,
          auto: snapshot.auto,
          skipping: snapshot.skipping,
        });
        // 통계 패널은 초당 5번만 다시 그린다 (멈춰 있을 때는 바로)
        const now = performance.now();
        if (snapshot.status === 'running' && now - lastStatsUpdate.current < 200) return;
        lastStatsUpdate.current = now;
        setStats(toRunStats(snapshot));
      },
      onEvaluated: (record, ghost) => dispatch({ type: 'evaluated', record, ghost }),
      onLoaded: (experiment) =>
        dispatch({
          type: 'loaded',
          track: experiment.track,
          settings: experiment.settings,
          generation: experiment.generation,
          history: experiment.history,
          ghosts: experiment.ghosts,
          selection: [],
        }),
      onError: (message) => dispatch({ type: 'message', message }),
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

  // 알림은 몇 초 뒤 사라진다
  useEffect(() => {
    if (!state.message) return;
    const timer = setTimeout(() => dispatch({ type: 'message', message: null }), 4000);
    return () => clearTimeout(timer);
  }, [state.message]);

  const getSnapshot = useCallback(() => clientRef.current?.latest() ?? null, []);

  const slots = useMemo(
    () => (state.track ? gridSlots(state.track, state.settings.populationSize) : []),
    [state.track, state.settings.populationSize],
  );

  const client = () => clientRef.current;
  const hasHistory = state.history.length > 0 || state.generation > 1;
  const confirmLoss = (what: string) =>
    !hasHistory || window.confirm(`${what}하면 지금까지의 진화 기록이 사라집니다. 계속할까요?`);

  const controls: RunControls = {
    start: () => {
      if (state.phase === 'trackSetup' && state.track) {
        dispatch({ type: 'startRun' });
        setStats(null);
        client()?.setSpeed(state.speed);
        client()?.newExperiment(state.track, state.settings, `${state.track.seed}/${state.runNumber}`);
      } else if (state.phase === 'ready') {
        dispatch({ type: 'startCountdown' });
      }
    },
    pause: () => client()?.pause(),
    resume: () => client()?.resume(),
    skip: () => client()?.skip(),
    setSpeed: (speed: Speed) => {
      dispatch({ type: 'setSpeed', speed });
      client()?.setSpeed(speed);
    },
    setSettings: (settings: GaSettings) => {
      dispatch({ type: 'setSettings', settings });
      client()?.updateSettings(settings);
    },
    confirmParents: () => {
      if (state.phase !== 'parentSelection' || state.selection.length < 2) return;
      client()?.confirmParents(state.generation, state.selection);
      dispatch({ type: 'confirmParents' });
    },
    autoSelect: () => {
      if (state.phase !== 'parentSelection') return;
      client()?.autoSelect(state.generation);
      dispatch({ type: 'confirmParents' });
    },
    clearSelection: () => dispatch({ type: 'clearSelection' }),
    startAuto: () => client()?.startAuto(),
    stopAuto: () => client()?.stopAuto(),
    resetLearning: () => {
      if (!state.track || !confirmLoss('학습을 초기화')) return;
      client()?.resetLearning(`${state.track.seed}/${state.runNumber + 1}`);
      dispatch({ type: 'resetLearning' });
      setStats(null);
    },
    newGame: () => {
      if (!confirmLoss('새 판을 시작')) return;
      client()?.reset();
      setStats(null);
      dispatch({ type: 'newGame' });
    },
  };

  const showGeneration = state.phase !== 'trackSetup';
  const runFinished = state.phase === 'parentSelection';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <h1>Race Simulator</h1>
        </div>
        <div className="topbar-status">
          {state.auto && <span className="chip chip-gold">자동 학습 중</span>}
          <span className="chip" data-testid="phase">
            {state.skipping ? '건너뛰는 중…' : PHASE_LABEL[state.phase]}
          </span>
          {state.trackLocked && <span className="chip chip-gold">트랙 고정됨</span>}
          <WorkerBadge status={workerStatus} />
        </div>
      </header>
      {state.message && (
        <div className="toast" role="alert">
          {state.message}
        </div>
      )}
      <main className="layout">
        <LeftPanel state={state} dispatch={dispatch} controls={controls} />
        <TrackView
          track={state.track}
          slots={slots}
          error={state.trackError}
          getSnapshot={getSnapshot}
          generation={showGeneration ? state.generation : null}
          countdown={state.phase === 'countdown' ? state.countdown : 0}
          bestFinish={stats?.bestFinish ?? null}
          runFinished={runFinished && !stats?.bestFinish}
          selecting={state.phase === 'parentSelection'}
          selection={state.selection}
          onToggle={(id) => dispatch({ type: 'toggleSelect', id })}
          onSelectMany={(ids) => dispatch({ type: 'addSelection', ids })}
        />
        <RightPanel generation={showGeneration ? state.generation : null} stats={stats} history={state.history} auto={state.auto} />
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
