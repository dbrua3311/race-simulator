import { expect, test } from '@playwright/test';

test('100대 자동 학습: 실시간보다 훨씬 빠르게 계산하면서도 화면과 정지 버튼이 바로 반응한다', async ({ page }) => {
  test.setTimeout(120000);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByLabel('시드', { exact: true }).fill('PERF1');
  await page.getByRole('button', { name: '시드로 생성' }).click();
  await page.getByLabel('자동차 개체 수').fill('100');
  await expect(page.getByText('100대', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '주행 시작' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await expect(page.getByTestId('stat-주행 중')).not.toHaveText('-');

  await page.getByRole('button', { name: '50배속', exact: true }).click();
  await page.getByRole('button', { name: '자동 학습 시작' }).click();
  await expect.poll(async () => Number(await page.getByTestId('generation').textContent()), { timeout: 90000 }).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId('actual-speed')).toBeVisible();
  const speed = Number((await page.getByTestId('actual-speed').textContent())!.split('×')[1]);
  expect(speed).toBeGreaterThanOrEqual(5);

  // 화면이 계속 그려지는가: 주행 시간 표시가 바뀐다
  const t1 = await page.getByTestId('sim-time').textContent();
  await expect.poll(() => page.getByTestId('sim-time').textContent()).not.toBe(t1);

  // 고속 계산 중에도 정지 버튼이 바로 반응한다 (다른 테스트와 동시에 돌아 바쁠 때도 3초 안)
  const before = Date.now();
  await page.getByRole('button', { name: '자동 학습 정지' }).click();
  await expect(page.getByText('자동 학습 중', { exact: true })).toHaveCount(0, { timeout: 3000 });
  expect(Date.now() - before).toBeLessThan(3000);
});
