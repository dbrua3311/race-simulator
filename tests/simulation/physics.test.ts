import { describe, expect, it } from 'vitest';
import { CAR, DT } from '../../src/simulation/params';
import { stepPhysics } from '../../src/simulation/physics';
import { blankCar as car } from './helpers';

describe('자동차 물리', () => {
  it('가속하면 최고 속도에 가까워지지만 넘지 않는다', () => {
    const c = car();
    for (let i = 0; i < 60 * 60; i++) {
      stepPhysics(c, { steer: 0, throttle: 1 }, DT);
      expect(c.speed).toBeLessThanOrEqual(CAR.maxSpeed);
    }
    expect(c.speed).toBeGreaterThan(CAR.maxSpeed * 0.95);
    expect(c.y).toBeCloseTo(0, 9);
  });

  it('제동하면 속도가 0 에서 멈추고 뒤로 가지 않는다', () => {
    const c = { ...car(), speed: 20 };
    for (let i = 0; i < 300; i++) stepPhysics(c, { steer: 0, throttle: -1 }, DT);
    expect(c.speed).toBe(0);
    const x = c.x;
    stepPhysics(c, { steer: 0, throttle: -1 }, DT);
    expect(c.x).toBe(x);
  });

  it('조향은 한 스텝에 steerRate × DT 까지만 움직이고, 양수면 왼쪽으로 돈다', () => {
    const c = { ...car(), speed: 10 };
    stepPhysics(c, { steer: 1, throttle: 0 }, DT);
    expect(c.steer).toBeCloseTo(CAR.steerRate * DT, 12);
    for (let i = 0; i < 60; i++) stepPhysics(c, { steer: 1, throttle: 0 }, DT);
    expect(c.steer).toBeCloseTo(CAR.maxSteer, 12);
    expect(c.heading).toBeGreaterThan(0);
  });

  it('명령 범위를 벗어나면 잘라낸다', () => {
    const a = car();
    const b = car();
    for (let i = 0; i < 100; i++) {
      stepPhysics(a, { steer: 5, throttle: 9 }, DT);
      stepPhysics(b, { steer: 1, throttle: 1 }, DT);
    }
    expect(a).toEqual(b);
  });
});
