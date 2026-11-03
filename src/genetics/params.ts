/** 신경망 구조: 입력(센서 5) → 은닉 6 → 출력 2(조향, 가속/제동). 원문 18절 */
export const NETWORK_LAYERS = [5, 6, 2] as const;

/** 첫 세대 유전자(가중치·편향) 범위 */
export const INITIAL_GENE_RANGE = 1;

/** 유전 알고리즘 설정. 화면에서 바꿀 수 있고, 다음 세대를 만들 때 적용된다 */
export interface GaSettings {
  /** 자동차 개체 수 (10 ~ 100) */
  populationSize: number;
  /** 교차 확률 (0 ~ 1): 자손마다 이 확률로 두 부모를 섞고, 아니면 한 부모를 복제한다 */
  crossoverRate: number;
  /** 돌연변이 확률 (0 ~ 1): 유전자(가중치) 하나하나가 이 확률로 바뀐다 */
  mutationRate: number;
  /** 돌연변이 크기: 더하는 정규분포 노이즈의 표준편차 */
  mutationStrength: number;
  /** 다음 세대 부모를 고르는 방식 (수동 모드가 아닐 때·자동 학습 중) */
  tournamentSize: number;
  /** 수동: 사용자가 부모를 고른다 / 자동: 토너먼트 선택 */
  selectionMode: 'manual' | 'auto';
}

export const DEFAULT_SETTINGS: GaSettings = {
  populationSize: 50,
  crossoverRate: 0.8,
  mutationRate: 0.15,
  // 실험으로 정함 (DECISIONS D32): 0.5 / 3 은 챔피언 혼자 앞서고 자손 대부분이 망가졌다
  mutationStrength: 0.25,
  tournamentSize: 5,
  selectionMode: 'manual',
};

export const POPULATION_RANGE = [10, 100] as const;
/** 수동 선택에서 필요한 최소 부모 수 (원문 30절). 최대는 제한하지 않는다 */
export const MIN_PARENTS = 2;
