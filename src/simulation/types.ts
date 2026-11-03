/**
 * 종료 사유.
 * 정상 종료(원문 15절): wall 벽 충돌, brake 브레이크 정지, finish 완주.
 * 안전 종료(원문 16절, 정상 종료와 구분해 기록): timeLimit 시간 제한, noProgress 진행 없음, numeric 수치 오류.
 */
export type EndReason = 'wall' | 'brake' | 'finish' | 'timeLimit' | 'noProgress' | 'numeric';

export const NORMAL_END_REASONS: readonly EndReason[] = ['wall', 'brake', 'finish'];

export const END_REASON_LABEL: Record<EndReason, string> = {
  wall: '벽 충돌',
  brake: '브레이크 정지',
  finish: '완주',
  timeLimit: '안전 종료 (시간 제한)',
  noProgress: '안전 종료 (진행 없음)',
  numeric: '안전 종료 (수치 오류)',
};

/** 신경망(또는 임시 조종기)이 매 스텝 내리는 명령 */
export interface Control {
  /** -1(오른쪽 끝) ~ 1(왼쪽 끝) */
  steer: number;
  /** -1(최대 제동) ~ 1(최대 가속) */
  throttle: number;
}

/** 자동차 한 대의 물리 상태. JSON 으로 그대로 저장할 수 있다 */
export interface CarState {
  /** 화면에 표시하는 번호 (1부터) */
  id: number;
  /** 출발 그리드 자리 번호 */
  slot: number;
  /** 직전 세대 1등의 유전자를 그대로 물려받은 금색 챔피언인가 (세대마다 최대 1대) */
  champion: boolean;
  /** 차체 중심 위치 (m) */
  x: number;
  y: number;
  /** 진행 방향 (rad, x 축 기준 반시계) */
  heading: number;
  /** 속력 (m/s, 후진 없음) */
  speed: number;
  /** 현재 조향각 (rad, 양수 = 왼쪽) */
  steer: number;
  /** 마지막 가속/제동 명령 */
  throttle: number;
  /** 가장 가까운 중심선 점 인덱스. 매 스텝 주변에서만 다시 찾는다 */
  trackIndex: number;
  ended: boolean;
  endReason: EndReason | null;
  /** 종료된 스텝 번호. 완주한 차는 완주 시간 = endTick × DT */
  endTick: number | null;

  // ── 진행률 (progress.ts) ──
  /** 출발 위치의 트랙 좌표 (출발선 = 0, 그리드는 음수) */
  startS: number;
  /** 완주까지 달려야 하는 거리 (m) = 한 바퀴 + 도착 구간 거리. 같은 세대의 모든 차가 같다 */
  goal: number;
  /** 지금 트랙 좌표 (언랩, 바퀴를 넘어가도 이어짐) */
  s: number;
  /** 지금까지의 유효 진행 거리 (m, 출발 위치 기준) */
  bestDistance: number;
  /** bestDistance 를 마지막으로 늘린 스텝 (동률일 때 먼저 도달한 차 우선) */
  bestTick: number;
  /** 다음에 지나야 할 체크포인트 순번 */
  nextGate: number;

  // ── 종료 판정 보조 ──
  /** 한 번이라도 MOVE_SPEED 를 넘었는가 */
  hasMoved: boolean;
  /** 진행 없음 판정용: 마지막으로 PROGRESS_STEP 이상 진행한 거리와 스텝 */
  progressMark: number;
  progressMarkTick: number;
}
