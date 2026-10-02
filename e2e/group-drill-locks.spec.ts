/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Group drill-in respects shape locks, in every binding.
 *
 * `group-drill-locks.pptx` is the "Cards" group of `group-drill-in` with its
 * left card ("Pinned") authored `a:spLocks noSelect="1"`. PowerPoint will not
 * select such a shape, so neither a click nor a double-click on the group may
 * drill into it (or open its text for editing); the unlocked card ("Open")
 * still drills as usual.
 *
 * A group's own `noDrilldown` has no on-disk form (`a:grpSpLocks` does not
 * declare it; only `a:graphicFrameLocks` does), so that half of the contract
 * is pinned by the shared and per-binding unit tests instead.
 *
 * Fixture: `group-drill-locks.pptx` (see `fixtures/generate-group-drill-locks-fixture.ts`).
 *
 * Run: bunx playwright test group-drill-locks
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeck, slideElements, slideStage, viewport } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('group-drill-locks.pptx');
/** Screen px of slack for handle centres versus the shape's box. */
const TOLERANCE = 10;

async function openDeck(page: Page): Promise<void> {
	await loadDeck(page, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

function card(page: Page, title: string): Locator {
	return slideElements(page).filter({ hasText: title }).last();
}

/** The group node: the outermost element holding both cards (first in document order). */
function group(page: Page): Locator {
	return slideElements(page).filter({ hasText: 'Pinned' }).filter({ hasText: 'Open' }).first();
}

/** The selection frame from its corner handles; null when nothing is selected. */
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

async function pointIn(target: Locator, fx: number, fy: number): Promise<{ x: number; y: number }> {
	const box = (await target.boundingBox())!;
	return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

function editor(page: Page): Locator {
	return page.locator('[data-inline-editor]');
}

test.describe('group drill-in and locks', () => {
	test('a click never drills into a noSelect card, the unlocked card still does', async ({
		page,
	}) => {
		await openDeck(page);
		const pinned = await pointIn(card(page, 'Pinned'), 0.5, 0.75);
		await page.mouse.click(pinned.x, pinned.y);
		await expectSelectionLike(page, group(page));
		await page.waitForTimeout(700);
		await page.mouse.click(pinned.x, pinned.y);
		await page.waitForTimeout(300);
		// Still the whole group: the locked card was not entered.
		await expectSelectionLike(page, group(page));
		await expect(editor(page)).toHaveCount(0);
		// The unlocked sibling drills as usual.
		const open = await pointIn(card(page, 'Open'), 0.5, 0.75);
		await page.waitForTimeout(700);
		await page.mouse.click(open.x, open.y);
		await expectSelectionLike(page, card(page, 'Open'));
	});

	test('a double-click on a noSelect card neither selects it nor opens its text', async ({
		page,
	}) => {
		await openDeck(page);
		const title = card(page, 'Pinned').getByText('Pinned', { exact: true });
		const at = await pointIn(title, 0.5, 0.5);
		await page.mouse.dblclick(at.x, at.y);
		await page.waitForTimeout(300);
		await expect(editor(page)).toHaveCount(0);
		const sel = await selectionBox(page);
		if (sel) {
			// If anything is selected it is the group, not the pinned card.
			await expectSelectionLike(page, group(page));
		}
	});
});
