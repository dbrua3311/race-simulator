/** 물리 시간 간격 (s). 배속과 상관없이 항상 이 간격으로만 계산한다 */
export const DT = 1 / 60;

/** 자동차 제원. 화면에 그리는 차체 크기 = 충돌 판정 크기 */
export const CAR = {
  /** 차체 길이·폭 (m) */
  length: 5,
  width: 2.2,
  /** 앞뒤 바퀴 축 사이 거리 (m) */
  wheelbase: 3,
  /** 최대 조향각 (rad) */
  maxSteer: 0.6,
  /** 조향 속도 (rad/s). 핸들을 순간적으로 꺾지 못하게 한다 */
  steerRate: 2.5,
  /** 최고 속도 (m/s). 배속과 무관한 물리 상수 */
  maxSpeed: 30,
  /** 최대 가속도·제동 감속도 (m/s²) */
  maxAccel: 6,
  maxBrake: 14,
} as const;

/** 공기 저항 계수: 가속 페달을 끝까지 밟으면 최고 속도에서 가속도와 저항이 같아진다 */
export const DRAG = CAR.maxAccel / (CAR.maxSpeed * CAR.maxSpeed);

/** 안전 종료: 한 세대의 최대 시뮬레이션 시간 (s) */
export const MAX_RUN_TIME = 300;

/** 거리 센서: 정면, 왼쪽·오른쪽 45°, 왼쪽·오른쪽 90° (원문 17절) */
export const SENSOR = {
  angles: [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2],
  /** 최대 감지 거리 (m). 최고 속도에서 정지하는 거리(약 32 m)보다 넉넉하게 */
  range: 80,
} as const;

/** 이 속도를 한 번이라도 넘어야 "출발했다"고 본다 (출발 직후 정지는 브레이크 종료가 아님) */
export const MOVE_SPEED = 0.5;
/** 제동 중 이 속도 이하면 브레이크로 완전히 정지한 것으로 본다 (부동소수점 여유) */
export const BRAKE_STOP_SPEED = 0.05;
/** 안전 종료: 이 시간 동안 유효 진행이 PROGRESS_STEP 미만이면 진행 없음으로 종료 */
export const NO_PROGRESS_TIME = 5;
export const PROGRESS_STEP = 1;
