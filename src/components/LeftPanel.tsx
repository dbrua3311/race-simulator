import { Field, Section } from './Panel';

const DIFFICULTIES = ['하', '중', '상'] as const;
const SPEEDS = [1, 2, 5, 10] as const;

// 1단계: 조작부 배치만 있다. 각 버튼은 해당 단계에서 시뮬레이션과 연결한다.
export function LeftPanel() {
  return (
    <aside className="panel panel-left" aria-label="설정 및 조작">
      <p className="notice">화면 뼈대 단계입니다. 버튼은 아직 동작하지 않습니다.</p>

      <Section title="트랙">
        <div className="segmented" role="group" aria-label="난이도">
          {DIFFICULTIES.map((d) => (
            <button key={d} type="button" disabled className={d === '중' ? 'active' : undefined}>
              {d}
            </button>
          ))}
        </div>
        <Field label="시드">
          <div className="row">
            <input type="text" placeholder="시드 입력" disabled />
            <button type="button" disabled>
              복사
            </button>
          </div>
        </Field>
        <button type="button" className="btn-block" disabled>
          트랙 다시 생성
        </button>
      </Section>

      <Section title="진화 설정">
        <Field label="자동차 개체 수" value="50대">
          <input type="range" min={10} max={100} defaultValue={50} disabled />
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
        <div className="grid-2">
          <button type="button" className="btn-primary" disabled>
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
