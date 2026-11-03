// 시드 기반 난수. 상태는 평범한 객체라 JSON 으로 저장·복원할 수 있다.
// 알고리즘: 시드 문자열 → cyrb128 해시 → sfc32 생성기.

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function createRng(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const state = { a: (h1 ^ h2 ^ h3 ^ h4) >>> 0, b: (h2 ^ h1) >>> 0, c: (h3 ^ h1) >>> 0, d: (h4 ^ h1) >>> 0 };
  // 초기 상태의 편향을 없애기 위해 몇 번 버린다
  for (let i = 0; i < 12; i++) nextUint32(state);
  return state;
}

/** 다음 32비트 정수. 상태를 제자리에서 바꾼다. */
export function nextUint32(s: RngState): number {
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  s.d = (s.d + 1) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) | 0;
  return t >>> 0;
}

/** [0, 1) 균등 분포 */
export function nextFloat(s: RngState): number {
  return nextUint32(s) / 4294967296;
}

/** [min, max) 균등 분포 */
export function uniform(s: RngState, min: number, max: number): number {
  return min + (max - min) * nextFloat(s);
}

/** [min, max] 정수 */
export function randomInt(s: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(s) * (max - min + 1));
}
