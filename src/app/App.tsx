import { useEffect, useState } from 'react';
import { LeftPanel } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { TrackView } from '../components/TrackView';
import { connectSimWorker, type WorkerStatus } from './simClient';

export function App() {
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ kind: 'connecting' });

  useEffect(() => connectSimWorker(setWorkerStatus), []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <h1>Race Simulator</h1>
        </div>
        <div className="topbar-status">
          <span className="chip">트랙 선택</span>
          <WorkerBadge status={workerStatus} />
        </div>
      </header>
      <main className="layout">
        <LeftPanel />
        <TrackView />
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
