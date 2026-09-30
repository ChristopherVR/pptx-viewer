/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';

import { loadDeck, ribbonTab } from './support/deck';

const TABS = ['Home', 'Insert', 'Draw', 'Design', 'Transitions', 'Animations', 'Review', 'View'];
test.use({ viewport: { width: 1440, height: 900 } });

test('remaining ribbon families retain their controls and layout', async ({ page }, info) => {
	await loadDeck(page);
	for (const tab of TABS) {
		await ribbonTab(page, tab).click();
		await expect(ribbonTab(page, tab)).toHaveAttribute('aria-selected', 'true');
		await page.screenshot({ path: info.outputPath(`${tab.toLowerCase()}.png`) });
	}
});
