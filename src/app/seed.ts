// 사용자에게 보여 주는 새 시드. 헷갈리는 글자(0/O, 1/I/L)는 뺐다.
// UI 계층이라 Math.random 을 써도 된다 (트랙 자체는 시드로만 결정된다).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomSeed(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export const MAX_SEED_LENGTH = 32;

export function normalizeSeed(input: string): string {
  return input.trim().slice(0, MAX_SEED_LENGTH);
}
