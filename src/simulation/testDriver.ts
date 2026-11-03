// 3단계 전용 임시 조종기: 물리·충돌을 눈으로 확인하기 위한 것이다.
// 4단계에서 거리 센서 + 신경망으로 바꾼다. 센서를 쓰지 않으므로 트랙을 "보고" 운전하지 못한다.

import { uniform, type RngState } from '../core/rng';
import type { Control } from './types';

export interface TestDriver {
  steerBias: number;
  steerAmplitude: number;
  /** 조향 흔들림 주기 (rad/s) */
  steerFrequency: number;
  steerPhase: number;
  throttle: number;
}

export function randomTestDriver(rng: RngState): TestDriver {
  return {
    steerBias: uniform(rng, -0.12, 0.12),
    steerAmplitude: uniform(rng, 0, 0.5),
    steerFrequency: uniform(rng, 0.3, 1.5),
    steerPhase: uniform(rng, 0, 2 * Math.PI),
    throttle: uniform(rng, 0.25, 1),
  };
}

export function testDriverControl(driver: TestDriver, time: number): Control {
  return {
    steer: driver.steerBias + driver.steerAmplitude * Math.sin(driver.steerFrequency * time + driver.steerPhase),
    throttle: driver.throttle,
  };
}
