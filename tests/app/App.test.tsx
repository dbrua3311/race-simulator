// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';

afterEach(cleanup);

describe('기본 화면', () => {
  it('세 영역과 한국어 조작부를 보여 준다', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Race Simulator' })).toBeInTheDocument();
    expect(screen.getByLabelText('설정 및 조작')).toBeInTheDocument();
    expect(screen.getByLabelText('레이싱 화면')).toBeInTheDocument();
    expect(screen.getByLabelText('통계 및 분석')).toBeInTheDocument();

    for (const name of ['주행 시작', '일시정지', '주행 재개', '건너뛰기', '자동 학습 시작', '실험 저장', '실험 불러오기']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('--:--.--')).toBeInTheDocument();
  });

  it('기본 개체 수는 50대다', () => {
    render(<App />);
    expect(screen.getByText('50대')).toBeInTheDocument();
  });

  it('Web Worker 가 없는 환경에서는 엔진 사용 불가로 표시한다', () => {
    render(<App />);
    expect(screen.getByText('시뮬레이션 엔진 사용 불가')).toBeInTheDocument();
  });
});
