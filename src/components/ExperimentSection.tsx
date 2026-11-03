import { useRef } from 'react';
import type { AppState } from '../app/state';
import type { RunControls } from './LeftPanel';
import { Field, Section } from './Panel';

export function ExperimentSection({ state, controls }: { state: AppState; controls: RunControls }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasExperiment = state.phase !== 'trackSetup' && state.phase !== 'countdown';

  return (
    <Section title="실험">
      <Field label="실험 이름">
        <input
          type="text"
          aria-label="실험 이름"
          placeholder={state.track ? `${state.track.seed} 실험` : '실험 이름'}
          value={state.experimentName}
          maxLength={60}
          onChange={(e) => controls.setName(e.target.value)}
        />
      </Field>
      <div className="grid-2">
        <button type="button" disabled={!hasExperiment} onClick={controls.save}>
          실험 저장
        </button>
        <button type="button" disabled={state.phase === 'countdown'} onClick={() => fileRef.current?.click()}>
          실험 불러오기
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        data-testid="load-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) controls.load(file);
        }}
      />
      <div className="grid-2">
        <button type="button" disabled={state.history.length === 0} onClick={controls.exportCsv}>
          통계 CSV
        </button>
        <button type="button" disabled={state.history.length === 0} onClick={controls.exportGenome}>
          최고 유전자 저장
        </button>
      </div>
      <p className="hint">저장하면 트랙·유전자·세대·기록·고스트와 지금 주행 상태가 그대로 담깁니다. 불러오면 그 시점부터 일시정지 상태로 이어집니다.</p>
    </Section>
  );
}
