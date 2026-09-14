/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { fixture, loadDeck } from './support/deck';

declare global {
	interface Window {
		webfontEditProbe: {
			link: Element;
			changes: string[];
			observer: MutationObserver;
		};
	}
}

test('drag/drop and text blur retain the loaded font stylesheet', async ({ page }) => {
	await page.route('**/fonts.googleapis.com/css2**', (route) =>
		route.fulfill({
			contentType: 'text/css',
			body: '@font-face { font-family: "ADLaM Display"; src: local("Arial"); }',
		}),
	);
	await loadDeck(page, fixture('adlam-webfont.pptx'));
	const fontLink = page.locator('head link[href*="fonts.googleapis.com/css2"]');
	await expect(fontLink).toHaveCount(1);
	await expect
		.poll(() =>
			page.evaluate(() =>
				[...document.fonts].some((font) => font.family.replace(/"/gu, '') === 'ADLaM Display'),
			),
		)
		.toBe(true);
	await page.evaluate(() => document.fonts.ready);
	await fontLink.evaluate((link) => {
		const changes: string[] = [];
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				if (record.target === link) {
					changes.push('stylesheet attribute changed');
				}
				if ([...record.removedNodes].includes(link)) {
					changes.push('stylesheet removed');
				}
			}
		});
		observer.observe(document.head, { childList: true, attributes: true, subtree: true });
		window.webfontEditProbe = { link, changes, observer };
	});

	const element = page.locator('[data-pptx-element="true"]').filter({ hasText: 'Box A' }).first();
	const box = (await element.boundingBox())!;
	const x = box.x + box.width / 3;
	const y = box.y + box.height - 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + 35, y + 35, { steps: 12 });
	await page.mouse.up();
	await expect.poll(async () => (await element.boundingBox())!.x).toBeGreaterThan(box.x + 20);
	// Allow async font resolution and a potential reload to complete.
	await page.waitForTimeout(300);
	expect(await page.evaluate(() => window.webfontEditProbe.changes)).toEqual([]);

	await element.dblclick();
	await expect(page.locator('[data-inline-editor]')).toBeVisible();
	await page.keyboard.press('End');
	await page.keyboard.type(' edited');
	const stage = (await page.locator('[aria-roledescription="slide"]').first().boundingBox())!;
	await page.mouse.click(stage.x + stage.width * 0.5, stage.y + stage.height * 0.9);
	await expect(page.locator('[data-inline-editor]')).toBeHidden();
	await expect(element).toContainText('edited');
	await page.waitForTimeout(300);
	expect(
		await page.evaluate(() => {
			const { link, changes, observer } = window.webfontEditProbe;
			observer.disconnect();
			return { changes, connected: link.isConnected };
		}),
	).toEqual({ changes: [], connected: true });
});
