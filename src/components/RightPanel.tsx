import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Section } from './Panel';

const STATS = [
  '현재 세대',
  '최고 진행률',
  '평균 진행률',
  '최고 적합도',
  '평균 적합도',
  '완주',
  '벽 충돌',
  '브레이크 정지',
] as const;

const EMPTY_HISTORY: { generation: number; best: number; average: number }[] = [];

export function RightPanel() {
  return (
    <aside className="panel panel-right" aria-label="통계 및 분석">
      <Section title="현재 세대 통계">
        <dl className="stats">
          {STATS.map((label) => (
            <div key={label} className="stat">
              <dt>{label}</dt>
              <dd>-</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="세대별 성능">
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={EMPTY_HISTORY} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="generation" stroke="var(--muted)" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="var(--muted)" fontSize={11} />
              <Line dataKey="best" name="최고 진행률" stroke="var(--gold)" dot={false} />
              <Line dataKey="average" name="평균 진행률" stroke="var(--accent)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="chart-empty">아직 기록이 없습니다</p>
        </div>
      </Section>

      <Section title="최고 자동차">
        <p className="muted">아직 기록이 없습니다</p>
      </Section>

      <Section title="고스트 비교">
        <p className="muted">아직 기록이 없습니다</p>
      </Section>
    </aside>
  );
}
