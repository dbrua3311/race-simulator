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
  /** 종료된 스텝 번호 */
  endTick: number | null;
}
