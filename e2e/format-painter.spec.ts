/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/format-painter.pptx', import.meta.url)),
);

// The painter button exposes a framework-neutral `data-active` attribute
// (`"true"` when armed, `"false"` otherwise) so this spec runs unchanged across
// React / Vue / Angular instead of asserting a framework-specific CSS class.

/**
 * Uploads the fixture deck and waits for the viewer to render both shapes.
 * Returns the locators we operate on across every test.
 */
async function openFixture(page: Page): Promise<{
	painter: Locator;
	source: Locator;
	target: Locator;
	canvas: Locator;
}> {
	await page.goto('/');

	// The drop zone is the only thing rendered before any deck is loaded; it
	// owns the hidden #file-input.
	await page.locator('#file-input').setInputFiles(fixturePath);

	// Wait for the canvas + both shapes to appear.
	const source = page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
	const target = page.locator('[data-pptx-element="true"]').filter({ hasText: 'TARGET' });
	await source.waitFor();
	await target.waitFor();

	const painter = page.getByTestId('format-painter-toggle').first();
	const canvas = page.locator('[aria-roledescription="slide"]').first();
	return { painter, source, target, canvas };
}

/**
 * Read the background-color the React layer wrote to the shape's container.
 * The shape renderer spreads shapeVisualStyle (which includes the resolved
 * fill) onto the container's inline style; we read the computed RGB so the
 * assertion is independent of how the value was authored.
 */
async function getShapeFill(shape: Locator): Promise<string> {
	return shape.evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe('format painter', () => {
	test('button is disabled until an element with copyable format is selected', async ({ page }) => {
		const { painter, source } = await openFixture(page);

		await expect(painter).toBeDisabled();

		await source.click();
		await expect(painter).toBeEnabled();
	});

	test('clicking painter then a target copies the fill from source to target', async ({ page }) => {
		const { painter, source, target } = await openFixture(page);

		const initialTargetFill = await getShapeFill(target);
		expect(initialTargetFill).not.toBe('rgb(255, 0, 0)');

		await source.click();
		await painter.click();
		await expect(painter).toHaveAttribute('data-active', 'true');

		await target.click();

		await expect(painter).toHaveAttribute('data-active', 'false');
		await expect.poll(async () => getShapeFill(target), { timeout: 5_000 }).toBe('rgb(255, 0, 0)');
	});

	test('Escape cancels the painter without applying', async ({ page }) => {
		const { painter, source, target } = await openFixture(page);

		const initialTargetFill = await getShapeFill(target);

		await source.click();
		await painter.click();
		await expect(painter).toHaveAttribute('data-active', 'true');

		await page.keyboard.press('Escape');
		await expect(painter).toHaveAttribute('data-active', 'false');

		// Now clicking the target should just select it, not apply the fill.
		await target.click();
		await expect.poll(async () => getShapeFill(target)).toBe(initialTargetFill);
	});

	test('clicking empty canvas cancels the painter', async ({ page }) => {
		const { painter, source, target } = await openFixture(page);

		await source.click();
		await painter.click();
		await expect(painter).toHaveAttribute('data-active', 'true');

		// Click well outside both shapes — there's a wide empty band between
		// SOURCE (right edge ≈ 300px) and TARGET (left edge ≈ 500px) on the
		// 960×540 canvas. Click in the gap, which the canvas captures as
		// empty-stage mousedown.
		const sourceBox = await source.boundingBox();
		const targetBox = await target.boundingBox();
		if (!sourceBox || !targetBox) {
			throw new Error('missing bounding boxes');
		}
		const midX = (sourceBox.x + sourceBox.width + targetBox.x) / 2;
		const midY = sourceBox.y + sourceBox.height / 2;
		await page.mouse.click(midX, midY);

		await expect(painter).toHaveAttribute('data-active', 'false');
	});
});
