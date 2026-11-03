// 불러온 저장 파일 검사. 하나라도 이상하면 오류를 던지고, 호출한 쪽은 지금 실험을 그대로 둔다 (원문 60절).

import { parameterCount } from '../genetics/network';
import { POPULATION_RANGE } from '../genetics/params';
import { SAVE_FORMAT, SAVE_FORMAT_VERSION, type SaveFile } from './saveFile';

export class SaveFileError extends Error {}

type Obj = Record<string, unknown>;

const fail = (message: string): never => {
  throw new SaveFileError(message);
};
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, what: string): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fail(`${what} 값이 올바르지 않습니다`);
const arr = (v: unknown, what: string): unknown[] => (Array.isArray(v) ? v : fail(`${what} 목록이 없습니다`));
const obj = (v: unknown, what: string): Obj => (isObj(v) ? v : fail(`${what} 정보가 없습니다`));

function points(v: unknown, what: string, minLength: number) {
  const list = arr(v, what);
  if (list.length < minLength) fail(`${what} 좌표가 부족합니다`);
  for (const p of list) {
    const o = obj(p, what);
    num(o.x, what);
    num(o.y, what);
  }
}

function numbers(v: unknown, what: string) {
  for (const x of arr(v, what)) num(x, what);
}

/** 텍스트를 저장 파일로 해석한다. 문제가 있으면 SaveFileError (한국어 설명) */
export function parseSaveFile(text: string): SaveFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    fail('JSON 파일이 아니거나 내용이 손상되었습니다');
  }
  const file = obj(data, '파일');
  if (file.format !== SAVE_FORMAT) fail('Race Simulator 실험 파일이 아닙니다');
  if (file.formatVersion !== SAVE_FORMAT_VERSION) fail(`지원하지 않는 파일 형식 버전입니다 (${String(file.formatVersion)})`);
  if (typeof file.name !== 'string' || typeof file.savedAt !== 'string') fail('실험 이름 또는 저장 시각이 없습니다');

  const exp = obj(file.experiment, '실험');
  const track = obj(exp.track, '트랙');
  if (!['easy', 'medium', 'hard'].includes(track.difficulty as string)) fail('트랙 난이도가 올바르지 않습니다');
  if (typeof track.seed !== 'string') fail('트랙 시드가 없습니다');
  points(track.center, '트랙 중심선', 10);
  points(track.left, '트랙 왼쪽 벽', 10);
  points(track.right, '트랙 오른쪽 벽', 10);
  const n = (track.center as unknown[]).length;
  if ((track.left as unknown[]).length !== n || (track.right as unknown[]).length !== n) fail('트랙 벽과 중심선 길이가 다릅니다');
  num(track.length, '트랙 길이');
  num(track.spacing, '트랙 점 간격');
  num(track.roadWidth, '도로 폭');
  obj(track.startLine, '출발선');
  for (const g of arr(track.checkpoints, '체크포인트')) {
    const gate = obj(g, '체크포인트');
    if (num(gate.index, '체크포인트') < 0 || (gate.index as number) >= n) fail('체크포인트 위치가 트랙 밖입니다');
  }
  obj(track.bounds, '트랙 범위');

  const settings = obj(exp.settings, '진화 설정');
  const population = num(settings.populationSize, '자동차 개체 수');
  if (population < POPULATION_RANGE[0] || population > POPULATION_RANGE[1]) fail('자동차 개체 수가 범위를 벗어났습니다');
  for (const key of ['crossoverRate', 'mutationRate'] as const) {
    const v = num(settings[key], '진화 설정');
    if (v < 0 || v > 1) fail('교차·돌연변이 확률은 0 ~ 100% 여야 합니다');
  }
  num(settings.mutationStrength, '돌연변이 크기');
  num(settings.tournamentSize, '토너먼트 크기');
  if (settings.selectionMode !== 'manual' && settings.selectionMode !== 'auto') fail('진화 방식이 올바르지 않습니다');

  if (num(exp.generation, '세대 번호') < 1) fail('세대 번호가 올바르지 않습니다');
  const rng = obj(exp.rng, '난수 상태');
  for (const k of ['a', 'b', 'c', 'd']) num(rng[k], '난수 상태');
  if (!['ready', 'running', 'paused', 'evaluated'].includes(exp.status as string)) fail('주행 상태가 올바르지 않습니다');

  const world = obj(exp.world, '현재 세대');
  num(world.tick, '주행 시간');
  const cars = arr(world.cars, '자동차');
  const genomes = arr(world.genomes, '유전자');
  const trails = arr(world.trails, '주행 궤적');
  if (cars.length === 0 || cars.length !== genomes.length || cars.length !== trails.length) fail('자동차·유전자 수가 맞지 않습니다');
  const genes = parameterCount();
  genomes.forEach((g) => {
    if (arr(g, '유전자').length !== genes) fail(`유전자 길이가 ${genes}개가 아닙니다`);
    numbers(g, '유전자');
  });
  trails.forEach((t) => numbers(t, '주행 궤적'));
  const ids = new Set<number>();
  for (const c of cars) {
    const car = obj(c, '자동차');
    for (const key of ['id', 'slot', 'x', 'y', 'heading', 'speed', 'steer', 'throttle', 'trackIndex', 'startS', 's', 'bestDistance', 'bestTick', 'nextGate', 'progressMark', 'progressMarkTick']) {
      num(car[key], `자동차 ${key}`);
    }
    if ((car.trackIndex as number) < 0 || (car.trackIndex as number) >= n) fail('자동차 위치가 트랙 밖입니다');
    if (typeof car.ended !== 'boolean' || typeof car.champion !== 'boolean' || typeof car.hasMoved !== 'boolean') fail('자동차 상태가 올바르지 않습니다');
    ids.add(car.id as number);
  }
  if (ids.size !== cars.length) fail('자동차 번호가 겹칩니다');
  if (typeof world.finished !== 'boolean') fail('세대 종료 여부가 없습니다');

  for (const r of arr(exp.history, '세대별 기록')) {
    const record = obj(r, '세대별 기록');
    num(record.generation, '세대별 기록');
    num(record.bestProgress, '세대별 기록');
    num(record.averageProgress, '세대별 기록');
    const winner = obj(record.winner, '세대 1등');
    if (arr(winner.genome, '세대 1등 유전자').length !== genes) fail('세대 1등 유전자 길이가 올바르지 않습니다');
  }
  for (const g of arr(exp.ghosts, '고스트')) numbers(obj(g, '고스트').samples, '고스트');
  if (exp.status === 'evaluated' && (exp.history as unknown[]).length === 0) fail('평가 기록이 없습니다');

  const ui = obj(file.ui, '화면 정보');
  numbers(ui.selection, '선택한 자동차');

  return data as SaveFile;
}
