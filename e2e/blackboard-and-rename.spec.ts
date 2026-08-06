/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Blackboard mode and selection-pane rename, in all five bindings.
 *
 * Blackboard: the show toolbar's one-click action must arm the black screen
 * AND the pen together, and ink drawn on that black screen must be visible,
 * which means the annotation overlay has to stack ABOVE the blackout sheet.
 * Historically every binding drew local ink underneath the blackout (the
 * pointer was captured, the stroke painted invisibly), so the stacking probe
 * here is the regression test for that class of bug. The layering rule lives
 * in `pptx-viewer-shared`'s `render/presentation-blackboard.ts`; the neutral
 * hooks are `data-pptx-annotation-overlay` (the element carrying the
 * overlay's z-index) and `data-pptx-blackout` (the blackout sheet).
 *
 * Rename: the selection pane's rows are renamable in place (double-click the
 * name, Enter commits, Escape cancels), the commit routes through each
 * binding's history-integrated update path, and undo restores the old name.
 * Neutral hooks: `data-pptx-selection-pane` (pane root) and
 * `data-pptx-selection-name` (each row's name label).
 *
 * Run: bunx playwright test blackboard-and-rename
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeckAt, openRibbonTab, SAMPLE_DECK } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

/** Start the slide show and wake the auto-hiding toolbar. */
async function startShow(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(1200);
	await page.mouse.move(720, 870);
	await page.mouse.move(721, 868);
	await page.waitForTimeout(400);
}

/**
 * The effective stacking level of `selector`: its own computed z-index, or the
 * nearest ancestor's numeric z-index when its own is `auto`. Both hooks sit in
 * the same stacking context in every binding, so comparing these two numbers
 * is comparing paint order.
 */
async function effectiveZ(page: Page, selector: string): Promise<number | null> {
	return page.evaluate((sel) => {
		let node = document.querySelector<HTMLElement>(sel);
		while (node) {
			const z = window.getComputedStyle(node).zIndex;
			if (z !== 'auto' && z !== '') {
				const parsed = Number.parseInt(z, 10);
				if (Number.isFinite(parsed)) {
					return parsed;
				}
			}
			node = node.parentElement;
		}
		return null;
	}, selector);
}

interface BlackboardProbe {
	/** Toolbar carries the blackboard control. */
	hasControl: boolean;
	/** The blackout sheet became visible after one click. */
	blackoutVisible: boolean;
	/** A stroke was recorded by the ink overlay while blacked out. */
	strokeCount: number;
	/** Effective z-levels of the ink overlay and the blackout sheet. */
	overlayZ: number | null;
	blackoutZ: number | null;
	/** The blackout disarmed again after a second click. */
	blackoutClearedOnSecondClick: boolean;
}

async function probeBlackboard(page: Page, origin: string): Promise<BlackboardProbe> {
	await loadDeckAt(page, origin, SAMPLE_DECK);
	await startShow(page);

	const control = page.locator('[data-pptx-present-control="blackboard"]');
	const hasControl = (await control.count()) > 0;
	if (!hasControl) {
		return {
			hasControl,
			blackoutVisible: false,
			strokeCount: 0,
			overlayZ: null,
			blackoutZ: null,
			blackoutClearedOnSecondClick: false,
		};
	}

	await control.click();
	await page.waitForTimeout(300);
	const blackout = page.locator('[data-pptx-blackout]');
	const blackoutVisible = await blackout.isVisible().catch(() => false);

	// Draw one stroke across the middle of the blacked-out screen. The pen is
	// armed by the same click, so this must land in the annotation overlay.
	await page.mouse.move(500, 400);
	await page.mouse.down();
	await page.mouse.move(700, 450, { steps: 8 });
	await page.mouse.move(860, 420, { steps: 8 });
	await page.mouse.up();
	await page.waitForTimeout(300);

	// Any stroke path inside the overlay: four bindings hang the marker on a
	// wrapper around the <svg>, one puts it on the <svg> itself, and which node
	// carries it makes no visual difference.
	const strokeCount = await page
		.locator('[data-pptx-annotation-overlay] path')
		.count()
		.catch(() => 0);
	const overlayZ = await effectiveZ(page, '[data-pptx-annotation-overlay]');
	const blackoutZ = await effectiveZ(page, '[data-pptx-blackout]');

	// Second click disarms both again. Wake the bar first; it may have hidden.
	await page.mouse.move(720, 870);
	await page.waitForTimeout(300);
	await control.click();
	await page.waitForTimeout(300);
	const blackoutClearedOnSecondClick = !(await blackout.isVisible().catch(() => false));

	return {
		hasControl,
		blackoutVisible,
		strokeCount,
		overlayZ,
		blackoutZ,
		blackoutClearedOnSecondClick,
	};
}

interface RenameProbe {
	/** The pane opened and exposed at least one named row. */
	rows: number;
	/** Name of the first row before the rename. */
	before: string;
	/** Name shown after committing the rename. */
	after: string;
	/** Name shown after Escape cancelled a second edit. */
	afterCancel: string;
	/** Name shown after undo. */
	afterUndo: string;
}

const NEW_NAME = 'Renamed via e2e';

async function probeRename(page: Page, origin: string): Promise<RenameProbe> {
	await loadDeckAt(page, origin, SAMPLE_DECK);
	await openRibbonTab(page, 'View');
	await page
		.getByTitle(/^selection pane$/iu)
		.first()
		.click();

	const pane = page.locator('[data-pptx-selection-pane]');
	await pane.waitFor();
	const label = pane.locator('[data-pptx-selection-name]').first();
	await label.waitFor();
	const rows = await pane.locator('[data-pptx-selection-name]').count();
	const before = ((await label.textContent()) ?? '').trim();

	// Rename: double-click, type, Enter.
	await label.dblclick();
	const input = pane.getByRole('textbox').first();
	await input.waitFor();
	await input.fill(NEW_NAME);
	await input.press('Enter');
	await page.waitForTimeout(300);
	const after = (
		(await pane.locator('[data-pptx-selection-name]').first().textContent()) ?? ''
	).trim();

	// Escape must cancel without committing.
	await pane.locator('[data-pptx-selection-name]').first().dblclick();
	const cancelInput = pane.getByRole('textbox').first();
	await cancelInput.waitFor();
	await cancelInput.fill('Discarded');
	await cancelInput.press('Escape');
	await page.waitForTimeout(300);
	const afterCancel = (
		(await pane.locator('[data-pptx-selection-name]').first().textContent()) ?? ''
	).trim();

	// Undo restores the original name (the rename went through history).
	await page.locator('body').press('ControlOrMeta+z');
	await page.waitForTimeout(400);
	const afterUndo = (
		(await pane.locator('[data-pptx-selection-name]').first().textContent()) ?? ''
	).trim();

	return { rows, before, after, afterCancel, afterUndo };
}

test.describe('blackboard mode', () => {
	test('one click arms black screen + pen, and ink paints above the blackout', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, (page, origin) =>
			probeBlackboard(page, origin),
		);

		const problems: string[] = [];
		for (const { framework, value } of results) {
			if (!value.hasControl) {
				problems.push(`${framework.name}: show toolbar has no "blackboard" control`);
				continue;
			}
			if (!value.blackoutVisible) {
				problems.push(`${framework.name}: blackboard click did not raise the black screen`);
			}
			if (value.strokeCount < 1) {
				problems.push(`${framework.name}: no ink stroke was recorded while blacked out`);
			}
			if (value.overlayZ === null || value.blackoutZ === null) {
				problems.push(
					`${framework.name}: stacking hooks missing (overlay z ${String(value.overlayZ)}, blackout z ${String(value.blackoutZ)})`,
				);
			} else if (value.overlayZ <= value.blackoutZ) {
				problems.push(
					`${framework.name}: ink overlay stacks at ${value.overlayZ}, below the blackout at ${value.blackoutZ}`,
				);
			}
			if (!value.blackoutClearedOnSecondClick) {
				problems.push(`${framework.name}: second blackboard click did not clear the black screen`);
			}
		}
		expect(problems.join('\n')).toBe('');
	});
});

test.describe('selection-pane rename', () => {
	test('double-click renames, Escape cancels, undo restores', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, (page, origin) =>
			probeRename(page, origin),
		);

		const problems: string[] = [];
		for (const { framework, value } of results) {
			if (value.rows < 1) {
				problems.push(`${framework.name}: selection pane exposes no [data-pptx-selection-name]`);
				continue;
			}
			if (value.after !== NEW_NAME) {
				problems.push(
					`${framework.name}: committed rename shows "${value.after}", expected "${NEW_NAME}"`,
				);
			}
			if (value.afterCancel !== NEW_NAME) {
				problems.push(
					`${framework.name}: Escape should cancel, but the row shows "${value.afterCancel}"`,
				);
			}
			if (value.afterUndo !== value.before) {
				problems.push(
					`${framework.name}: undo shows "${value.afterUndo}", expected the original "${value.before}"`,
				);
			}
		}
		expect(problems.join('\n')).toBe('');
	});
});
