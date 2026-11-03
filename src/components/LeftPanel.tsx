import type { Dispatch } from 'react';
import { SPEEDS, type Action, type AppState, type Speed } from '../app/state';
import { Field, Section } from './Panel';
import { TrackSection } from './TrackSection';

export interface RunControls {
  start(): void;
  pause(): void;
  resume(): void;
  skip(): void;
  setSpeed(speed: Speed): void;
  newGame(): void;
}

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  controls: RunControls;
}

// 트랙·주행 영역이 동작한다. 진화·자동 학습·실험 저장은 해당 단계에서 연결한다.
export function LeftPanel({ state, dispatch, controls }: Props) {
  const { phase } = state;
  const active = phase === 'running' || phase === 'paused';

  return (
    <aside className="panel panel-left" aria-label="설정 및 조작">
      <TrackSection key={state.seed} state={state} dispatch={dispatch} onNewGame={controls.newGame} />

      <Section title="진화 설정">
        <Field label="자동차 개체 수" value={`${state.populationSize}대`}>
          <input type="range" min={10} max={100} value={state.populationSize} disabled readOnly />
        </Field>
        <Field label="진화 방식">
          <select disabled defaultValue="manual">
            <option value="manual">수동 (부모 직접 선택)</option>
            <option value="auto">자동</option>
          </select>
        </Field>
        <Field label="교차 확률" value="80%">
          <input type="range" min={0} max={100} defaultValue={80} disabled />
        </Field>
        <Field label="돌연변이 확률" value="15%">
          <input type="range" min={0} max={100} defaultValue={15} disabled />
        </Field>
      </Section>

      <Section title="주행">
        <p className="notice">
          지금은 물리 확인용 임시 조종으로 달립니다. 센서와 신경망 운전은 4단계에서 연결됩니다.
        </p>
        {phase === 'finished' && (
          <p className="notice">모든 자동차가 주행을 마쳤습니다. 다음 세대 생성은 5단계에서 연결됩니다.</p>
        )}
        <div className="grid-2">
          <button type="button" className="btn-primary" disabled={!state.track || phase !== 'trackSetup'} onClick={controls.start}>
            주행 시작
          </button>
          <button type="button" disabled={phase !== 'running' || state.skipping} onClick={controls.pause}>
            일시정지
          </button>
          <button type="button" disabled={phase !== 'paused'} onClick={controls.resume}>
            주행 재개
          </button>
          <button type="button" disabled={!active || state.skipping} onClick={controls.skip}>
            건너뛰기
          </button>
        </div>
        <Field label="배속">
          <div className="segmented" role="group" aria-label="배속">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={state.speed === s}
                className={state.speed === s ? 'active' : undefined}
                onClick={() => controls.setSpeed(s)}
              >
                {s}배속
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="자동 학습">
        <button type="button" className="btn-block btn-accent" disabled>
          자동 학습 시작
        </button>
      </Section>

      <Section title="실험">
        <div className="grid-2">
          <button type="button" disabled>
            실험 저장
          </button>
          <button type="button" disabled>
            실험 불러오기
          </button>
        </div>
        <button type="button" className="btn-block" disabled>
          통계 CSV 내보내기
        </button>
      </Section>
    </aside>
  );
}
