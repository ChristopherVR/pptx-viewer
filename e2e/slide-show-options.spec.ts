/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';

test('Slide Show options share layout, label activation, keyboard and persisted host state', async ({
	page,
}, testInfo) => {
	await loadDeck(page);
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const tab = toolbar.getByRole('tab', { name: 'Slide Show', exact: true });
	await tab.click();
	const options = toolbar.locator('pptx-ui-slide-show-options');
	await expect(options).toBeVisible();
	const timings = options.getByRole('checkbox', { name: 'Using timings, if present', exact: true });
	const narration = options.getByRole('checkbox', { name: 'Play Narrations', exact: true });
	await expect(timings).toBeChecked();
	await expect(narration).toBeChecked();
	await expect(options.getByRole('checkbox', { name: 'Keep Slides Updated' })).toBeDisabled();
	await expect(options.getByRole('checkbox', { name: 'Show Media Controls' })).toBeDisabled();
	const timingBox = (await timings.boundingBox())!;
	const narrationBox = (await narration.boundingBox())!;
	expect(narrationBox.x).toBeCloseTo(timingBox.x, 0);
	expect(narrationBox.y).toBeGreaterThan(timingBox.y + timingBox.height);
	await timings.focus();
	await page.keyboard.press('Space');
	await expect(timings).not.toBeChecked();
	// Label activation must produce one edit, including through nested shadow roots.
	await options.getByText('Play Narrations', { exact: true }).click();
	await expect(narration).not.toBeChecked();
	await toolbar.getByRole('tab', { name: 'Home', exact: true }).click();
	await tab.click();
	await expect(timings).not.toBeChecked();
	await expect(narration).not.toBeChecked();
	const screenshot = testInfo.outputPath('slide-show-options.png');
	await options.screenshot({ path: screenshot });
	await testInfo.attach('slide-show-options', { path: screenshot, contentType: 'image/png' });
});
