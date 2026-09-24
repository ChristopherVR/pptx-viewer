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

import { goToSlide } from './support/context-menu';
import {
	elementWithText,
	fixture,
	loadDeck,
	SAMPLE_DECK,
	selectElement,
	slideElements,
	slideStage,
	thumbnail,
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

/** The slide sorter's own heading; every binding renders it as a level-2 heading. */
function sorterHeading(page: Page): Locator {
	return page.getByRole('heading', { name: /slide sorter/iu }).first();
}

/** Open the slide sorter from the status bar and wait for its overlay. */
async function openSlideSorter(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /slide sorter/iu })
		.first()
		.click();
	await expect(sorterHeading(page), 'the slide sorter overlay must open').toBeVisible();
	await page.waitForTimeout(400);
}

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
	test('native image paste follows a canvas click and is one undoable insertion', async ({
		page,
		context,
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await openWithSelection(page);
		await copyTestImage(page);
		// No focus repair or synthetic paste event: use the browser's actual clipboard path.
		await page.keyboard.press('ControlOrMeta+v');
		await expect(slideElements(page)).toHaveCount(3);
		await page.keyboard.press('ControlOrMeta+z');
		await expect(slideElements(page)).toHaveCount(2);
		await page.keyboard.press('ControlOrMeta+Shift+z');
		await expect(slideElements(page)).toHaveCount(3);
	});

	test('native image paste works after ribbon focus, inline click-away and a resize gesture', async ({
		page,
		context,
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		const source = await openWithSelection(page);
		await copyTestImage(page);
		await page.getByRole('button', { name: 'Bold', exact: true }).first().click();
		const target = elementWithText(page, 'TARGET');
		await target.click();
		await page.keyboard.press('ControlOrMeta+v');
		await expect(slideElements(page)).toHaveCount(3);
		await source.dblclick();
		await page.keyboard.type(' edited');
		await slideStage(page).click({ position: { x: 8, y: 8 } });
		await page.keyboard.press('ControlOrMeta+v');
		await expect(slideElements(page)).toHaveCount(4);
		await target.click();
		const box = (await target.boundingBox())!;
		await page.mouse.move(box.x + box.width - 3, box.y + box.height - 3);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width + 24, box.y + box.height + 16, { steps: 6 });
		await page.mouse.up();
		await page.keyboard.press('ControlOrMeta+v');
		await expect(slideElements(page)).toHaveCount(5);
	});

	test('native image paste leaves an inline table-cell input alone', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await loadDeck(page, SAMPLE_DECK);
		await goToSlide(page, 5);
		await copyTestImage(page);
		const before = await slideElements(page).count();
		await slideElements(page).filter({ hasText: 'Starter' }).first().click();
		await slideStage(page).getByText('Starter', { exact: true }).first().dblclick();
		await page.keyboard.press('ControlOrMeta+v');
		await expect(slideElements(page)).toHaveCount(before);
		await page.keyboard.type(' still editing');
		await slideStage(page).click({ position: { x: 8, y: 8 } });
		await expect(slideStage(page)).toContainText('still editing');
		await page.keyboard.press('ControlOrMeta+v');
		await expect(slideElements(page)).toHaveCount(before + 1);
	});
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

	test('paste yields an empty clipboard shortcut and claims a populated internal clipboard', async ({
		page,
		context,
	}) => {
		await openWithSelection(page);
		// Native clipboard data survives browser contexts, including earlier image-paste tests.
		// This case starts with no external content as well as no internal copied element.
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.evaluate(() => navigator.clipboard.writeText(''));
		await page.evaluate(() => {
			document.addEventListener(
				'keydown',
				(event) => {
					if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
						// Native event dispatch can run microtasks between listeners.
						// Observe cancellation after every binding's listener has run.
						setTimeout(() => {
							document.body.dataset.pasteKeyPrevented = String(event.defaultPrevented);
						});
					}
				},
				true,
			);
		});
		await pressShortcut(page, 'ControlOrMeta+v', 300);
		await expect(page.locator('body')).toHaveAttribute('data-paste-key-prevented', 'false');
		await expect(slideElements(page)).toHaveCount(2);

		await pressShortcut(page, 'ControlOrMeta+c', 300);
		await pressShortcut(page, 'ControlOrMeta+v', 800);
		await expect(page.locator('body')).toHaveAttribute('data-paste-key-prevented', 'true');
		await expect(slideElements(page)).toHaveCount(3);
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

	test('Ctrl+/ opens the same shortcut reference as "?"', async ({ page }) => {
		// "?" is Shift+/ on a US layout and needs AltGr on several European ones,
		// so PowerPoint-style apps offer the chord as well. Only Vue ever wired it,
		// by hand, above its shortcut registry; it is a shared-keymap action now
		// and the other four have to answer it too.
		await loadDeck(page, TWO_SHAPES);
		await pressShortcut(page, 'ControlOrMeta+/', 700);
		await expect(
			shortcutReference(page),
			'Ctrl+/ must open the shortcut reference, the same panel "?" opens',
		).toBeVisible();

		await pressShortcut(page, 'Escape', 600);
		await expect(shortcutReference(page), 'Escape must close it again').toBeHidden();
	});
});

/**
 * The text-bearing descendant of a shape: its computed style is where
 * alignment and font-size land, not necessarily the `[data-pptx-element]`
 * container itself (which also carries the SVG outline, the fill and other
 * decoration in some bindings).
 */
function textNodeOf(shape: Locator, needle: string): Locator {
	return shape.locator('div', { hasText: needle }).last();
}

test.describe('PowerPoint 365 editing shortcuts (alignment, font size, format painter, new slide, Tab)', () => {
	test("Ctrl+E centers a selected (not editing) text shape's paragraph", async ({ page }) => {
		const source = await openWithSelection(page);
		const text = textNodeOf(source, 'SOURCE');
		await expect(text).toHaveCSS('text-align', 'left');

		await pressShortcut(page, 'ControlOrMeta+e', 500);

		await expect(
			text,
			'Ctrl+E must centre the paragraph of a selected text shape, not just inside an open editor',
		).toHaveCSS('text-align', 'center');
	});

	test('Ctrl+L, Ctrl+R and Ctrl+J set the other three paragraph alignments', async ({ page }) => {
		const source = await openWithSelection(page);
		const text = textNodeOf(source, 'SOURCE');

		await pressShortcut(page, 'ControlOrMeta+r', 500);
		await expect(text).toHaveCSS('text-align', 'right');

		await pressShortcut(page, 'ControlOrMeta+j', 500);
		await expect(text).toHaveCSS('text-align', 'justify');

		await pressShortcut(page, 'ControlOrMeta+l', 500);
		await expect(text).toHaveCSS('text-align', 'left');
	});

	/** The text node's rendered font size in CSS pixels. */
	async function fontSizePx(text: Locator): Promise<number> {
		return parseFloat(await text.evaluate((el) => getComputedStyle(el).fontSize));
	}

	test("Ctrl+] and Ctrl+[ step the font size along PowerPoint's ladder", async ({ page }) => {
		const source = await openWithSelection(page);
		const text = textNodeOf(source, 'SOURCE');
		// The fixture authors SOURCE at 28px. PowerPoint's ladder operates in
		// points (72/in), so a size that does not itself sit on a rung (28px is
		// 21pt) steps to the nearest rung in the requested direction: up to 24pt
		// (32px), not by a flat delta.
		const start = await fontSizePx(text);
		expect(start).toBeCloseTo(28, 1);

		await pressShortcut(page, 'ControlOrMeta+]', 500);
		await expect
			.poll(() => fontSizePx(text), {
				message: 'Ctrl+] must step up to the next size on the ladder, not by a flat delta',
			})
			.toBeCloseTo(32, 1);

		await pressShortcut(page, 'ControlOrMeta+[', 500);
		// Down from 32px (24pt), the next rung below is 20pt = 26.667px: the
		// ladder does not remember 28px was never a rung to begin with.
		await expect.poll(() => fontSizePx(text)).toBeCloseTo(26.667, 1);
	});

	test('Ctrl+Shift+> and Ctrl+Shift+< are the same ladder, reached without brackets', async ({
		page,
	}) => {
		const source = await openWithSelection(page);
		const text = textNodeOf(source, 'SOURCE');

		await pressShortcut(page, 'ControlOrMeta+Shift+>', 500);
		await expect.poll(() => fontSizePx(text)).toBeCloseTo(32, 1);

		await pressShortcut(page, 'ControlOrMeta+Shift+<', 500);
		await expect.poll(() => fontSizePx(text)).toBeCloseTo(26.667, 1);
	});

	test('Ctrl+Shift+C copies formatting and Ctrl+Shift+V pastes it onto the target', async ({
		page,
	}) => {
		await loadDeck(page, TWO_SHAPES);
		const source = elementWithText(page, 'SOURCE');
		const target = elementWithText(page, 'TARGET');

		await expect(target).not.toHaveCSS('background-color', 'rgb(255, 0, 0)');

		await selectElement(page, source);
		await pressShortcut(page, 'ControlOrMeta+Shift+c', 400);
		await selectElement(page, target);
		await pressShortcut(page, 'ControlOrMeta+Shift+v', 600);

		await expect(
			target,
			"Ctrl+Shift+C then Ctrl+Shift+V must copy SOURCE's fill onto TARGET, the same way the " +
				'Format Painter button does, without needing a click to arm and another to apply',
		).toHaveCSS('background-color', 'rgb(255, 0, 0)');
	});

	test('Ctrl+M inserts a new slide', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		expect(await slidePosition(page)).toBe('Slide 1 of 7');
		await expect(thumbnail(page, 8), 'the seven-slide deck starts with no slide 8').toHaveCount(0);

		await pressShortcut(page, 'ControlOrMeta+m', 700);

		await expect(
			thumbnail(page, 8),
			"Ctrl+M must insert a new slide, the same entry point as the Home ribbon's New Slide button",
		).toBeVisible();
	});

	test("Tab cycles the selection forward through the slide's elements", async ({ page }) => {
		// Tab from no selection lands on the first element; deleting it proves a
		// selection happened without depending on which of the two the binding
		// treats as "first" in tab order.
		await loadDeck(page, TWO_SHAPES);
		await pressShortcut(page, 'Tab', 400);
		await pressShortcut(page, 'Delete', 600);
		await expect(slideElements(page), 'one Tab press must select exactly one element').toHaveCount(
			1,
		);
		const survivorOfOneTab = await slideElements(page).first().textContent();

		await loadDeck(page, TWO_SHAPES);
		await pressShortcut(page, 'Tab', 400);
		await pressShortcut(page, 'Tab', 400);
		await pressShortcut(page, 'Delete', 600);
		const survivorOfTwoTabs = await slideElements(page).first().textContent();

		expect(
			survivorOfTwoTabs,
			'a second Tab must move the selection to a DIFFERENT element than the first, so deleting ' +
				'after two presses removes the other shape than deleting after one',
		).not.toBe(survivorOfOneTab);
	});

	test('Shift+Tab cycles the selection backward', async ({ page }) => {
		await loadDeck(page, TWO_SHAPES);
		await pressShortcut(page, 'Tab', 400);
		await pressShortcut(page, 'Delete', 600);
		const survivorOfTabForward = await slideElements(page).first().textContent();

		await loadDeck(page, TWO_SHAPES);
		await pressShortcut(page, 'Shift+Tab', 400);
		await pressShortcut(page, 'Delete', 600);
		const survivorOfTabBackward = await slideElements(page).first().textContent();

		expect(
			survivorOfTabBackward,
			'Shift+Tab must move the opposite direction from Tab, landing on the other element',
		).not.toBe(survivorOfTabForward);
	});
});

/** Put a tiny locally generated PNG on the browser clipboard, without changing DOM focus. */
async function copyTestImage(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 24;
		canvas.height = 16;
		const context = canvas.getContext('2d')!;
		context.fillStyle = '#ff0000';
		context.fillRect(0, 0, 24, 16);
		const blob = await new Promise<Blob>((resolve) => {
			canvas.toBlob((image) => resolve(image!), 'image/png');
		});
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
	});
}

/**
 * The slide sorter is a second editing surface with its own keyboard, and it
 * drifted the way the main keymap did: React had the whole set, Vue had Delete
 * and Ctrl+D, Angular had Escape alone, and Svelte and Vanilla had no sorter
 * keys at all, so Escape did not even close the overlay. `mapSlideSorterKey`
 * is now the one map behind all five.
 */
test.describe('slide-sorter keyboard shortcuts', () => {
	test('Escape closes the slide sorter', async ({ page }) => {
		// React was excluded here until its cause was found, and the cause was not
		// the keymap: its sorter re-registered the window listener on every render,
		// and the editor's own (earlier-registered) Escape handler re-rendered the
		// viewer mid-dispatch, so the cleanup removed the sorter's listener before
		// the event reached it and the replacement - added during dispatch - never
		// saw it. The listener identity is stable now, as in the editor's hook.
		await loadDeck(page, SAMPLE_DECK);
		await openSlideSorter(page);

		await pressShortcut(page, 'Escape', 700);
		await expect(
			sorterHeading(page),
			'Escape must dismiss the slide sorter. Two bindings shipped it with no keyboard at all, ' +
				'so the overlay could only be left by finding its close button',
		).toBeHidden();
	});

	test('Ctrl+D duplicates a slide from the sorter', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		expect(await slidePosition(page)).toBe('Slide 1 of 7');
		await expect(thumbnail(page, 8), 'the seven-slide deck starts with no slide 8').toHaveCount(0);
		await openSlideSorter(page);

		await pressShortcut(page, 'ControlOrMeta+d', 900);
		await pressShortcut(page, 'Escape', 700);

		// Asserted on the deck through the slides rail, not on the key handler: a
		// shortcut can be bound, enabled and still reach a callback that does
		// nothing. The rail is used rather than the "Slide n of m" counter because
		// one binding's counter is wired to the loaded deck rather than the edited
		// one, so it under-reports an inserted slide even when the insert worked.
		await expect(
			thumbnail(page, 8),
			'Ctrl+D in the sorter must add exactly one slide to the deck',
		).toBeVisible();
	});
});

/**
 * The slide show has its own keymap, and two of its chords were resolved by the
 * shared map and then thrown away.
 *
 * `mapPresentationKey` has answered Ctrl+H with `toggleChrome` and Ctrl+S with
 * `showAllSlides` since it was written; only React and Vue ever dispatched
 * them. In Angular, Svelte and Vanilla the key was consumed - the handler
 * `preventDefault()`s everything the map claims - and then dropped, which is
 * strictly worse than not binding it: the presenter got no navigator AND no
 * browser default. Both are asserted on what the show DOES, not on whether a
 * callback fired.
 */
test.describe('slide-show keyboard shortcuts', () => {
	/** Load the deck and start the show, then let the chrome auto-hide settle. */
	async function startShow(page: Page): Promise<void> {
		await loadDeck(page, SAMPLE_DECK);
		await page
			.getByRole('button', { name: /^present$|slide show/iu })
			.first()
			.click();
		// The click itself reveals the auto-hiding show chrome; the bar hides
		// again three seconds after the last pointer movement, and a keyboard
		// press does not move the pointer. Waiting past that is what makes
		// "Ctrl+H revealed it" a measurement rather than a coincidence.
		await page.waitForTimeout(4000);
	}

	/**
	 * The show toolbar's rendered opacity, i.e. whether the chrome is up.
	 *
	 * A missing bar throws rather than reporting 0: "faded out" and "not there at
	 * all" would otherwise both satisfy the pre-condition below, and the test
	 * would go on to blame Ctrl+H for a show that never started.
	 */
	async function chromeOpacity(page: Page): Promise<number> {
		return page.evaluate(() => {
			const bar = document.querySelector('[data-pptx-present-toolbar]');
			if (!bar) {
				throw new Error('the running show renders no [data-pptx-present-toolbar]');
			}
			// The fade lives on the bar or on its positioned wrapper, depending on
			// the binding, so the lower of the two is what the presenter sees.
			const own = Number(getComputedStyle(bar).opacity);
			const parent = bar.parentElement ? Number(getComputedStyle(bar.parentElement).opacity) : 1;
			return Math.min(own, parent);
		});
	}

	test('Ctrl+H reveals the show chrome PowerPoint hides on that key', async ({ page }) => {
		await startShow(page);
		expect(
			await chromeOpacity(page),
			'the show toolbar must exist and be faded out before the shortcut is measured',
		).toBeLessThan(0.5);

		await pressShortcut(page, 'ControlOrMeta+h', 700);

		expect(
			await chromeOpacity(page),
			'Ctrl+H must flip the show chrome. Three bindings resolved the action and dropped it, ' +
				'so the key was swallowed and nothing on screen changed',
		).toBeGreaterThan(0.5);
	});

	test('Ctrl+S opens the See All Slides navigator', async ({ page }) => {
		await startShow(page);
		const navigator = page.getByRole('heading', { name: /see all slides/iu }).first();
		await expect(navigator, 'the navigator must not already be up').toBeHidden();

		await pressShortcut(page, 'ControlOrMeta+s', 900);

		await expect(
			navigator,
			'Ctrl+S is PowerPoint\'s "See All Slides"; three bindings ate the key and one opened ' +
				'the presenter console without the grid the shortcut is named after',
		).toBeVisible();
	});
});
