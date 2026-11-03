import { expect, test, type Page } from '@playwright/test';

type CarPos = { id: number; x: number; y: number };
const cars = (page: Page) => page.evaluate(() => (window as unknown as { __raceCars: () => CarPos[] }).__raceCars());

async function finishFirstGeneration(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByLabel('시드', { exact: true }).fill('EVO1');
  await page.getByRole('button', { name: '시드로 생성' }).click();
  await page.getByRole('button', { name: '주행 시작' }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByTestId('phase')).toHaveText('부모 선택', { timeout: 30000 });
}

test('수동 진화: 클릭·드래그로 부모를 고르고 결정완료를 눌러야만 다음 세대가 출발한다', async ({ page }) => {
  await finishFirstGeneration(page);
  const canvas = page.getByTestId('track-canvas');
  const box = (await canvas.boundingBox())!;
  const positions = await cars(page);
  expect(positions).toHaveLength(50);

  // 결정완료는 2대 이상 골라야 누를 수 있다
  const confirm = page.getByRole('button', { name: '결정완료' });
  await expect(confirm).toBeDisabled();

  // 클릭: 선택 → 다시 클릭하면 해제
  // 차 중심을 정확히 누르면 가장 가까운 그 차가 골라진다 (겹쳐 있어도)
  const lone = positions[0]!;
  await page.mouse.click(box.x + lone.x, box.y + lone.y);
  await expect(page.getByTestId('selection-count')).toHaveText('선택 1대');
  await page.mouse.click(box.x + lone.x, box.y + lone.y);
  await expect(page.getByTestId('selection-count')).toHaveText('선택 0대');

  // 드래그: 출발 그리드 근처에 겹쳐 있는 차들을 한꺼번에 (기존 선택에 추가)
  await page.mouse.click(box.x + lone.x, box.y + lone.y);
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  await page.mouse.move(box.x + Math.min(...xs) - 5, box.y + Math.min(...ys) - 5);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.max(...xs) + 5, box.y + Math.max(...ys) + 5, { steps: 8 });
  await page.screenshot({ path: 'test-results/evo-drag.png' });
  await page.mouse.up();
  await expect(page.getByTestId('selection-count')).toHaveText('선택 50대');

  // 클릭·드래그만으로는 다음 세대로 넘어가지 않는다
  await page.waitForTimeout(800);
  await expect(page.getByTestId('phase')).toHaveText('부모 선택');
  await expect(page.getByTestId('generation')).toHaveText('1');

  await page.getByRole('button', { name: '선택 초기화' }).click();
  await expect(page.getByTestId('selection-count')).toHaveText('선택 0대');
  const sorted = [...positions].sort((a, b) => a.x - b.x);
  await page.mouse.click(box.x + sorted[0]!.x, box.y + sorted[0]!.y);
  await page.mouse.click(box.x + sorted.at(-1)!.x, box.y + sorted.at(-1)!.y);
  await expect(page.getByTestId('selection-count')).toHaveText('선택 2대');
  await page.screenshot({ path: 'test-results/evo-selected.png' });

  await confirm.click();
  await expect(page.getByTestId('countdown')).toBeVisible();
  await expect(page.getByTestId('generation')).toHaveText('2');
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/evo-gen2.png' });
  await expect(page.getByTestId('best-car')).toContainText('1세대 1등');
});

test('자동 학습: 입력 없이 세대가 늘고, 정지하면 선택창 없이 일반 화면에서 상태가 보존된다', async ({ page }) => {
  await finishFirstGeneration(page);
  await page.getByRole('button', { name: '자동 학습 시작' }).click();
  await expect(page.getByText('자동 학습 중')).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId('generation').textContent()), { timeout: 60000 }).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: 'test-results/auto-running.png' });

  await page.getByRole('button', { name: '자동 학습 정지' }).click();
  await expect(page.getByText('자동 학습 중')).toHaveCount(0);
  const generation = await page.getByTestId('generation').textContent();
  const phase = await page.getByTestId('phase').textContent();
  expect(['일시정지', '부모 선택', '주행 준비']).toContain(phase);
  // 별도 창이나 팝업 없이 같은 화면, 같은 세대
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('generation')).toHaveText(generation!);

  // 다시 자동 학습을 시작하면 이어서 진행
  await page.getByRole('button', { name: '자동 학습 시작' }).click();
  await expect
    .poll(async () => Number(await page.getByTestId('generation').textContent()), { timeout: 60000 })
    .toBeGreaterThan(Number(generation));
  await page.getByRole('button', { name: '자동 학습 정지' }).click();
});
