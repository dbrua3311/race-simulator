import { expect, test, type Page } from '@playwright/test';

async function secondGeneration(page: Page, ghostMode: string) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByLabel('시드', { exact: true }).fill('LOOK1');
  await page.getByRole('button', { name: '시드로 생성' }).click();
  await page.getByLabel('고스트 비교 대상').selectOption({ label: ghostMode });
  await page.getByRole('button', { name: '주행 시작' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByTestId('phase')).toHaveText('부모 선택', { timeout: 30000 });
  await page.getByRole('button', { name: '자동으로 부모 고르기' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
}

const finalStats = async (page: Page) => {
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByTestId('phase')).toHaveText('부모 선택', { timeout: 30000 });
  return {
    time: await page.getByTestId('sim-time').textContent(),
    best: await page.getByTestId('stat-최고 진행률').textContent(),
    average: await page.getByTestId('stat-평균 진행률').textContent(),
    wall: await page.getByTestId('stat-벽 충돌').textContent(),
    brake: await page.getByTestId('stat-브레이크 정지').textContent(),
  };
};

test('2세대: 일반 차량과 고스트를 구분하며 종료 범례를 표시한다', async ({ page }) => {
  await secondGeneration(page, '역대 최고 자동차');
  await expect(page.getByTestId('ghost-info')).toContainText('1세대 1등');
  await expect(page.getByTestId('legend')).toContainText('고스트');
  await expect(page.getByTestId('legend')).not.toContainText('챔피언');
  await expect(page.getByText('금색 챔피언', { exact: true })).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/visual-gen2.png' });
  // 부모 선택 단계에서는 고스트를 숨긴다
  await finalStats(page);
  await expect(page.getByTestId('legend')).not.toContainText('고스트');
});

test('고스트를 켜도 꺼도 실제 자동차들의 결과는 같다', async ({ page }) => {
  await secondGeneration(page, '역대 최고 자동차');
  const withGhost = await finalStats(page);
  await secondGeneration(page, '표시 안 함');
  const withoutGhost = await finalStats(page);
  expect(withGhost).toEqual(withoutGhost);
});
