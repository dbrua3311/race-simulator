// 워커 안의 주행 루프. 시계·타이머를 주입받아 브라우저 없이도 테스트할 수 있다.
//
// - 물리는 항상 고정 DT 스텝(stepWorld)으로만 진행한다. 배속은 실제 1초에 계산하는 스텝 수만 바꾼다.
// - 한 번에 BUDGET_MS 만큼만 계산하고 양보하므로, 계산 중에도 일시정지·자동 학습 정지 명령이 바로 처리된다.
// - 화면 갱신(스냅샷)은 약 60 Hz. 건너뛰기·자동 학습 중에도 계속 보낸다.
// - 세대가 끝나면 평가하고, 자동 학습이면 다음 세대를 만들어 바로 출발시킨다.

import { fitnessOf } from '../genetics/fitness';
import { DT } from '../simulation/params';
import {
  evaluate,
  GenerationError,
  newExperiment,
  nextGeneration,
  resetLearning,
  type Experiment,
} from '../simulation/experiment';
import { progressOf } from '../simulation/progress';
import { advance } from '../simulation/world';
import {
  CAR_STRIDE,
  END_CODES,
  PROTOCOL_VERSION,
  type CarCounts,
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
  private exp: Experiment | null = null;
  private auto = false;
  private speed = 1;
  private skipping = false;
  private owedSteps = 0;
  private lastTime = 0;
  private lastPost = -Infinity;
  private scheduled = false;
  /** 실제 배속 측정 */
  private speedWindowStart = 0;
  private speedWindowSteps = 0;
  private actualSpeed = 0;

  constructor(private readonly env: LoopEnv) {}

  /** 테스트용: 현재 실험 */
  get experiment(): Experiment | null {
    return this.exp;
  }

  handle(command: WorkerCommand) {
    try {
      this.dispatch(command);
    } catch (error) {
      const message = error instanceof GenerationError ? error.message : `시뮬레이션 오류: ${String(error)}`;
      this.env.post({ type: 'error', message });
    }
  }

  private dispatch(command: WorkerCommand) {
    const exp = this.exp;
    switch (command.type) {
      case 'ping':
        this.env.post({ type: 'pong', id: command.id, protocolVersion: PROTOCOL_VERSION });
        return;
      case 'newExperiment':
        this.exp = newExperiment(command.track, command.settings, command.seed);
        this.auto = false;
        this.skipping = false;
        this.postSnapshot();
        return;
      case 'resetLearning':
        if (!exp) return;
        this.exp = resetLearning(exp, command.seed);
        this.auto = false;
        this.skipping = false;
        this.postSnapshot();
        return;
      case 'updateSettings':
        if (exp) exp.settings = { ...command.settings };
        return;
      case 'go':
        if (exp?.status !== 'ready') return;
        this.run();
        return;
      case 'pause':
        if (exp?.status !== 'running' || this.auto) return;
        exp.status = 'paused';
        this.skipping = false;
        this.postSnapshot();
        return;
      case 'resume':
        if (exp?.status !== 'paused') return;
        this.run();
        return;
      case 'setSpeed':
        if (!Number.isFinite(command.speed) || command.speed <= 0) throw new Error('올바른 배속을 선택하세요');
        this.speed = Math.min(256, Math.max(1, command.speed));
        this.owedSteps = 0;
        this.lastTime = this.env.now();
        this.speedWindowStart = this.lastTime;
        this.speedWindowSteps = 0;
        this.actualSpeed = 0;
        this.postSnapshot();
        return;
      case 'skip':
        if ((exp?.status !== 'running' && exp?.status !== 'paused') || this.auto) return;
        this.skipping = true;
        if (exp.status === 'paused') this.run();
        else this.postSnapshot();
        return;
      case 'confirmParents':
        if (!exp) return;
        nextGeneration(exp, command.parentIds, command.generation);
        this.postSnapshot();
        return;
      case 'autoSelect':
        if (!exp) return;
        nextGeneration(exp, null, command.generation);
        this.postSnapshot();
        return;
      case 'startAuto':
        if (!exp || this.auto) return;
        this.auto = true;
        this.skipping = false;
        // 어느 상태에서든 지금 세대부터 이어서 자동으로 진행한다 (새로 시작하거나 초기화하지 않는다)
        if (exp.status === 'evaluated') nextGeneration(exp, null, exp.generation);
        if (exp.status === 'ready' || exp.status === 'paused') this.run();
        else this.postSnapshot();
        return;
      case 'stopAuto':
        // 학습 초기화가 아니다: 지금 상태(세대·위치·속도·기록)를 그대로 두고 일시정지만 한다
        if (!this.auto) return;
        this.auto = false;
        this.skipping = false;
        if (exp?.status === 'running') exp.status = 'paused';
        this.postSnapshot();
        return;
      case 'exportExperiment':
        if (!exp) return;
        this.env.post({ type: 'experiment', requestId: command.requestId, experiment: structuredClone(exp) });
        return;
      case 'loadExperiment': {
        const loaded = structuredClone(command.experiment);
        // 주행 중에 저장된 실험은 일시정지 상태로 불러온다
        if (loaded.status === 'running') loaded.status = 'paused';
        this.exp = loaded;
        this.auto = false;
        this.skipping = false;
        this.env.post({ type: 'experiment', requestId: -1, experiment: structuredClone(loaded) });
        this.postSnapshot();
        return;
      }
      case 'reset':
        this.exp = null;
        this.auto = false;
        this.skipping = false;
        return;
    }
  }

  private run() {
    const exp = this.exp!;
    exp.status = 'running';
    this.lastTime = this.env.now();
    this.owedSteps = 0;
    this.speedWindowStart = this.lastTime;
    this.speedWindowSteps = 0;
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
    const exp = this.exp;
    if (!exp || exp.status !== 'running') return;
    const start = this.env.now();
    const fast = this.skipping;
    let stepped = 0;

    if (fast) {
      // 건너뛰기만 최대 속도로 계산한다. 자동 학습도 일반 주행과 같은 배속 예산을 따른다.
      while (exp.status === 'running' && this.env.now() - start < BUDGET_MS) {
        stepped += advance(exp.world, exp.track, CHUNK);
        if (exp.world.finished) {
          const wasSkipping = this.skipping;
          this.finishGeneration(exp);
          if (wasSkipping) break;
        }
      }
    } else {
      this.owedSteps += ((start - this.lastTime) / 1000 / DT) * this.speed;
      const due = Math.floor(this.owedSteps);
      while (stepped < due && !exp.world.finished && this.env.now() - start < BUDGET_MS) {
        stepped += advance(exp.world, exp.track, Math.min(CHUNK, due - stepped));
      }
      // 예산 안에 못 한 스텝은 버린다 (밀린 계산이 쌓여 멈추는 것 방지). 물리 결과에는 영향 없음
      this.owedSteps -= due;
      if (exp.world.finished) this.finishGeneration(exp);
    }
    this.lastTime = start;
    this.measureSpeed(stepped);

    if (exp.status !== 'running') {
      this.postSnapshot();
      return;
    }
    if (this.env.now() - this.lastPost >= FRAME_MS) this.postSnapshot();
    this.scheduleFrame(fast ? 0 : FRAME_MS / 2);
  }

  /** 세대 주행이 끝났다: 평가하고, 자동이면 다음 세대로 */
  private finishGeneration(exp: Experiment) {
    const record = evaluate(exp);
    this.skipping = false;
    this.env.post({ type: 'evaluated', record, ghost: exp.ghosts.at(-1)! });
    if (this.auto) {
      nextGeneration(exp, null, exp.generation);
      exp.status = 'running';
    } else if (exp.settings.selectionMode === 'auto') {
      nextGeneration(exp, null, exp.generation);
    }
    this.postSnapshot();
  }

  private measureSpeed(steps: number) {
    this.speedWindowSteps += steps;
    const now = this.env.now();
    const elapsed = now - this.speedWindowStart;
    if (elapsed >= 500) {
      this.actualSpeed = (this.speedWindowSteps * DT * 1000) / elapsed;
      this.speedWindowStart = now;
      this.speedWindowSteps = 0;
    }
  }

  private postSnapshot() {
    const exp = this.exp;
    if (!exp) return;
    const { world } = exp;
    const data = new Float32Array(world.cars.length * CAR_STRIDE);
    const counts: CarCounts = { running: 0, wall: 0, brake: 0, finish: 0, safety: 0 };
    let bestProgress = 0;
    let progressSum = 0;
    let bestFitness = 0;
    let fitnessSum = 0;
    let bestFinish: Snapshot['bestFinish'] = null;
    world.cars.forEach((car, i) => {
      const o = i * CAR_STRIDE;
      data[o] = car.x;
      data[o + 1] = car.y;
      data[o + 2] = car.heading;
      data[o + 3] = car.speed;
      data[o + 4] = END_CODES.indexOf(car.endReason);
      const progress = progressOf(car);
      data[o + 5] = progress;
      const fitness = fitnessOf(car);
      bestProgress = Math.max(bestProgress, progress);
      progressSum += progress;
      bestFitness = Math.max(bestFitness, fitness);
      fitnessSum += fitness;
      if (car.endReason === 'finish' && (!bestFinish || car.endTick! < bestFinish.tick)) {
        bestFinish = { tick: car.endTick!, id: car.id };
      }
      if (!car.ended) counts.running++;
      else if (car.endReason === 'wall' || car.endReason === 'brake' || car.endReason === 'finish') counts[car.endReason]++;
      else counts.safety++;
    });
    const n = world.cars.length || 1;
    const snapshot: Snapshot = {
      type: 'snapshot',
      status: exp.status,
      auto: this.auto,
      skipping: this.skipping,
      generation: exp.generation,
      tick: world.tick,
      ids: world.cars.map((c) => c.id),
      data,
      counts,
      bestProgress,
      averageProgress: progressSum / n,
      bestFitness,
      averageFitness: fitnessSum / n,
      bestFinish,
      actualSpeed: this.actualSpeed,
    };
    this.lastPost = this.env.now();
    this.env.post(snapshot, [data.buffer]);
  }
}
