// 워커 안의 주행 루프. 시계·타이머를 주입받아 브라우저 없이도 테스트할 수 있다.
//
// - 물리는 항상 고정 DT 스텝(stepWorld)으로만 진행한다. 배속은 실제 1초에 계산하는 스텝 수만 바꾼다.
// - 한 번에 BUDGET_MS 만큼만 계산하고 양보하므로, 계산 중에도 일시정지·정지 명령이 바로 처리된다.
// - 화면 갱신(스냅샷)은 약 60 Hz. 건너뛰기 중에도 진행 상황을 계속 보낸다.

import { DT } from '../simulation/params';
import { advance, createWorldFromSeed, type World } from '../simulation/world';
import type { Track } from '../tracks/types';
import {
  CAR_STRIDE,
  END_CODES,
  PROTOCOL_VERSION,
  type CarCounts,
  type SimStatus,
  type Snapshot,
  type WorkerCommand,
  type WorkerEvent,
} from './protocol';

const BUDGET_MS = 10;
const FRAME_MS = 16;
/** 한 번에 몰아서 계산하는 스텝 묶음 (예산 확인 간격) */
const CHUNK = 20;

export interface LoopEnv {
  now(): number;
  schedule(fn: () => void, delayMs: number): void;
  post(event: WorkerEvent, transfer?: Transferable[]): void;
}

export class SimLoop {
  private status: SimStatus = 'idle';
  private world: World | null = null;
  private track: Track | null = null;
  private speed = 1;
  private skipping = false;
  private owedSteps = 0;
  private lastTime = 0;
  private lastPost = -Infinity;
  private scheduled = false;

  constructor(private readonly env: LoopEnv) {}

  handle(command: WorkerCommand) {
    switch (command.type) {
      case 'ping':
        this.env.post({ type: 'pong', id: command.id, protocolVersion: PROTOCOL_VERSION });
        return;
      case 'prepare':
        this.track = command.track;
        this.world = createWorldFromSeed(command.track, command.count, command.seed);
        this.status = 'ready';
        this.skipping = false;
        this.postSnapshot();
        return;
      case 'go':
        if (this.status !== 'ready') return;
        this.run();
        return;
      case 'pause':
        if (this.status !== 'running') return;
        this.status = 'paused';
        this.skipping = false;
        this.postSnapshot();
        return;
      case 'resume':
        if (this.status !== 'paused') return;
        this.run();
        return;
      case 'setSpeed':
        this.speed = Math.max(0, command.speed);
        return;
      case 'skip':
        if (this.status !== 'running' && this.status !== 'paused') return;
        this.skipping = true;
        if (this.status === 'paused') this.run();
        else this.postSnapshot();
        return;
      case 'reset':
        this.world = null;
        this.track = null;
        this.status = 'idle';
        this.skipping = false;
        return;
    }
  }

  private run() {
    this.status = 'running';
    this.lastTime = this.env.now();
    this.owedSteps = 0;
    this.postSnapshot();
    this.scheduleFrame(0);
  }

  private scheduleFrame(delay: number) {
    if (this.scheduled) return;
    this.scheduled = true;
    this.env.schedule(() => {
      this.scheduled = false;
      this.frame();
    }, delay);
  }

  private frame() {
    const world = this.world;
    const track = this.track;
    if (!world || !track || this.status !== 'running') return;

    const start = this.env.now();
    if (this.skipping) {
      while (!world.finished && this.env.now() - start < BUDGET_MS) advance(world, track, CHUNK);
    } else {
      this.owedSteps += ((start - this.lastTime) / 1000 / DT) * this.speed;
      this.lastTime = start;
      const due = Math.floor(this.owedSteps);
      let done = 0;
      while (done < due && !world.finished && this.env.now() - start < BUDGET_MS) {
        done += advance(world, track, Math.min(CHUNK, due - done));
      }
      // 예산 안에 못 한 스텝은 버린다 (밀린 계산이 쌓여 멈추는 것 방지). 물리 결과에는 영향 없음
      this.owedSteps -= due;
    }

    if (world.finished) {
      this.status = 'finished';
      this.skipping = false;
      this.postSnapshot();
      return;
    }
    if (this.env.now() - this.lastPost >= FRAME_MS) this.postSnapshot();
    this.scheduleFrame(this.skipping ? 0 : FRAME_MS / 2);
  }

  private postSnapshot() {
    const world = this.world;
    if (!world) return;
    const data = new Float32Array(world.cars.length * CAR_STRIDE);
    const counts: CarCounts = { running: 0, wall: 0, brake: 0, finish: 0, safety: 0 };
    world.cars.forEach((car, i) => {
      const o = i * CAR_STRIDE;
      data[o] = car.x;
      data[o + 1] = car.y;
      data[o + 2] = car.heading;
      data[o + 3] = car.speed;
      data[o + 4] = END_CODES.indexOf(car.endReason);
      if (!car.ended) counts.running++;
      else if (car.endReason === 'wall' || car.endReason === 'brake' || car.endReason === 'finish') counts[car.endReason]++;
      else counts.safety++;
    });
    const snapshot: Snapshot = {
      type: 'snapshot',
      status: this.status,
      skipping: this.skipping,
      tick: world.tick,
      ids: world.cars.map((c) => c.id),
      data,
      counts,
    };
    this.lastPost = this.env.now();
    this.env.post(snapshot, [data.buffer]);
  }
}
