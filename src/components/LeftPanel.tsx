import type { Dispatch } from 'react';
import type { Action, AppState } from '../app/state';
import { Field, Section } from './Panel';
import { TrackSection } from './TrackSection';

const SPEEDS = [1, 2, 5, 10] as const;

// 트랙 영역만 동작한다. 나머지 조작부는 해당 단계에서 시뮬레이션과 연결한다.
export function LeftPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  return (
    <aside className="panel panel-left" aria-label="설정 및 조작">
      <TrackSection key={state.seed} state={state} dispatch={dispatch} />

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
        {state.phase === 'ready' && <p className="notice">자동차 주행은 다음 단계(3단계)에서 연결됩니다.</p>}
        <div className="grid-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!state.track || state.trackLocked}
            onClick={() => dispatch({ type: 'startRun' })}
          >
            주행 시작
          </button>
          <button type="button" disabled>
            일시정지
          </button>
          <button type="button" disabled>
            주행 재개
          </button>
          <button type="button" disabled>
            건너뛰기
          </button>
        </div>
        <Field label="배속">
          <div className="segmented" role="group" aria-label="배속">
            {SPEEDS.map((s) => (
              <button key={s} type="button" disabled className={s === 1 ? 'active' : undefined}>
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
