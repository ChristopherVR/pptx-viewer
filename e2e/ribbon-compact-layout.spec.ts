/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { test, expect } from '@playwright/test';

import { loadDeck } from './support/deck';

for (const width of [820, 1280]) {
	test.describe(`compact ribbon at ${width}px`, () => {
		test.use({ viewport: { width, height: 800 } });

		for (const [tab, commands] of [
			['Design', ['Browse Themes', 'Edit Theme', 'Slide Size', 'Format Background']],
			['Insert', ['Text Box', 'Image', 'Media', 'Table', 'SmartArt', 'Equation']],
			['Transitions', ['Preview', 'Apply to All']],
		] as const) {
			test(`${tab} commands retain compact height and alignment`, async ({ page }, testInfo) => {
				await loadDeck(page);
				const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
				await toolbar.getByRole('tab', { name: tab, exact: true }).click();
				for (const name of commands) {
					const command = toolbar.getByRole('button', { name, exact: true });
					await expect(command).toBeVisible();
					const box = await command.boundingBox();
					expect(box!.height, `${name} must not stretch to the ribbon height`).toBeLessThanOrEqual(
						36,
					);
					expect(box!.height).toBeGreaterThanOrEqual(24);
					if (tab === 'Design') {
						const tabs = await toolbar.getByRole('tablist').boundingBox();
						const ribbon = await toolbar.boundingBox();
						const rowCenter = (tabs!.y + tabs!.height + ribbon!.y + ribbon!.height) / 2;
						expect(
							Math.abs(box!.y + box!.height / 2 - rowCenter),
							`${name} must be vertically centered`,
						).toBeLessThanOrEqual(3);
					}
				}
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
				);
				expect(
					overflow,
					'ribbon must scroll internally without widening the page',
				).toBeLessThanOrEqual(1);
				await page.screenshot({ path: testInfo.outputPath(`${tab}.png`) });
			});
		}
	});
}
