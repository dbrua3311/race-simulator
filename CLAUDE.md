# Race Simulator — AI 코딩 도구 작업 규칙

요구사항 원문은 `docs/HANDOFF_FOR_CLAUDE.md`. 작업 전에 원문, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DECISIONS.md` 를 읽는다.

## 반드시 지킬 것

- 원문의 확정 요구사항을 임의로 빼거나 바꾸지 않는다. 해석이 필요하면 `docs/DECISIONS.md` 에 적고 사용자에게 알린다
- 테스트로 확인하지 않은 기능을 "완료"라고 하지 않는다. `IMPLEMENTATION_PLAN.md` 의 ✅ 는 테스트 통과 후에만
- 사용자에게 보이는 모든 문자열(버튼, 안내, 그래프, 오류)은 한국어. "Race Simulator" 만 영어
- 사용자가 원하지 않은 화면(자동 학습 정지 후 선택창, 부모 선택 전용 화면, 겹친 차 확대 팝업 등)을 만들지 않는다
- 커밋 전에 `npm test` 와 `npm run build` 를 통과시킨다
- 작업 후 한국어로 보고: 구현한 기능 / 수정한 파일 / 해결한 문제 / 실제로 한 테스트 / 아직 안 된 것

## 시뮬레이션 코어 규칙 (`src/core`, `src/tracks`, `src/simulation`, `src/genetics`)

- DOM, React, `Date.now()`, `performance.now()`, `Math.random()` 금지. 난수는 `src/core/rng` 의 시드 PRNG 만
- 물리는 고정 `DT` 로만 진행. 배속은 스텝 횟수만 바꾸고 물리 상수(최고속도 등)는 건드리지 않는다
- 상태는 JSON 직렬화 가능한 평범한 데이터로 유지 (클래스 인스턴스·함수·Map 을 상태에 넣지 않는다)
- 고스트·금색 오라·선택 표시는 시각 전용. 물리·센서·적합도 계산에 들어가면 안 된다
- 다음 세대 생성은 `createNextGeneration` 한 곳에서만, 세대 번호 토큰으로 중복 생성을 막는다
- 단위: 월드 좌표는 m, 시간은 s, 각도는 rad

## Git

- 기능 단위로 브랜치를 만들어 작업하고, 사용자 확인 후 main 에 병합한다
- 커밋할 파일을 지정해서 add 한다 (`git add .` / `git add -A` 금지)
- `git push --force`, `git reset --hard`, 커밋 기록 수정 금지
- `node_modules`, 빌드 산출물, 개인 저장 파일(`*.race.json` 실험 파일 등)은 커밋하지 않는다

## 환경

- Ubuntu, Node.js LTS. 홈 디스크 여유가 적으므로 npm 캐시·Playwright 브라우저 경로는 `/mnt/extra` 아래로 둔다
