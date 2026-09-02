/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * "Recent colours": one MRU list, shown under every colour picker.
 *
 * PowerPoint remembers the last colours a user picked (`p:clrMru` in
 * `presentation.xml`) and offers them as a "Recent Colors" row in every colour
 * dropdown. The viewer models that list once per deck (shared
 * `render/recent-colors.ts`) and every binding is expected to:
 *
 *   - render the row (`data-testid="pptx-color-recent"`) under the inspector's
 *     fill and stroke pickers, most-recent first, one button per colour whose
 *     `title` is the hex;
 *   - hide the row while the list is empty;
 *   - push a colour into the list when a picker COMMITS (the `change` event,
 *     not the continuous `input` stream a native colour input emits while the
 *     user drags), so that a colour picked for a fill appears under the stroke
 *     picker too;
 *   - move a colour to the front when it is picked again, whether through a
 *     picker or by clicking its recent swatch.
 *
 * Each binding used to wire a different subset of pickers to its list, so the
 * feature was at parity nowhere. This spec drives the two pickers every
 * binding has (fill and stroke) and asserts the row contract through the same
 * `data-testid` in all five demos.
 *
 * Run: bunx playwright test recent-colors
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, inspector, loadDeck } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

/** Two plain filled shapes ("SOURCE" / "TARGET"), no text-only elements. */
const DECK = fixture('format-painter.pptx');

const RED = '#ff0000';
const BLUE = '#0000ff';

/**
 * Every recent-colours row currently SHOWN inside the inspector. "Hidden while
 * empty" is satisfied two ways (four bindings unmount the row, vanilla keeps
 * it attached with `hidden` set), so only visibility is the contract.
 */
function recentRows(page: Page): Locator {
	return inspector(page).getByTestId('pptx-color-recent').filter({ visible: true });
}

/** The hexes one recent-colours row shows, most-recent first. */
async function rowColors(row: Locator): Promise<string[]> {
	return row
		.locator('button')
		.evaluateAll((buttons) =>
			buttons.map((button) => (button.getAttribute('title') ?? '').toLowerCase()),
		);
}

/**
 * The inspector's native colour inputs, in document order: for a shape the
 * fill picker comes first and the stroke picker after it in every binding.
 */
function colorInputs(page: Page): Locator {
	return inspector(page).locator('input[type="color"]:visible');
}

/**
 * Commit a colour through a native `<input type="color">` the way the picker
 * does when the user closes the swatch dialog: set the value and fire
 * `input` then `change`. The value is written through the prototype setter so
 * React's value tracker sees a real change rather than swallowing the event.
 */
async function pickColor(input: Locator, hex: string): Promise<void> {
	await input.evaluate((element, value) => {
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
		setter?.call(element, value);
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
	}, hex);
}

async function selectSourceShape(page: Page): Promise<void> {
	const source = page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
	await source.waitFor();
	await source.click();
	await expect(colorInputs(page).first()).toBeVisible();
}

test.describe('recent colours', () => {
	test('the row is hidden until a picker commits, then lists the pick under fill AND stroke', async ({
		page,
	}) => {
		await loadDeck(page, DECK);
		await selectSourceShape(page);

		// The fixture authors no `p:clrMru`, so nothing has been picked yet.
		await expect(recentRows(page)).toHaveCount(0);

		await pickColor(colorInputs(page).first(), RED);

		// The fill picker's own row and the stroke picker's row read the same
		// list: a colour picked once is offered everywhere.
		await expect.poll(() => recentRows(page).count()).toBeGreaterThanOrEqual(2);
		const rows = recentRows(page);
		const count = await rows.count();
		for (let index = 0; index < count; index += 1) {
			const row = rows.nth(index);
			await expect(row).toBeVisible();
			expect(await rowColors(row)).toStrictEqual([RED]);
			await expect(row.locator('button').first()).toHaveAttribute(
				'aria-label',
				new RegExp(`^Recent ${RED}$`, 'iu'),
			);
		}
	});

	test('a second pick goes to the front, and re-picking a swatch moves it back to the front', async ({
		page,
	}) => {
		await loadDeck(page, DECK);
		await selectSourceShape(page);

		await pickColor(colorInputs(page).first(), RED);
		// Commit the second colour through the STROKE picker: the list is one
		// per deck, not one per picker.
		await pickColor(colorInputs(page).nth(1), BLUE);

		await expect.poll(async () => rowColors(recentRows(page).first())).toStrictEqual([BLUE, RED]);

		// Clicking the older swatch commits it again, so it becomes the most
		// recent pick and the row reorders rather than growing a duplicate.
		await recentRows(page).first().locator(`button[title="${RED}" i]`).click();
		await expect.poll(async () => rowColors(recentRows(page).first())).toStrictEqual([RED, BLUE]);
	});
});
