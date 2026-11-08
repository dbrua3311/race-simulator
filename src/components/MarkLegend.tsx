/** 화면 표시 범례 (차 색·테두리·종료 표시·고스트) */
export function MarkLegend({ ghost }: { ghost: boolean }) {
  return (
    <div className="legend" data-testid="legend">
      <span>
        <i className="lg-select" />
        선택
      </span>
      <span>
        <b className="lg-wall">✕</b>벽 충돌
      </span>
      <span>
        <b className="lg-brake">■</b>브레이크 정지
      </span>
      <span>
        <b className="lg-finish">✓</b>완주
      </span>
      <span>
        <b className="lg-safety">○</b>안전 종료
      </span>
      {ghost && (
        <span>
          <i className="lg-ghost" />
          고스트
        </span>
      )}
    </div>
  );
}
