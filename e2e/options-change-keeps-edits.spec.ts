/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A viewer preference flip must not touch the deck.
 *
 * The title-bar AutoSave switch (and every ribbon View toggle and Options
 * dialog field) writes the shared Options store. One binding's load effect
 * happened to read that store synchronously, so it tracked it: every option
 * change re-parsed the original bytes and re-seeded the editor from them,
 * which threw away unsaved edits and the undo history, jumped back to slide 1,
 * and on a slow machine blocked the main thread for seconds while it did so.
 * The other four bindings were unaffected, so this is asserted for all five.
 */
import { expect, test } from '@playwright/test';

import { elementWithText, fixture, loadDeck, selectElement, slideElements } from './support/deck';
import { pressShortcut } from './support/keyboard';

test.use({ viewport: { width: 1440, height: 900 } });

/** A one-slide deck holding exactly two shapes, "SOURCE" and "TARGET". */
const TWO_SHAPES = fixture('format-painter.pptx');

test('toggling AutoSave keeps an unsaved edit on the canvas', async ({ page }) => {
	await loadDeck(page, TWO_SHAPES);
	await selectElement(page, elementWithText(page, 'SOURCE'));
	await pressShortcut(page, 'Delete', 800);
	await expect(slideElements(page), 'the deletion landed').toHaveCount(1);

	const toggle = page.locator('[role="switch"]').first();
	await expect(toggle).toHaveCount(1);
	const before = await toggle.getAttribute('aria-checked');
	await toggle.click({ force: true });
	await expect
		.poll(async () => toggle.getAttribute('aria-checked'), { timeout: 5000 })
		.not.toBe(before);

	// Long enough for a deck reload to have replaced the canvas if one ran.
	await page.waitForTimeout(2500);
	await expect(
		slideElements(page),
		'a preference flip must not reload the deck and resurrect the deleted shape',
	).toHaveCount(1);
});
