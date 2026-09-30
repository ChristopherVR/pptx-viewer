/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';

import { COMPOSE_BOX_SELECTOR, commentTextVisible } from './support/comments';
import { loadDeck, ribbonTab } from './support/deck';
import { optionsDialog } from './support/settings-dialog';

test.use({ viewport: { width: 1440, height: 900 } });

test('Review commands preserve proofing state, focus and native Language workflow', async ({
	page,
}, info) => {
	await loadDeck(page);
	await ribbonTab(page, 'Review').click();
	const section = page.locator('pptx-ui-ribbon-section');
	await expect(section.locator('pptx-ui-ribbon-group')).toHaveCount(7);
	const spelling = section
		.locator('[data-ribbon-control="review.proofing.spelling"]')
		.getByRole('button');
	const previous = await spelling.getAttribute('aria-pressed');
	await spelling.focus();
	await spelling.press('Space');
	await expect(spelling).toHaveAttribute('aria-pressed', String(previous !== 'true'));
	await expect(spelling).toBeFocused();
	await spelling.press('Space');
	await expect(spelling).toHaveAttribute('aria-pressed', previous!);
	await expect(
		section
			.locator('[data-ribbon-group="review.ink"] [data-ribbon-control="review.ink.hideInk"]')
			.getByRole('button'),
	).toBeDisabled();
	await page.screenshot({ path: info.outputPath('review-after.png') });
	await section
		.locator('[data-ribbon-control="review.language.language"]')
		.getByRole('button')
		.click();
	await expect(optionsDialog(page, ['Options'])).toBeVisible();
});

test('Review Language and Ink honor public customization IDs', async ({ page }) => {
	const customization = {
		ribbon: { hiddenButtons: ['review.language.language'], hiddenGroups: ['review.ink'] },
	};
	await loadDeck(
		page,
		undefined,
		`/?customization=${encodeURIComponent(JSON.stringify(customization))}`,
	);
	await ribbonTab(page, 'Review').click();
	await expect(page.locator('[data-ribbon-control="review.language.language"]')).toBeHidden();
	await expect(page.locator('[data-ribbon-group="review.ink"]')).toBeHidden();
	await expect(
		page.locator('[data-ribbon-control="review.proofing.spelling"]').getByRole('button'),
	).toBeVisible();
});

test('Review Show Comments reaches the native composer and commits a comment', async ({ page }) => {
	await loadDeck(page);
	await ribbonTab(page, 'Review').click();
	await page
		.locator('[data-ribbon-control="review.comments.showComments"]')
		.getByRole('button')
		.click();
	const compose = page.locator(COMPOSE_BOX_SELECTOR).first();
	await expect(compose).toBeVisible();
	await compose.fill('Review shared command integration');
	await page.getByRole('button', { name: 'Add Comment', exact: true }).last().click();
	await expect
		.poll(() => commentTextVisible(page, 'Review shared command integration'))
		.toBeTruthy();
});
