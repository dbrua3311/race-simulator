import { expect, test, type Page } from '@playwright/test';

const simTime = (page: Page) => page.getByTestId('sim-time').textContent();

async function startRun(page: Page, seed: string) {
  await page.goto('/');
  await page.getByLabel('시드', { exact: true }).fill(seed);
  await page.getByRole('button', { name: '시드로 생성' }).click();
  await page.getByRole('button', { name: '주행 시작' }).click();
}

test('카운트다운 뒤 50대가 동시에 출발하고, 일시정지·재개·건너뛰기가 동작한다', async ({ page }) => {
  await startRun(page, 'DRIVE1');
  await expect(page.getByTestId('countdown')).toHaveText('3');
  await expect(page.getByTestId('stat-주행 중')).toHaveText('50대');
  await expect(page.getByTestId('finish-record')).toHaveText('--:--.--');
  await page.screenshot({ path: 'test-results/drive-grid.png' });

  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await expect(page.getByTestId('countdown')).toHaveCount(0);
  await expect.poll(() => simTime(page)).not.toBe('00:00.00');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/drive-running.png' });

  await page.getByRole('button', { name: '일시정지' }).click();
  await expect(page.getByTestId('phase')).toHaveText('일시정지');
  const paused = await simTime(page);
  await page.waitForTimeout(700);
  expect(await simTime(page)).toBe(paused);

  await page.getByRole('button', { name: '주행 재개' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중');
  await expect.poll(() => simTime(page)).not.toBe(paused);

  await page.getByRole('button', { name: '10배속' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 종료', { timeout: 20000 });
  await expect(page.getByTestId('stat-주행 중')).toHaveText('0대');
  await expect(page.getByTestId('stat-최고 진행률')).toHaveText(/^\d+\.\d%$/);
  await expect(page.getByTestId('finish-record')).toHaveText(/^(완주 기록 없음|\d\d:\d\d\.\d\d)$/);
  await page.screenshot({ path: 'test-results/drive-finished.png' });
});

test('같은 트랙·같은 판은 몇 배속으로 보든 같은 결과로 끝난다', async ({ page }) => {
  const finalStats = async () => {
    await expect(page.getByTestId('phase')).toHaveText('주행 종료', { timeout: 30000 });
    return {
      time: await simTime(page),
      wall: await page.getByTestId('stat-벽 충돌').textContent(),
      best: await page.getByTestId('stat-최고 진행률').textContent(),
      average: await page.getByTestId('stat-평균 진행률').textContent(),
      safety: await page.getByTestId('stat-안전 종료').textContent(),
      canvas: await page.getByTestId('track-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL()),
    };
  };

  await startRun(page, 'SAMERUN');
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await page.getByRole('button', { name: '건너뛰기' }).click();
  const skipped = await finalStats();

  await page.getByRole('button', { name: '새 판 시작' }).click();
  await page.getByRole('button', { name: '10배속' }).click();
  await page.getByRole('button', { name: '주행 시작' }).click();
  const fast = await finalStats();

  expect(fast).toEqual(skipped);
});
