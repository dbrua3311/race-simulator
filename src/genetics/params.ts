/** 신경망 구조: 입력(센서 5) → 은닉 6 → 출력 2(조향, 가속/제동). 원문 18절 */
export const NETWORK_LAYERS = [5, 6, 2] as const;

/** 첫 세대 유전자(가중치·편향) 범위 */
export const INITIAL_GENE_RANGE = 1;

/** 유전 알고리즘 설정. 화면에서 바꿀 수 있고, 다음 세대를 만들 때 적용된다 */
export interface GaSettings {
  /** 우수 부모가 충분하면 일부 자손은 작은 변이로 주행을 보존한다. 누락은 켜짐. */
  preserveDriving?: boolean;
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
  /** 운전 방식 (새 실험·학습 초기화 때 적용, DECISIONS D35) */
  brain: Brain;
}

/**
 * network: 센서 5개 → 신경망 → 조향·가속/제동 (보고 운전한다)
 * sequence: 0.25 초 간격의 조향·페달 순서 자체가 유전자 (트랙을 외워서 운전한다)
 */
export type Brain = 'network' | 'sequence';

export const BRAIN_LABEL: Record<Brain, string> = {
  network: '신경망 (센서로 보고 운전)',
  sequence: '조작 순서 (외워서 운전)',
};

export const DEFAULT_SETTINGS: GaSettings = {
  preserveDriving: true,
  populationSize: 20,
  crossoverRate: 0.8,
  mutationRate: 0.15,
  // 실험으로 정함 (DECISIONS D32): 0.5 / 3 은 최고 개체만 앞서고 자손 대부분이 망가졌다
  mutationStrength: 0.25,
  tournamentSize: 5,
  selectionMode: 'manual',
  brain: 'network',
};

export const POPULATION_RANGE = [10, 100] as const;
/**
 * 수동 선택에서 필요한 최소 부모 수. 원문 30절은 "기본적으로 2대"였으나 사용자 요청으로 1대도 허용한다 (D36):
 * 1대면 모든 자손이 그 차를 조금씩 다르게 따라 한다. 최대는 제한하지 않는다
 */
export const MIN_PARENTS = 1;
