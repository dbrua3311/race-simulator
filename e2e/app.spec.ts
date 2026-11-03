import { expect, test } from '@playwright/test';

test('기본 화면이 뜨고 시뮬레이션 워커와 연결된다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Race Simulator' })).toBeVisible();
  await expect(page.getByLabel('설정 및 조작')).toBeVisible();
  await expect(page.getByLabel('레이싱 화면')).toBeVisible();
  await expect(page.getByLabel('통계 및 분석')).toBeVisible();
  await expect(page.getByText('시뮬레이션 엔진 연결됨')).toBeVisible();

  // 캔버스가 중앙 영역 크기에 맞춰 잡혔는지
  const box = await page.locator('.track-canvas canvas').boundingBox();
  expect(box?.width).toBeGreaterThan(600);
  expect(box?.height).toBeGreaterThan(600);

  await page.screenshot({ path: 'test-results/stage1.png' });
  expect(errors).toEqual([]);
});
