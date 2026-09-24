/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A table row that auto-grows past its authored frame must not be clipped,
 * run identically against every framework demo.
 *
 * FIXTURE (`e2e/fixtures/table-row-autogrow.pptx`) is PowerPoint 16.0's own
 * output, built over COM. Slide 5's table has a long-wrapping paragraph in
 * R2C1 and a 28pt run in R3C2, both of which need more vertical room than
 * their row's authored `a:tr/@h`; PowerPoint grows those rows (and the
 * table's own `a:ext/@cy`) to fit rather than clipping them.
 *
 * `a:tr/@h` is a MINIMUM row height, not a fixed one, and the authored
 * `a:ext/@cy` on the table's `graphicFrame` is a cache of the last-computed
 * row-height sum, not a hard clip. Before the fix, the element container was
 * sized to that cached `a:ext/@cy` with `overflow: hidden`, so once a row
 * grew taller than the deck's last save, however many trailing rows no
 * longer fit were clipped clean off (R3 and R4 vanished).
 */
import { test, expect } from '@playwright/test';

import { fixture, loadDeck, slideStage, thumbnail } from './support/deck';

const FIXTURE = fixture('table-row-autogrow.pptx');

test('a table whose rows auto-grow past the authored frame renders every row, uncropped', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await loadDeck(page, FIXTURE);
	await thumbnail(page, 5).click();

	const stage = slideStage(page);
	// R4 is the last row: if it is visible and inside its element wrapper's
	// box, no trailing row was clipped off.
	const lastRowCell = stage.getByText('R4 C1', { exact: true });
	await expect(lastRowCell).toBeVisible();

	// Sanity: the tall-font row PowerPoint deliberately grows this table for
	// is also on screen (rules out a false pass from a table that just never
	// clipped because nothing actually grew).
	await expect(stage.getByText('R3 C2', { exact: true })).toBeVisible();

	const cellBox = await lastRowCell.boundingBox();
	expect(cellBox).not.toBeNull();

	// Measure the wrapper that actually holds this cell. A page-wide
	// `[data-element-id=...]` lookup is ambiguous: the slide rail's
	// thumbnail renders the same element id, and in vanilla that thumbnail
	// copy comes first in the DOM, so `.first()` measured the (smaller)
	// thumbnail wrapper instead of the stage one.
	const containerBox = await lastRowCell.evaluate((el) => {
		const wrapper = el.closest('[data-element-id]');
		if (!wrapper) {
			return null;
		}
		const rect = wrapper.getBoundingClientRect();
		return { y: rect.y, height: rect.height };
	});
	expect(containerBox).not.toBeNull();

	// The last row's cell must end at or before the bottom of the element
	// wrapper that positions the table: a wrapper clipped to the authored
	// (pre-growth) frame height would put the cell's bottom edge below it.
	const cellBottom = cellBox!.y + cellBox!.height;
	const containerBottom = containerBox!.y + containerBox!.height;
	expect(cellBottom).toBeLessThanOrEqual(containerBottom + 1);
});
