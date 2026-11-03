import { expect, test, type Page } from '@playwright/test';

const canvasData = (page: Page) =>
  page.getByTestId('track-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());

async function useSeed(page: Page, seed: string) {
  await page.getByLabel('시드', { exact: true }).fill(seed);
  await page.getByRole('button', { name: '시드로 생성' }).click();
  await expect(page.getByTestId('track-label')).toContainText(seed);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('track-label')).toBeVisible();
});

test('난이도별 트랙을 그린다', async ({ page }) => {
  await useSeed(page, 'DEMO42');
  for (const label of ['하', '중', '상']) {
    await page.getByRole('group', { name: '난이도' }).getByRole('button', { name: label }).click();
    await expect(page.getByTestId('track-label')).toContainText(`난이도 ${label}`);
    await page.screenshot({ path: `test-results/track-${label}.png` });
  }
});

test('같은 난이도·시드는 같은 트랙, 다시 생성하면 다른 트랙', async ({ page }) => {
  await useSeed(page, 'SAME01');
  const first = await canvasData(page);

  await page.getByRole('button', { name: '트랙 다시 생성' }).click();
  await expect(page.getByTestId('track-label')).not.toContainText('SAME01');
  expect(await canvasData(page)).not.toBe(first);

  await useSeed(page, 'SAME01');
  expect(await canvasData(page)).toBe(first);
});

test('주행을 시작하면 트랙이 고정되고, 새 판에서 풀린다', async ({ page }) => {
  await useSeed(page, 'LOCK01');
  const difficulty = page.getByRole('group', { name: '난이도' });

  await page.getByRole('button', { name: '주행 시작' }).click();
  await expect(page.getByText('트랙 고정됨')).toBeVisible();
  await expect(page.getByTestId('phase')).toHaveText('출발 카운트다운');
  await expect(page.getByRole('button', { name: '트랙 다시 생성' })).toBeDisabled();
  await expect(page.getByLabel('시드', { exact: true })).toBeDisabled();
  for (const label of ['하', '중', '상']) await expect(difficulty.getByRole('button', { name: label })).toBeDisabled();
  await expect(page.getByTestId('track-label')).toContainText('LOCK01');

  await page.getByRole('button', { name: '새 판 시작' }).click();
  await expect(page.getByText('트랙 고정됨')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '트랙 다시 생성' })).toBeEnabled();
  // 새 판을 시작해도 트랙은 그대로 남아 있고, 바꾸는 것은 사용자가 정한다
  await expect(page.getByTestId('track-label')).toContainText('LOCK01');
});
