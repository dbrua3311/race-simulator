import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LeftPanel, type RunControls } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { TrackView } from '../components/TrackView';
import type { GaSettings } from '../genetics/params';
import { genomeFile, historyToCsv } from '../persistence/csv';
import { downloadText } from '../persistence/download';
import { createSaveFile, saveFileName } from '../persistence/saveFile';
import { parseSaveFile, SaveFileError } from '../persistence/validate';
import { gridSlots } from '../tracks/startGrid';
import { pickGhost } from '../visualization/ghost';
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
  /** 불러오는 중인 파일의 화면 정보 (워커가 실험을 받아 준 뒤 적용) */
  const pendingLoad = useRef<{ selection: number[]; name: string } | null>(null);

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
      onLoaded: (experiment) => {
        const pending = pendingLoad.current ?? { selection: [], name: '' };
        pendingLoad.current = null;
        dispatch({
          type: 'loaded',
          track: experiment.track,
          settings: experiment.settings,
          generation: experiment.generation,
          history: experiment.history,
          ghosts: experiment.ghosts,
          selection: pending.selection,
          name: pending.name,
        });
      },
      onError: (message) => dispatch({ type: 'message', message: { text: message, kind: 'error' } }),
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
    const timer = setTimeout(() => dispatch({ type: 'message', message: null }), 6000);
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
    setName: (name: string) => dispatch({ type: 'setName', name }),
    save: async () => {
      const c = client();
      if (!c || !state.track) return;
      try {
        const experiment = await c.exportExperiment();
        const now = new Date();
        const name = state.experimentName.trim() || `${experiment.track.seed} 실험`;
        const file = createSaveFile(experiment, name, state.selection, now);
        downloadText(saveFileName(experiment, now), JSON.stringify(file), 'application/json');
        notify(`저장했습니다 — ${file.savedPoint} 시점`, 'info');
      } catch (error) {
        notify(`저장하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    },
    load: async (file: File) => {
      try {
        const save = parseSaveFile(await file.text());
        if (!confirmLoss('다른 실험을 불러오기')) return;
        pendingLoad.current = { selection: save.ui.selection, name: save.name };
        setStats(null);
        client()?.loadExperiment(save.experiment);
        notify(`"${save.name}" 을(를) 불러왔습니다 — ${save.savedPoint} 시점부터 이어집니다`, 'info');
      } catch (error) {
        const reason = error instanceof SaveFileError ? error.message : '파일을 읽지 못했습니다';
        notify(`불러오지 못했습니다: ${reason}. 지금 실험은 그대로입니다`, 'error');
      }
    },
    exportCsv: () => {
      if (!state.history.length || !state.track) return;
      downloadText(`race-${state.track.seed}-세대별-통계.csv`, historyToCsv(state.history), 'text/csv;charset=utf-8');
    },
    exportGenome: () => {
      const best = [...state.history].sort((a, b) => b.winner.fitness - a.winner.fitness)[0];
      if (!best || !state.track) return;
      downloadText(
        `race-${state.track.seed}-최고유전자-${best.generation}세대-${best.winner.id}번.json`,
        JSON.stringify(genomeFile(best), null, 2),
        'application/json',
      );
    },
  };

  function notify(text: string, kind: 'info' | 'error') {
    dispatch({ type: 'message', message: { text, kind } });
  }

  const showGeneration = state.phase !== 'trackSetup';
  // 수동 부모 선택 단계에서는 고스트를 숨긴다 (원문 44절)
  const showGhost = state.phase !== 'parentSelection' && state.phase !== 'trackSetup';
  const ghost = useMemo(
    () => pickGhost(state.ghosts, state.ghostMode, state.generation, state.ghostGeneration),
    [state.ghosts, state.ghostMode, state.generation, state.ghostGeneration],
  );
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
        <div className={`toast toast-${state.message.kind}`} role={state.message.kind === 'error' ? 'alert' : 'status'} data-testid="toast">
          {state.message.text}
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
          ghost={ghost}
          showGhost={showGhost}
          renderStyle={state.renderStyle}
        />
        <RightPanel
          generation={showGeneration ? state.generation : null}
          stats={stats}
          history={state.history}
          auto={state.auto}
          ghost={ghost}
          ghostMode={state.ghostMode}
          ghostGeneration={state.ghostGeneration}
          showGhost={showGhost}
          renderStyle={state.renderStyle}
          onRenderStyleChange={(style) => dispatch({ type: 'setRenderStyle', style })}
          onGhostChange={(mode, generation) => dispatch({ type: 'setGhost', mode, generation })}
        />
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
