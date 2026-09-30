/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';
import { collectRibbonInventory } from './support/ribbon-controls';

test.use({ viewport: { width: 1440, height: 900 } });

test('Help ribbon retains settings, shortcuts and accessibility commands', async ({
	page,
}, testInfo) => {
	await loadDeck(page);
	const inventory = await collectRibbonInventory(page, ['Help']);
	expect(inventory[0].controls.map((control) => control.name).sort()).toEqual(
		['Settings', 'Keyboard Shortcuts', 'Accessibility Check'].sort(),
	);
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const group = toolbar.locator('pptx-ui-ribbon-group[data-ribbon-group="help.help"]');
	await expect(group.locator('pptx-ui-ribbon-command')).toHaveCount(3);
	expect(
		await group
			.locator('pptx-ui-ribbon-command')
			.evaluateAll((hosts) => hosts.map((host) => host.getAttribute('data-ribbon-control'))),
	).toEqual(['help.help.options', 'help.help.keyboardShortcuts', 'help.help.accessibility']);
	const settings = group.getByRole('button', { name: 'Settings', exact: true });
	await group.evaluate((element) => {
		(element as HTMLElement).style.setProperty('--pptx-foreground', '#123456');
		element.setAttribute('data-requests', '0');
		element.addEventListener('command-request', () =>
			element.setAttribute(
				'data-requests',
				String(Number(element.getAttribute('data-requests')) + 1),
			),
		);
	});
	await expect(settings).toHaveCSS('color', 'rgb(18, 52, 86)');
	await page.keyboard.press('Tab');
	await settings.focus();
	await expect(settings).toHaveCSS('outline-style', 'solid');
	await page.keyboard.press('Space');
	await expect(group).toHaveAttribute('data-requests', '1');
	await expect(page.getByRole('dialog').first()).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	const accessibility = group.locator('[data-ribbon-control="help.help.accessibility"]');
	await accessibility.evaluate((element) => ((element as HTMLElement).style.display = 'none'));
	await expect(group.getByRole('button', { name: 'Accessibility Check' })).not.toBeVisible();
	await accessibility.evaluate((element) =>
		(element as HTMLElement).style.removeProperty('display'),
	);
	await expect(group.getByRole('button', { name: 'Accessibility Check' })).toBeVisible();
	await group.evaluate((element) =>
		(element as HTMLElement).style.removeProperty('--pptx-foreground'),
	);
	const shot = testInfo.outputPath('help-ribbon.png');
	await toolbar.screenshot({ path: shot });
	await testInfo.attach('help-ribbon', { path: shot, contentType: 'image/png' });
});

test.describe('Help touch targets', () => {
	test.use({ hasTouch: true });
	test('commands keep labels inside distinct 44px targets', async ({ page }) => {
		await loadDeck(page);
		await collectRibbonInventory(page, ['Help']);
		const group = page.locator('pptx-ui-ribbon-group[data-ribbon-group="help.help"]');
		const buttons = group.getByRole('button');
		for (const button of await buttons.all()) {
			expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
			const fits = await button.evaluate((element) => element.scrollWidth <= element.clientWidth);
			expect(fits).toBe(true);
		}
		await buttons.first().tap();
		await expect(page.getByRole('dialog').first()).toBeVisible();
	});
});
