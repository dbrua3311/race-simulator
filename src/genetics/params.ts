/** 신경망 구조: 입력(센서 5) → 은닉 6 → 출력 2(조향, 가속/제동). 원문 18절 */
export const NETWORK_LAYERS = [5, 6, 2] as const;

/** 첫 세대 유전자(가중치·편향) 범위 */
export const INITIAL_GENE_RANGE = 1;
