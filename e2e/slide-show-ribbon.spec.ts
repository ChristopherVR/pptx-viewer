/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';
import { collectRibbonInventory } from './support/ribbon-controls';

test.use({ viewport: { width: 1440, height: 900 } });

test('shared Slide Show ribbon retains its inventory, groups, toggles and keyboard actions', async ({
	page,
}, testInfo) => {
	await loadDeck(page);
	const inventory = await collectRibbonInventory(page, ['Slide Show']);
	expect(inventory[0].controls).toHaveLength(16);
	expect(
		inventory[0].controls
			.filter((control) => control.disabled)
			.map((control) => control.name)
			.sort(),
	).toEqual(['Keep Slides Updated', 'Rehearse with Coach', 'Show Media Controls']);
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const groups = toolbar.locator('pptx-ui-ribbon-group:visible');
	await expect(groups).toHaveCount(4);
	const boxes = await groups.evaluateAll((elements) =>
		elements.map((element) => {
			const rect = element.getBoundingClientRect();
			return { y: rect.y, height: rect.height };
		}),
	);
	for (const box of boxes) {
		expect(box.y).toBeCloseTo(boxes[0].y, 0);
		expect(box.height).toBeCloseTo(boxes[0].height, 0);
	}
	const hide = toolbar.getByRole('button', { name: 'Hide Slide', exact: true });
	await expect(hide).toHaveAttribute('aria-pressed', 'false');
	await hide.focus();
	await page.keyboard.press('Space');
	await expect(hide).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Enter');
	await expect(hide).toHaveAttribute('aria-pressed', 'false');
	const subtitles = toolbar.getByRole('checkbox', { name: 'Subtitles', exact: true });
	await expect(subtitles).not.toBeChecked();
	await subtitles.focus();
	await page.keyboard.press('Space');
	await expect(subtitles).toBeChecked();
	await toolbar.getByRole('tab', { name: 'Home', exact: true }).click();
	await toolbar.getByRole('tab', { name: 'Slide Show', exact: true }).click();
	await expect(subtitles).toBeChecked();
	// Public customization markers must still hide the inner native command.
	const command = toolbar.locator('[data-ribbon-control="slideShow.setUp.hideSlide"]');
	await command.evaluate((element) => ((element as HTMLElement).style.display = 'none'));
	await expect(hide).not.toBeVisible();
	await command.evaluate((element) => (element as HTMLElement).style.removeProperty('display'));
	await expect(hide).toBeVisible();
	const shot = testInfo.outputPath('slide-show-ribbon.png');
	await toolbar.screenshot({ path: shot });
	await testInfo.attach('slide-show-ribbon', { path: shot, contentType: 'image/png' });
});
