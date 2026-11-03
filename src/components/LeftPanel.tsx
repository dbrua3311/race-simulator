import type { Dispatch } from 'react';
import { SPEEDS, type Action, type AppState, type Speed } from '../app/state';
import { BRAIN_LABEL, MIN_PARENTS, POPULATION_RANGE, type Brain, type GaSettings } from '../genetics/params';
import { ExperimentSection } from './ExperimentSection';
import { Field, Section } from './Panel';
import { TrackSection } from './TrackSection';

export interface RunControls {
  start(): void;
  pause(): void;
  resume(): void;
  skip(): void;
  setSpeed(speed: Speed): void;
  setSettings(settings: GaSettings): void;
  confirmParents(): void;
  autoSelect(): void;
  clearSelection(): void;
  startAuto(): void;
  stopAuto(): void;
  resetLearning(): void;
  newGame(): void;
  setName(name: string): void;
  save(): void;
  load(file: File): void;
  exportCsv(): void;
  exportGenome(): void;
}

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  controls: RunControls;
}

export function LeftPanel({ state, dispatch, controls }: Props) {
  const { phase, auto, settings } = state;
  const set = (patch: Partial<GaSettings>) => controls.setSettings({ ...settings, ...patch });
  const canStart = (phase === 'trackSetup' && !!state.track) || (phase === 'ready' && !auto);

  return (
    <aside className="panel panel-left" aria-label="설정 및 조작">
      <TrackSection key={state.seed} state={state} dispatch={dispatch} onNewGame={controls.newGame} />

      {phase === 'parentSelection' && !auto && (
        <Section title="부모 선택">
          <p className="notice">
            트랙 위 자동차를 클릭하거나 드래그해서 다음 세대의 부모를 고르세요 ({MIN_PARENTS}대 이상). 1대만 고르면
            모두가 그 차를 조금씩 다르게 따라 하고, 여러 대면 섞기도 합니다. 1등은 금색 챔피언으로 따로 보존됩니다.
          </p>
          <p className="selection-count" data-testid="selection-count">
            선택 {state.selection.length}대
          </p>
          <div className="grid-2">
            <button type="button" disabled={state.selection.length === 0} onClick={controls.clearSelection}>
              선택 초기화
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={state.selection.length < MIN_PARENTS}
              onClick={controls.confirmParents}
            >
              결정완료
            </button>
          </div>
          <button type="button" className="btn-block" onClick={controls.autoSelect}>
            자동으로 부모 고르기
          </button>
        </Section>
      )}

      <Section title="진화 설정">
        <Field label="운전 방식">
          <select
            aria-label="운전 방식"
            value={settings.brain}
            disabled={auto || phase === 'countdown'}
            onChange={(e) => set({ brain: e.target.value as Brain })}
          >
            {(Object.keys(BRAIN_LABEL) as Brain[]).map((b) => (
              <option key={b} value={b}>
                {BRAIN_LABEL[b]}
              </option>
            ))}
          </select>
        </Field>
        {phase !== 'trackSetup' && (
          <p className="hint">운전 방식은 새 판 시작이나 학습 초기화 때 적용됩니다.</p>
        )}
        <Field label="자동차 개체 수" value={`${settings.populationSize}대`}>
          <input
            type="range"
            aria-label="자동차 개체 수"
            min={POPULATION_RANGE[0]}
            max={POPULATION_RANGE[1]}
            step={5}
            value={settings.populationSize}
            disabled={auto}
            onChange={(e) => set({ populationSize: Number(e.target.value) })}
          />
        </Field>
        <Field label="진화 방식">
          <select
            aria-label="진화 방식"
            value={settings.selectionMode}
            disabled={auto}
            onChange={(e) => set({ selectionMode: e.target.value as GaSettings['selectionMode'] })}
          >
            <option value="manual">수동 (부모 직접 선택)</option>
            <option value="auto">자동 (상위 개체 자동 선택)</option>
          </select>
        </Field>
        <Field label="교차 확률" value={`${Math.round(settings.crossoverRate * 100)}%`}>
          <input
            type="range"
            aria-label="교차 확률"
            min={0}
            max={100}
            value={Math.round(settings.crossoverRate * 100)}
            onChange={(e) => set({ crossoverRate: Number(e.target.value) / 100 })}
          />
        </Field>
        <Field label="돌연변이 확률" value={`${Math.round(settings.mutationRate * 100)}%`}>
          <input
            type="range"
            aria-label="돌연변이 확률"
            min={0}
            max={100}
            value={Math.round(settings.mutationRate * 100)}
            onChange={(e) => set({ mutationRate: Number(e.target.value) / 100 })}
          />
        </Field>
        {phase !== 'trackSetup' && <p className="hint">설정은 다음 세대를 만들 때 적용됩니다.</p>}
      </Section>

      <Section title="주행">
        <div className="grid-2">
          <button type="button" className="btn-primary" disabled={!canStart} onClick={controls.start}>
            주행 시작
          </button>
          <button type="button" disabled={phase !== 'running' || state.skipping || auto} onClick={controls.pause}>
            일시정지
          </button>
          <button type="button" disabled={phase !== 'paused' || auto} onClick={controls.resume}>
            주행 재개
          </button>
          <button
            type="button"
            disabled={(phase !== 'running' && phase !== 'paused') || state.skipping || auto}
            onClick={controls.skip}
          >
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
        {auto ? (
          <button type="button" className="btn-block btn-stop" onClick={controls.stopAuto}>
            자동 학습 정지
          </button>
        ) : (
          <button
            type="button"
            className="btn-block btn-accent"
            disabled={phase === 'trackSetup' || phase === 'countdown'}
            onClick={controls.startAuto}
          >
            자동 학습 시작
          </button>
        )}
        <p className="hint">
          {phase === 'trackSetup'
            ? '주행을 한 번 시작한 뒤 사용할 수 있습니다.'
            : '출발부터 평가·부모 선택·교차·돌연변이·다음 세대까지 정지할 때까지 자동으로 반복합니다.'}
        </p>
        <button
          type="button"
          className="btn-block"
          disabled={phase === 'trackSetup' || phase === 'countdown' || auto}
          onClick={controls.resetLearning}
        >
          학습 초기화 (트랙 유지)
        </button>
      </Section>

      <ExperimentSection state={state} controls={controls} />
    </aside>
  );
}
