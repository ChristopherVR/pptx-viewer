/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { test, expect } from '@playwright/test';

import { loadDeck } from './support/deck';

// Insert needs about 900px; narrower windows collapse its right-hand groups into popup buttons.
for (const width of [1000, 1280]) {
	test.describe(`compact ribbon at ${width}px`, () => {
		test.use({ viewport: { width, height: 800 } });

		for (const [tab, commands, large] of [
			['Design', ['Browse Themes', 'Edit Theme', 'Slide Size', 'Format Background'], true],
			['Insert', ['Text Box', 'Image', 'Media', 'Table', 'SmartArt', 'Equation'], true],
			['Transitions', ['Apply to All'], false],
		] as const) {
			test(`${tab} commands keep their Office size and alignment`, async ({ page }, testInfo) => {
				await loadDeck(page);
				const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
				await toolbar.getByRole('tab', { name: tab, exact: true }).click();
				for (const name of commands) {
					const command = toolbar.getByRole('button', { name, exact: true });
					await expect(command).toBeVisible();
					const box = await command.boundingBox();
					// Large commands are Office's 66px glyph-over-caption tiles; the rest stay 24-36px rows.
					expect(box!.height, `${name} must not stretch to the ribbon height`).toBeLessThanOrEqual(
						large ? 66 : 36,
					);
					expect(box!.height).toBeGreaterThanOrEqual(large ? 66 : 24);
				}
				if (tab === 'Transitions') {
					// Preview is a large (icon above label) command, as in PowerPoint.
					const preview = await toolbar
						.getByRole('button', { name: 'Preview', exact: true })
						.boundingBox();
					expect(preview!.height).toBeGreaterThanOrEqual(44);
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
