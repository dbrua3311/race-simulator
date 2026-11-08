# Race Simulator

유전 알고리즘으로 자율주행 자동차를 진화시키는 2D 웹 시뮬레이터 (대학 개인 프로젝트).

여러 대의 자동차가 같은 폐회로 트랙을 동시에 달리고, 각자의 신경망(유전자)으로 조향·가속·제동을 결정한다.
평가 결과로 부모를 고르고, 모든 차량을 재조합·돌연변이 자손으로 만들어 다음 세대를 평가한다.
부모를 직접 고르는 수동 진화와, 정지할 때까지 스스로 반복하는 자동 진화를 모두 지원한다.

## 현재 상태

**1~10단계 모두 완료.** 운전 방식 두 가지(신경망으로 보고 운전 / 조작 순서를 외워서 운전), 픽셀아트 화면. 트랙 생성(하·중·상, 시드) → 기본 20대 신경망 동시 주행 → 평가 → 수동(클릭·드래그 + 결정완료) 또는 자동 부모 선택 → 교차·돌연변이 → 다음 세대, 정지할 때까지 반복하는 자동 학습, 실험 저장·불러오기, CSV, 고스트.
검증 결과는 [docs/VERIFICATION.md](docs/VERIFICATION.md), 발표 순서는 [docs/PRESENTATION.md](docs/PRESENTATION.md).

시연용 실험: "실험 불러오기"로 `demo/demo-medium-30세대.race.json` 을 열면 30세대 학습한 상태에서 바로 시작한다.

## 기술 스택

React · TypeScript · Vite · Canvas 2D · Web Worker · Recharts · Vitest · Playwright

## 실행

Node.js 26 (`.nvmrc`) 필요.

```bash
npm install
npm run dev        # 개발 서버 → http://localhost:5173
npm test           # 단위 테스트 (Vitest). 트랙 대량 검사: TRACK_SEEDS=1000 npm test
npm run lint       # ESLint
npm run typecheck  # 타입 검사
npm run build      # 배포용 빌드
```

브라우저 테스트 (Playwright, 처음 한 번 `npx playwright install chromium` 필요. 브라우저 설치 위치는 `PLAYWRIGHT_BROWSERS_PATH` 로 지정):

```bash
npm run test:e2e   # 개발 서버를 자동으로 띄우고 e2e/ 테스트 실행
```

## 다음 세대 생성

최고점 개체를 자동 원본 복사하는 자리는 없다. 모든 차량은 선택된 부모로부터 생성되며 수동으로 제외한 부모를 따로 끼워 넣지 않는다. 점수 순위와 과거 주행 고스트는 유지하지만 세대 최고 기록은 내려갈 수도 있다. 저장 형식은4이며 이전2/3 파일은 유전자·위치·난수를 유지해 읽는다.

## 배운 주행 보존

새 기본은 **배운 주행 보존**을 켠다. 최고 적합도의 80% 이상이면서 진행률 20% 이상에 해당하는 부모가 4대 이상 확보되면, 전체 자손의 약 80%는 해당 부모를 순환해 교차 없이 작은 변이로 만든다. 변이 확률은 설정값을 유지하고 폭만 설정값의 10%·30%를 번갈아 쓴다. 나머지는 기존 교차·변이로 탐색한다. 준비되지 않은 초기 집단에서는 기존 탐색을 사용한다.

이 기능은 신경망 방식에 적용한다. 조작 순서 모드의 교차·변이는 기존 방식으로 유지한다. 체크를 끄면 신경망도 기존 자손 생성 방식을 사용한다. 수동으로 제외한 부모는 보호 대상에도 넣지 않는다.

기존 파일의 현재 세대·유전자는 유지한다. 새 키가 없는 파일도 다음 세대부터 보존형 탐색을 사용하며 화면에서 해제할 수 있다. 학습 초기화 없이 이어갈 수 있다. 탐색 자손과 출발 자리 차이 때문에 초반 탈락이 완전히 없어지는 것은 아니다.

## 자동 학습 배속

자동 학습 중에도 배속 버튼으로 1·2·5·10·20·50배속을 즉시 선택할 수 있다. 기본은 1배속이다. 세대 평가·부모 선발·진화는 자동으로 이어지고, 물리 시간 간격은 그대로 유지한다. 실제 진행 배속은 오른쪽 통계에 표시하며 기기 성능에 따라 요청 배속보다 낮을 수 있다. 건너뛰기는 별도의 최대 속도 평가다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/HANDOFF_FOR_CLAUDE.md](docs/HANDOFF_FOR_CLAUDE.md) | 요구사항 원문 (기준 문서) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 구조와 핵심 설계 |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | 단계별 구현 계획과 진행 상황 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 원문에 없는 부분의 결정 기록 |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | 필수 검증 항목 ↔ 자동 테스트 대응표, 학습 곡선 |
| [docs/PRESENTATION.md](docs/PRESENTATION.md) | 발표 시연 순서 |
