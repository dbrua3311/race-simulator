import { useEffect, useState, type Dispatch } from 'react';
import { MAX_SEED_LENGTH, normalizeSeed, randomSeed } from '../app/seed';
import type { Action, AppState } from '../app/state';
import { DIFFICULTY_LABEL, type Difficulty } from '../tracks/types';
import { Field, Section } from './Panel';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** 시드가 바뀌면 입력칸을 새로 맞추도록 부모에서 key={seed} 로 렌더한다 */
interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onNewGame(): void;
}

export function TrackSection({ state, dispatch, onNewGame }: Props) {
  const locked = state.trackLocked;
  const [draft, setDraft] = useState(state.seed);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!copyMessage) return;
    const timer = setTimeout(() => setCopyMessage(null), 1500);
    return () => clearTimeout(timer);
  }, [copyMessage]);

  const generateFromDraft = () => dispatch({ type: 'generateTrack', seed: normalizeSeed(draft) });

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(state.seed);
      setCopyMessage('복사됨');
    } catch {
      setCopyMessage('복사하지 못했습니다');
    }
  };

  const m = state.trackMetrics;

  return (
    <Section title="트랙">
      <div className="segmented" role="group" aria-label="난이도">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            disabled={locked}
            aria-pressed={state.difficulty === d}
            className={state.difficulty === d ? 'active' : undefined}
            onClick={() => dispatch({ type: 'setDifficulty', difficulty: d })}
          >
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>

      <Field label="시드">
        <div className="row">
          <input
            type="text"
            aria-label="시드"
            value={draft}
            maxLength={MAX_SEED_LENGTH}
            disabled={locked}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generateFromDraft()}
          />
          <button type="button" onClick={copySeed} disabled={!state.seed}>
            {copyMessage ?? '복사'}
          </button>
        </div>
      </Field>
      <div className="grid-2">
        <button type="button" disabled={locked || normalizeSeed(draft) === state.seed} onClick={generateFromDraft}>
          시드로 생성
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => dispatch({ type: 'generateTrack', seed: randomSeed() })}
        >
          트랙 다시 생성
        </button>
      </div>

      {m && (
        <p className="track-info">
          길이 {Math.round(m.length).toLocaleString('ko-KR')} m · 급커브 {m.sharpTurns}곳 · 체크포인트{' '}
          {(state.track?.checkpoints.length ?? 0) + 1}개
        </p>
      )}
      {state.trackError && (
        <p className="error" role="alert">
          {state.trackError}
        </p>
      )}

      {locked && (
        <>
          <p className="notice">
            트랙이 고정되었습니다. 다른 트랙에서 실험하려면 새 판을 시작하세요.
          </p>
          <button type="button" className="btn-block" onClick={onNewGame}>
            새 판 시작
          </button>
        </>
      )}
    </Section>
  );
}
