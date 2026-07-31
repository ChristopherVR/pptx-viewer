/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * One editor keymap, five bindings.
 *
 * The keymap is the part of the editor a user memorises, so it is also the part
 * that has to be identical everywhere: a shortcut that duplicates twice, moves
 * an element by two pixels where the ribbon says one, skips two slides on one
 * press, or simply is not bound at all is a defect the user feels immediately
 * and no other spec here would notice. Every binding re-implemented the handler
 * separately (a window listener, a root listener, a signal service, a matcher
 * table), which is exactly the shape of code that drifts.
 *
 * The assertions are stated as the objectively correct answer rather than as
 * "agrees with React", because for a keymap there is one: Ctrl+D duplicates
 * once, an arrow moves one slide pixel, Shift+arrow moves ten. A binding that
 * does something else fails under its own name.
 *
 * Run: bunx playwright test keyboard-shortcuts
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	elementWithText,
	fixture,
	loadDeck,
	SAMPLE_DECK,
	selectElement,
	slideElements,
} from './support/deck';
import {
	dragBy,
	pressShortcut,
	shortcutReference,
	slideLeftOf,
	slidePosition,
	stageScale,
	topLevelElementCount,
} from './support/keyboard';

test.use({ viewport: { width: 1440, height: 900 } });

/** A one-slide deck holding exactly two shapes, "SOURCE" and "TARGET". */
const TWO_SHAPES = fixture('format-painter.pptx');

/** Load the two-shape deck and select "SOURCE"; hands back its locator. */
async function openWithSelection(page: Page): Promise<Locator> {
	await loadDeck(page, TWO_SHAPES);
	const source = elementWithText(page, 'SOURCE');
	await selectElement(page, source);
	return source;
}

/**
 * Load the two-shape deck ready to be dragged, without clicking first.
 *
 * A drag selects the shape on its own. Clicking it beforehand is what a user
 * does, but one binding treats a press on an already-selected text shape as
 * "start editing the text", and its shortcut handler then (correctly) stands
 * down for the inline editor, which would make an undo test fail for a reason
 * that has nothing to do with the undo keymap.
 */
async function openForDrag(page: Page): Promise<{ source: Locator; scale: number; start: number }> {
	await loadDeck(page, TWO_SHAPES);
	const source = elementWithText(page, 'SOURCE');
	const scale = await stageScale(page);
	return { source, scale, start: await slideLeftOf(source, scale) };
}

/** Assert a slide-space x position, allowing a pixel of measurement noise. */
function expectSlideX(actual: number, expected: number, what: string): void {
	expect(
		Math.abs(actual - expected),
		`${what} (measured ${actual.toFixed(1)} slide px)`,
	).toBeLessThan(1.5);
}

test.describe('editor keyboard shortcuts', () => {
	test('a canvas click alone is enough for the next keystroke to reach the editor', async ({
		page,
	}) => {
		await openWithSelection(page);
		// Deliberately not `pressShortcut`: no focus repair, exactly what a user does.
		await page.keyboard.press('Delete');
		await page.waitForTimeout(800);
		await expect(
			slideElements(page),
			'clicking a shape and pressing a key must reach the editor. A canvas gesture that ' +
				'calls preventDefault() on pointerdown leaves focus on document.body, and every ' +
				'shortcut of a binding that listens on its own root is then silently dead',
		).toHaveCount(1);
	});

	test('Ctrl+C then Ctrl+V pastes exactly one copy', async ({ page }) => {
		await openWithSelection(page);
		await pressShortcut(page, 'ControlOrMeta+c', 300);
		await pressShortcut(page, 'ControlOrMeta+v', 800);
		await expect(slideElements(page), 'one copy pasted onto a two-shape slide').toHaveCount(3);
	});

	test('Ctrl+X removes the selected element and Ctrl+V puts it back', async ({ page }) => {
		await openWithSelection(page);
		await pressShortcut(page, 'ControlOrMeta+x', 700);
		await expect(slideElements(page), 'Ctrl+X must remove the cut element').toHaveCount(1);
		await pressShortcut(page, 'ControlOrMeta+v', 800);
		await expect(slideElements(page), 'Ctrl+V must restore exactly one element').toHaveCount(2);
	});

	test('Ctrl+D duplicates the selection exactly once', async ({ page }) => {
		await openWithSelection(page);
		await pressShortcut(page, 'ControlOrMeta+d', 800);
		await expect(slideElements(page), 'one duplicate, not zero and not two').toHaveCount(3);
	});

	test('Ctrl+A selects every element on the slide', async ({ page }) => {
		await openWithSelection(page);
		await pressShortcut(page, 'ControlOrMeta+a', 400);
		await pressShortcut(page, 'Delete', 800);
		await expect(
			slideElements(page),
			'Ctrl+A must extend the selection to every element, so the Delete that follows empties the slide',
		).toHaveCount(0);
	});

	test('Ctrl+Z undoes a move and Ctrl+Y redoes it', async ({ page }) => {
		const { source, scale, start } = await openForDrag(page);

		await dragBy(page, source, 90);
		const moved = await slideLeftOf(source, scale);
		expect(moved, 'the drag itself must move the element').toBeGreaterThan(start + 40);

		await pressShortcut(page, 'ControlOrMeta+z', 700);
		expectSlideX(await slideLeftOf(source, scale), start, 'Ctrl+Z must undo the move');
		await pressShortcut(page, 'ControlOrMeta+y', 700);
		expectSlideX(await slideLeftOf(source, scale), moved, 'Ctrl+Y must redo the move');
	});

	test('Ctrl+Shift+Z redoes an undone move', async ({ page }) => {
		const { source, scale, start } = await openForDrag(page);

		await dragBy(page, source, 90);
		const moved = await slideLeftOf(source, scale);
		await pressShortcut(page, 'ControlOrMeta+z', 700);
		expectSlideX(await slideLeftOf(source, scale), start, 'Ctrl+Z must undo the move');

		await pressShortcut(page, 'ControlOrMeta+Shift+z', 700);
		expectSlideX(await slideLeftOf(source, scale), moved, 'Ctrl+Shift+Z must redo the move');
	});

	for (const key of ['Delete', 'Backspace'] as const) {
		test(`${key} removes the selected element`, async ({ page }) => {
			await openWithSelection(page);
			await pressShortcut(page, key, 800);
			await expect(slideElements(page), `${key} must delete the selection`).toHaveCount(1);
		});
	}

	test('an arrow key nudges 1 slide pixel and Shift+arrow nudges 10', async ({ page }) => {
		const source = await openWithSelection(page);
		const scale = await stageScale(page);
		const start = await slideLeftOf(source, scale);

		await pressShortcut(page, 'ArrowRight', 400);
		const nudged = await slideLeftOf(source, scale);
		expect(nudged - start, 'a bare arrow key nudges one slide pixel').toBeCloseTo(1, 1);

		await pressShortcut(page, 'Shift+ArrowRight', 400);
		const shifted = await slideLeftOf(source, scale);
		expect(shifted - nudged, 'Shift+arrow nudges ten slide pixels').toBeCloseTo(10, 1);
	});

	test('arrow left/right change slide when nothing is selected', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		expect(await slidePosition(page)).toBe('Slide 1 of 7');

		await pressShortcut(page, 'ArrowRight', 800);
		expect(await slidePosition(page), 'ArrowRight advances exactly one slide').toBe('Slide 2 of 7');

		await pressShortcut(page, 'ArrowLeft', 800);
		expect(await slidePosition(page), 'ArrowLeft goes back exactly one slide').toBe('Slide 1 of 7');
	});

	test('Ctrl+G groups the selection and Ctrl+Shift+G ungroups it', async ({ page }) => {
		await loadDeck(page, TWO_SHAPES);
		const elements = slideElements(page);
		await selectElement(page, elements.first());
		await elements.nth(1).click({ modifiers: ['Shift'] });
		await page.waitForTimeout(300);

		await pressShortcut(page, 'ControlOrMeta+g', 900);
		await expect
			.poll(() => topLevelElementCount(page), {
				message: 'Ctrl+G must replace the two shift-selected shapes with one group element',
			})
			.toBe(1);

		await pressShortcut(page, 'ControlOrMeta+Shift+g', 900);
		await expect
			.poll(() => topLevelElementCount(page), {
				message: 'Ctrl+Shift+G must ungroup back into two top-level elements',
			})
			.toBe(2);
	});

	test('? opens the keyboard-shortcut reference and Escape closes it', async ({ page }) => {
		await loadDeck(page, TWO_SHAPES);
		await pressShortcut(page, '?', 700);
		await expect(shortcutReference(page), '"?" must open the shortcut reference').toBeVisible();

		await pressShortcut(page, 'Escape', 600);
		await expect(shortcutReference(page), 'Escape must close the shortcut reference').toBeHidden();
	});
});
