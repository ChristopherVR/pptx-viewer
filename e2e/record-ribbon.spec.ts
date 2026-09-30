/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';
import { collectRibbonInventory } from './support/ribbon-controls';

test.use({ viewport: { width: 1440, height: 900 } });
test('Record ribbon retains its six commands and four disabled placeholders', async ({
	page,
}, testInfo) => {
	await loadDeck(page);
	const inventory = await collectRibbonInventory(page, ['Record']);
	expect(inventory[0].controls).toHaveLength(6);
	expect(inventory[0].controls.filter((control) => control.disabled)).toHaveLength(4);
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	await expect(toolbar.locator('pptx-ui-ribbon-group:visible')).toHaveCount(4);
	await expect(toolbar.locator('pptx-ui-ribbon-command:visible')).toHaveCount(6);
	const beginning = toolbar.getByRole('button', { name: 'From Beginning', exact: true });
	const current = toolbar.getByRole('button', { name: 'From Current Slide', exact: true });
	await beginning.focus();
	await page.keyboard.press('Tab');
	await expect(current).toBeFocused();
	await expect(toolbar.getByRole('button', { name: 'Cameo', exact: true })).toBeDisabled();
	await expect(toolbar.getByRole('button', { name: 'Learn More', exact: true })).toBeDisabled();
	const path = testInfo.outputPath('record-ribbon.png');
	await toolbar.screenshot({ path });
	await testInfo.attach('record-ribbon', { path, contentType: 'image/png' });
});
