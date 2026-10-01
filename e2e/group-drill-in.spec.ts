/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Selecting inside a group, the way PowerPoint does, in every binding:
 *
 *   - the first click on a group selects the group;
 *   - with the group selected, a click selects the member under the pointer;
 *   - a click on the selected member's text opens the editor with the caret
 *     where the click landed (in the card's title, not after its last word);
 *   - a double-click on a group goes straight to the member's text (caret at
 *     the end, the double-click contract `desktop-manipulation` pins);
 *   - Escape steps back out: member, then group, then nothing.
 *
 * The selection is read from the chrome every binding draws -- the "Resize nw"
 * and "Resize se" handles -- so the spec measures what the user sees: a frame
 * the size of the group, then the size of one card.
 *
 * Fixture: `group-drill.pptx` (a "Cards" group of two titled cards; see
 * `fixtures/generate-group-drill-fixture.ts`).
 *
 * Run: bunx playwright test group-drill-in
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeck, slideElements, slideStage, viewport } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('group-drill.pptx');
/** Screen px of slack for handle centres versus the shape's box. */
const TOLERANCE = 10;

async function openDeck(page: Page): Promise<void> {
	await loadDeck(page, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

/** A card's rendered node (grouped children keep their `data-element-id`). */
function card(page: Page, title: string): Locator {
	return slideElements(page).filter({ hasText: title }).last();
}

/** The selection frame, from its corner handles; null when nothing is selected. */
async function selectionBox(page: Page): Promise<{ width: number; height: number } | null> {
	const handle = (corner: string) =>
		viewport(page)
			.getByRole('button', { name: new RegExp(`^resize ${corner}$`, 'iu') })
			.first();
	if ((await handle('nw').count()) === 0 || !(await handle('nw').isVisible())) {
		return null;
	}
	const nw = (await handle('nw').boundingBox())!;
	const se = (await handle('se').boundingBox())!;
	return {
		width: se.x + se.width / 2 - (nw.x + nw.width / 2),
		height: se.y + se.height / 2 - (nw.y + nw.height / 2),
	};
}

async function expectSelectionLike(page: Page, target: Locator): Promise<void> {
	const box = (await target.boundingBox())!;
	await expect
		.poll(async () => {
			const sel = await selectionBox(page);
			return sel
				? Math.max(Math.abs(sel.width - box.width), Math.abs(sel.height - box.height))
				: Infinity;
		})
		.toBeLessThan(TOLERANCE);
}

/**
 * Two separate clicks on one spot, the way a person selects the group and then
 * the card: paused past the double-click interval, or the browser would read
 * them as a double-click (which edits the card instead).
 */
async function clickTwice(page: Page, at: { x: number; y: number }): Promise<void> {
	await page.mouse.click(at.x, at.y);
	await page.waitForTimeout(700);
	await page.mouse.click(at.x, at.y);
}

/** A point inside a node's box, as fractions of it. */
async function pointIn(target: Locator, fx: number, fy: number): Promise<{ x: number; y: number }> {
	const box = (await target.boundingBox())!;
	return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

/** The group node: the outermost element holding both cards (it comes first in document order). */
function group(page: Page): Locator {
	return slideElements(page).filter({ hasText: 'Scale' }).filter({ hasText: 'Migration' }).first();
}

/** The first line of the open editor's text (a textarea's value, or a contenteditable's rendered lines). */
async function editorFirstLine(page: Page): Promise<string> {
	const text = await editor(page).evaluate((el) =>
		el instanceof HTMLTextAreaElement ? el.value : (el as HTMLElement).innerText,
	);
	return text.split('\n')[0] ?? '';
}

/** The open inline editor, whichever element a binding uses (the shared `data-inline-editor` hook). */
function editor(page: Page): Locator {
	return page.locator('[data-inline-editor]');
}

test.describe('selecting inside a group', () => {
	test('first click selects the group, the next selects the card under the pointer', async ({
		page,
	}) => {
		await openDeck(page);
		const scale = await pointIn(card(page, 'Scale'), 0.5, 0.75);
		await page.mouse.click(scale.x, scale.y);
		await expectSelectionLike(page, group(page));
		await page.waitForTimeout(700);
		await page.mouse.click(scale.x, scale.y);
		await expectSelectionLike(page, card(page, 'Scale'));
		// Another card of the entered group.
		const migration = await pointIn(card(page, 'Migration'), 0.5, 0.75);
		await page.mouse.click(migration.x, migration.y);
		await expectSelectionLike(page, card(page, 'Migration'));
	});

	test("a click on the selected card's title puts the caret in the title", async ({ page }) => {
		await openDeck(page);
		const body = await pointIn(card(page, 'Scale'), 0.5, 0.75);
		await clickTwice(page, body);
		await expectSelectionLike(page, card(page, 'Scale'));
		const title = card(page, 'Scale').getByText('Scale', { exact: true });
		const inTitle = await pointIn(title, 0.5, 0.5);
		await page.waitForTimeout(700);
		await page.mouse.click(inTitle.x, inTitle.y);
		await expect(editor(page)).toBeVisible();
		// Typed where the click landed: inside the title's first line, not after the body.
		await page.keyboard.type('#');
		await expect.poll(() => editorFirstLine(page)).toContain('#');
	});

	test('a double-click on a group edits the card under the pointer', async ({ page }) => {
		await openDeck(page);
		const title = card(page, 'Migration').getByText('Migration', { exact: true });
		const at = await pointIn(title, 0.5, 0.5);
		await page.mouse.dblclick(at.x, at.y);
		await expect(editor(page)).toBeVisible();
		await expect
			.poll(() =>
				editor(page).evaluate((el) =>
					el instanceof HTMLTextAreaElement ? el.value : (el as HTMLElement).innerText,
				),
			)
			.toContain('Migration');
	});

	test('Escape steps out: card, then group, then nothing', async ({ page }) => {
		await openDeck(page);
		const scale = await pointIn(card(page, 'Scale'), 0.5, 0.75);
		await clickTwice(page, scale);
		await expectSelectionLike(page, card(page, 'Scale'));
		await page.keyboard.press('Escape');
		await expectSelectionLike(page, group(page));
		await page.keyboard.press('Escape');
		await expect.poll(() => selectionBox(page)).toBeNull();
	});
});
