import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatSimTime } from '../app/format';
import type { RunStats } from '../app/runStats';
import type { GenerationRecord } from '../simulation/experiment';
import { END_REASON_LABEL } from '../simulation/types';
import { Section } from './Panel';

interface Props {
  generation: number | null;
  stats: RunStats | null;
  history: GenerationRecord[];
  auto: boolean;
}

const pct = (v: number | undefined) => (v === undefined ? '-' : `${(v * 100).toFixed(1)}%`);

export function RightPanel({ generation, stats, history, auto }: Props) {
  const counts = stats?.counts;
  const count = (v: number | undefined) => (v === undefined ? '-' : `${v}대`);
  const rows: [string, string][] = [
    ['현재 세대', generation === null ? '-' : `${generation}세대`],
    ['주행 중', count(counts?.running)],
    ['최고 진행률', pct(stats?.bestProgress)],
    ['평균 진행률', pct(stats?.averageProgress)],
    ['최고 적합도', stats ? stats.bestFitness.toFixed(1) : '-'],
    ['평균 적합도', stats ? stats.averageFitness.toFixed(1) : '-'],
    ['완주', count(counts?.finish)],
    ['벽 충돌', count(counts?.wall)],
    ['브레이크 정지', count(counts?.brake)],
    ['안전 종료', count(counts?.safety)],
  ];
  const chartData = history.map((r) => ({
    generation: r.generation,
    best: +(r.bestProgress * 100).toFixed(2),
    average: +(r.averageProgress * 100).toFixed(2),
  }));
  const last = history.at(-1);

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
        {auto && stats && (
          <p className="hint" data-testid="actual-speed">
            자동 학습 계산 속도: 실시간의 약 {Math.round(stats.actualSpeed)}배
          </p>
        )}
      </Section>

      <Section title="세대별 성능 (진행률 %)">
        <div className="chart" data-testid="chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="generation" stroke="var(--muted)" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="var(--muted)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }}
                labelFormatter={(g) => `${g}세대`}
                formatter={(v) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="best" name="최고 진행률" stroke="var(--gold)" dot={false} isAnimationActive={false} />
              <Line dataKey="average" name="평균 진행률" stroke="var(--accent)" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          {chartData.length === 0 && <p className="chart-empty">아직 기록이 없습니다</p>}
        </div>
      </Section>

      <Section title="최고 자동차">
        {last ? (
          <dl className="info" data-testid="best-car">
            <dt>세대</dt>
            <dd>{last.generation}세대 1등</dd>
            <dt>번호</dt>
            <dd>
              {last.winner.id}번{last.winner.champion ? ' (금색 챔피언)' : ''}
            </dd>
            <dt>진행률</dt>
            <dd>{pct(last.winner.progress)}</dd>
            <dt>적합도</dt>
            <dd>{last.winner.fitness.toFixed(1)}</dd>
            <dt>종료</dt>
            <dd>
              {last.winner.finishTime !== null
                ? `완주 ${formatSimTime(last.winner.finishTime)}`
                : last.winner.endReason
                  ? END_REASON_LABEL[last.winner.endReason]
                  : '-'}
            </dd>
          </dl>
        ) : (
          <p className="muted">아직 기록이 없습니다</p>
        )}
      </Section>

      <Section title="고스트 비교">
        <p className="muted">아직 기록이 없습니다</p>
      </Section>
    </aside>
  );
}
