# Race Simulator

유전 알고리즘으로 자율주행 자동차를 진화시키는 2D 웹 시뮬레이터 (대학 개인 프로젝트).

여러 대의 자동차가 같은 폐회로 트랙을 동시에 달리고, 각자의 신경망(유전자)으로 조향·가속·제동을 결정한다.
세대마다 가장 멀리 간 자동차를 금색 챔피언으로 보존하고, 교차·돌연변이로 다음 세대를 만든다.
부모를 직접 고르는 수동 진화와, 정지할 때까지 스스로 반복하는 자동 진화를 모두 지원한다.

## 현재 상태

**기획·설계 단계. 아직 실행 가능한 코드는 없다.** 진행 상황은 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) 참고.

## 기술 스택

React · TypeScript · Vite · Canvas 2D · Web Worker · Recharts · Vitest · Playwright

## 실행 (1단계 완료 후)

```bash
npm install
npm run dev     # 개발 서버
npm test        # 단위 테스트
```

## 문서

| 문서 | 내용 |
|---|---|
| [docs/HANDOFF_FOR_CLAUDE.md](docs/HANDOFF_FOR_CLAUDE.md) | 요구사항 원문 (기준 문서) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 구조와 핵심 설계 |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | 단계별 구현 계획과 진행 상황 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 원문에 없는 부분의 결정 기록 |
