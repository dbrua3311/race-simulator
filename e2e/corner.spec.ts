import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('신경망 주행 보존 설정을 저장하고 구 파일의 현재 유전자를 유지해 재개한다', async ({ page }) => {
  test.setTimeout(60000);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  const preservation = page.getByRole('checkbox', { name: '배운 주행 보존', exact: true });
  await expect(preservation).toBeChecked();
  await preservation.uncheck();
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.getByTestId('phase')).toHaveText('주행 중', { timeout: 6000 });
  await page.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await expect(page.getByTestId('phase')).toHaveText('부모 선택', { timeout: 30000 });
  const save = async (p: Page) => {
    const pending = p.waitForEvent('download');
    await p.getByRole('button', { name: '실험 저장', exact: true }).click();
    const download = await pending;
    return JSON.parse(await readFile((await download.path())!, 'utf8'));
  };
  const disabled = await save(page);
  expect(disabled.experiment.settings.preserveDriving).toBe(false);
  await preservation.check();
  expect((await save(page)).experiment.settings.preserveDriving).toBe(true);
  const legacy = structuredClone(disabled);
  delete legacy.experiment.settings.preserveDriving;
  await page.locator('input[type=file]').setInputFiles({
    name: 'legacy.race.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(preservation).toBeChecked();
  const restored = await save(page);
  expect(restored.experiment.world.genomes).toEqual(legacy.experiment.world.genomes);
  expect(restored.experiment.generation).toBe(legacy.experiment.generation);
  await page.getByLabel('운전 방식').selectOption('sequence');
  await expect(preservation).toHaveCount(0);
});
