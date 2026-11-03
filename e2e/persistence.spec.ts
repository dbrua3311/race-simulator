import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

type CarPos = { id: number; x: number; y: number };
const cars = (page: Page) => page.evaluate(() => (window as unknown as { __raceCars: () => CarPos[] }).__raceCars());

async function toParentSelection(page: Page, seed: string) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByLabel('시드', { exact: true }).fill(seed);
  await page.getByRole('button', { name: '시드로 생성' }).click();
  await page.getByRole('button', { name: '주행 시작' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByTestId('phase')).toHaveText('부모 선택', { timeout: 30000 });
}

async function save(page: Page, path: string) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '실험 저장' }).click();
  await (await download).saveAs(path);
  await expect(page.getByTestId('toast')).toContainText('저장했습니다');
}

test('부모 선택 중 저장 → 새로고침 → 불러오기: 트랙·세대·기록·선택이 복원되고 저절로 넘어가지 않는다', async ({ page }, info) => {
  await toParentSelection(page, 'SAVE2');
  const box = (await page.getByTestId('track-canvas').boundingBox())!;
  const [a, b] = (await cars(page)).sort((p, q) => p.x - q.x);
  await page.mouse.click(box.x + a!.x, box.y + a!.y);
  await page.mouse.click(box.x + b!.x, box.y + b!.y);
  await expect(page.getByTestId('selection-count')).toHaveText('선택 2대');
  await page.getByLabel('실험 이름').fill('발표용 실험');
  const bestBefore = await page.getByTestId('best-car').textContent();
  const path = info.outputPath('saved.race.json');
  await save(page, path);
  const file = JSON.parse(readFileSync(path, 'utf8'));
  expect(file.name).toBe('발표용 실험');
  expect(file.savedPoint).toBe('1세대 주행 완료, 부모 선택 전');

  await page.reload();
  await page.getByTestId('load-input').setInputFiles(path);
  await expect(page.getByTestId('toast')).toContainText('불러왔습니다');
  await expect(page.getByTestId('track-label')).toContainText('SAVE2');
  await expect(page.getByText('트랙 고정됨')).toBeVisible();
  await expect(page.getByTestId('phase')).toHaveText('부모 선택');
  await expect(page.getByTestId('generation')).toHaveText('1');
  await expect(page.getByTestId('selection-count')).toHaveText('선택 2대');
  await expect(page.getByTestId('best-car')).toHaveText(bestBefore!);
  await expect(page.getByLabel('실험 이름')).toHaveValue('발표용 실험');
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('generation')).toHaveText('1');

  // 이어서 결정완료 → 2세대
  await page.getByRole('button', { name: '결정완료' }).click();
  await expect(page.getByTestId('generation')).toHaveText('2');
});

test('손상된 파일을 불러와도 지금 실험은 그대로', async ({ page }, info) => {
  await toParentSelection(page, 'SAVE3');
  const path = info.outputPath('broken.race.json');
  writeFileSync(path, '{"format":"race-simulator-experiment","formatVersion":1, "name": 3}');
  await page.getByTestId('load-input').setInputFiles(path);
  await expect(page.getByTestId('toast')).toContainText('불러오지 못했습니다');
  await expect(page.getByTestId('toast')).toContainText('지금 실험은 그대로입니다');
  await expect(page.getByTestId('track-label')).toContainText('SAVE3');
  await expect(page.getByTestId('phase')).toHaveText('부모 선택');
});

test('주행 중 저장 → 불러오면 그 시점에서 일시정지, 재개하면 이어서 달린다. CSV 도 내려받는다', async ({ page }, info) => {
  await toParentSelection(page, 'SAVE4');
  await page.getByRole('button', { name: '자동으로 부모 고르기' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '일시정지' }).click();
  await expect(page.getByTestId('phase')).toHaveText('일시정지');
  // 화면의 시간 표시가 마지막 스텝까지 갱신된 뒤 읽는다
  await page.waitForTimeout(300);
  const time = await page.getByTestId('sim-time').textContent();
  const path = info.outputPath('running.race.json');
  await save(page, path);

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '통계 CSV' }).click();
  const csvPath = info.outputPath('stats.csv');
  await (await csvDownload).saveAs(csvPath);
  expect(readFileSync(csvPath, 'utf8')).toContain('세대,개체 수');

  await page.reload();
  await page.getByTestId('load-input').setInputFiles(path);
  await expect(page.getByTestId('phase')).toHaveText('일시정지');
  await expect(page.getByTestId('generation')).toHaveText('2');
  await expect(page.getByTestId('sim-time')).toHaveText(time!);
  await page.getByRole('button', { name: '주행 재개' }).click();
  await expect.poll(() => page.getByTestId('sim-time').textContent()).not.toBe(time);
});

test('시연용 실험 파일: 30세대까지 학습한 상태로 불러와 이어서 달리면 완주 기록이 나온다', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.getByTestId('load-input').setInputFiles('demo/demo-medium-30세대.race.json');
  await expect(page.getByTestId('toast')).toContainText('불러왔습니다');
  await expect(page.getByTestId('generation')).toHaveText('31');
  await expect(page.getByTestId('phase')).toHaveText('주행 준비');
  await expect(page.getByTestId('best-car')).toContainText('30세대 1등');
  await page.getByRole('button', { name: '주행 시작' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  // 학습이 잘 되어 한 세대가 금방(시뮬레이션 30여 초) 끝나므로 1배속으로 잠깐만 본다
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/demo-running.png' });
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByTestId('phase')).toHaveText('부모 선택', { timeout: 60000 });
  await expect(page.getByTestId('finish-record')).toHaveText(/^\d\d:\d\d\.\d\d$/);
  await page.screenshot({ path: 'test-results/demo-finished.png' });
});
