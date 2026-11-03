// 운동학 자전거 모델 (차체 중심 기준, 앞뒤 축이 중심에서 같은 거리).
// 위치·방향·속력·조향각만으로 움직이며, 타이어 미끄러짐은 다루지 않는다.

import { CAR, DRAG } from './params';
import type { CarState, Control } from './types';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** car 를 dt 초 진행시킨다 (제자리에서 바꾼다) */
export function stepPhysics(car: CarState, control: Control, dt: number) {
  const steerCmd = clamp(control.steer, -1, 1);
  const throttle = clamp(control.throttle, -1, 1);

  // 조향: 목표 각도 쪽으로 steerRate 만큼만 움직인다
  const target = steerCmd * CAR.maxSteer;
  const maxDelta = CAR.steerRate * dt;
  car.steer += clamp(target - car.steer, -maxDelta, maxDelta);

  // 속력: 가속 또는 제동, 공기 저항. 후진하지 않는다
  const accel = throttle >= 0 ? throttle * CAR.maxAccel : throttle * CAR.maxBrake;
  car.speed = clamp(car.speed + (accel - DRAG * car.speed * car.speed) * dt, 0, CAR.maxSpeed);
  car.throttle = throttle;

  // 자전거 모델: 미끄럼각 β 방향으로 이동, 방향은 v/lr·sinβ 로 회전
  const lr = CAR.wheelbase / 2;
  const beta = Math.atan(0.5 * Math.tan(car.steer));
  car.x += car.speed * Math.cos(car.heading + beta) * dt;
  car.y += car.speed * Math.sin(car.heading + beta) * dt;
  car.heading += (car.speed / lr) * Math.sin(beta) * dt;
}
