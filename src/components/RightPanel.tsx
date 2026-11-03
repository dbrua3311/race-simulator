import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { RunStats } from '../app/runStats';
import { Section } from './Panel';

const EMPTY_HISTORY: { generation: number; best: number; average: number }[] = [];

interface Props {
  generation: number | null;
  stats: RunStats | null;
}

export function RightPanel({ generation, stats }: Props) {
  const counts = stats?.counts;
  const count = (v: number | undefined) => (v === undefined ? '-' : `${v}대`);
  const percent = (v: number | undefined) => (v === undefined ? '-' : `${(v * 100).toFixed(1)}%`);
  const rows: [string, string][] = [
    ['현재 세대', generation === null ? '-' : `${generation}세대`],
    ['주행 중', count(counts?.running)],
    ['최고 진행률', percent(stats?.bestProgress)],
    ['평균 진행률', percent(stats?.averageProgress)],
    ['최고 적합도', '-'],
    ['평균 적합도', '-'],
    ['완주', count(counts?.finish)],
    ['벽 충돌', count(counts?.wall)],
    ['브레이크 정지', count(counts?.brake)],
    ['안전 종료', count(counts?.safety)],
  ];

  return (
    <aside className="panel panel-right" aria-label="통계 및 분석">
      <Section title="현재 세대 통계">
        <dl className="stats">
          {rows.map(([label, value]) => (
            <div key={label} className="stat">
              <dt>{label}</dt>
              <dd data-testid={`stat-${label}`}>{value}</dd>
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
