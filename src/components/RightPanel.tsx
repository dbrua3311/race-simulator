import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatSimTime } from '../app/format';
import type { RunStats } from '../app/runStats';
import type { GenerationRecord, Ghost } from '../simulation/experiment';
import { GHOST_MODE_LABEL, type GhostMode } from '../visualization/ghost';
import { RENDER_STYLE_LABEL, type RenderStyle } from '../visualization/style';
import { END_REASON_LABEL } from '../simulation/types';
import { MarkLegend } from './MarkLegend';
import { Section } from './Panel';

interface Props {
  generation: number | null;
  stats: RunStats | null;
  history: GenerationRecord[];
  auto: boolean;
  ghost: Ghost | null;
  ghostMode: GhostMode;
  ghostGeneration: number | null;
  /** 고스트를 지금 화면에 그리는 중인가 (부모 선택 중에는 숨김) */
  showGhost: boolean;
  renderStyle: RenderStyle;
  onRenderStyleChange(style: RenderStyle): void;
  onGhostChange(mode: GhostMode, generation: number | null): void;
}

const pct = (v: number | undefined) => (v === undefined ? '-' : `${(v * 100).toFixed(1)}%`);
const diff = (d: number) => `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%p`;

export function RightPanel(props: Props) {
  const { generation, stats, history, auto, ghost, ghostMode, ghostGeneration, showGhost, onGhostChange } = props;
  const [metric, setMetric] = useState<'progress' | 'fitness'>('progress');
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
  const chartData = history.map((r) =>
    metric === 'progress'
      ? { generation: r.generation, best: +(r.bestProgress * 100).toFixed(2), average: +(r.averageProgress * 100).toFixed(2) }
      : { generation: r.generation, best: +r.bestFitness.toFixed(2), average: +r.averageFitness.toFixed(2) },
  );
  const metricName = metric === 'progress' ? '진행률' : '적합도';
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
            실제 진행 배속: ×{stats.actualSpeed.toFixed(1)}
          </p>
        )}
      </Section>

      <Section title="표시">
        <div className="segmented small" role="group" aria-label="화면 스타일">
          {(Object.keys(RENDER_STYLE_LABEL) as RenderStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              aria-pressed={props.renderStyle === style}
              className={props.renderStyle === style ? 'active' : undefined}
              onClick={() => props.onRenderStyleChange(style)}
            >
              {RENDER_STYLE_LABEL[style]}
            </button>
          ))}
        </div>
        <MarkLegend ghost={!!ghost && showGhost} />
      </Section>

      <Section title="세대별 성능">
        <div className="segmented small" role="group" aria-label="그래프 종류">
          {(['progress', 'fitness'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={metric === m} className={metric === m ? 'active' : undefined} onClick={() => setMetric(m)}>
              {m === 'progress' ? '진행률 (%)' : '적합도'}
            </button>
          ))}
        </div>
        <div className="chart" data-testid="chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="generation" stroke="var(--muted)" fontSize={11} />
              <YAxis domain={metric === 'progress' ? [0, 100] : [0, 'auto']} stroke="var(--muted)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }}
                labelFormatter={(g) => `${g}세대`}
                formatter={(v) => (metric === 'progress' ? `${v}%` : String(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="best" name={`최고 ${metricName}`} stroke="var(--gold)" dot={false} isAnimationActive={false} />
              <Line dataKey="average" name={`평균 ${metricName}`} stroke="var(--accent)" dot={false} isAnimationActive={false} />
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
              {last.winner.id}번
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
        <select
          aria-label="고스트 비교 대상"
          value={ghostMode}
          onChange={(e) => {
            const mode = e.target.value as GhostMode;
            onGhostChange(mode, mode === 'generation' ? (ghostGeneration ?? history[0]?.generation ?? null) : ghostGeneration);
          }}
        >
          {(Object.keys(GHOST_MODE_LABEL) as GhostMode[]).map((m) => (
            <option key={m} value={m}>
              {GHOST_MODE_LABEL[m]}
            </option>
          ))}
        </select>
        {ghostMode === 'generation' && history.length > 0 && (
          <select
            aria-label="비교할 세대"
            className="mt"
            value={ghostGeneration ?? ''}
            onChange={(e) => onGhostChange('generation', Number(e.target.value))}
          >
            {history.map((r) => (
              <option key={r.generation} value={r.generation}>
                {r.generation}세대 1등 ({(r.bestProgress * 100).toFixed(1)}%)
              </option>
            ))}
          </select>
        )}
        {ghost ? (
          <dl className="info mt" data-testid="ghost-info">
            <dt>고스트</dt>
            <dd>
              {ghost.generation}세대 1등 {ghost.carId}번
            </dd>
            <dt>그 기록</dt>
            <dd>
              {pct(ghost.progress)}
              {ghost.finishTime !== null ? ` · 완주 ${formatSimTime(ghost.finishTime)}` : ''}
            </dd>
            <dt>지금 세대</dt>
            <dd>
              {stats ? `${pct(stats.bestProgress)} (${diff(stats.bestProgress - ghost.progress)})` : '-'}
            </dd>
          </dl>
        ) : (
          <p className="muted mt">{ghostMode === 'off' ? '고스트를 표시하지 않습니다' : '비교할 이전 세대 기록이 아직 없습니다'}</p>
        )}
        <p className="hint">고스트는 과거 주행 기록을 다시 보여 줄 뿐, 지금 자동차들의 주행·학습에는 영향을 주지 않습니다.</p>
      </Section>
    </aside>
  );
}
