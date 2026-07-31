/**
 * Typing at the editor, in a way that means the same thing in every binding.
 *
 * Two bindings attach their editor keydown listener to the viewer root rather
 * than to `window`, and their canvas gesture handler calls `preventDefault()` on
 * pointerdown, which suppresses the focus the click would otherwise move. The
 * net effect is that after a perfectly ordinary "click a shape, press a key" the
 * keystroke is delivered to `document.body`, outside the listener, and nothing
 * happens. {@link armKeyboard} reports that as `'repaired'` and puts focus back
 * inside the viewer so a shortcut test measures the shortcut rather than the
 * focus defect; `keyboard-shortcuts.spec.ts` pins the focus defect itself in one
 * dedicated test so it stays visible instead of being smeared over every other.
 *
 * @module e2e/support/keyboard
 */
import type { Locator, Page } from '@playwright/test';

import { slideStage } from './deck';

/**
 * Layout width, in slide pixels, of the 16:9 fixture decks (13.333in at 96 dpi).
 *
 * Three bindings expose it directly as the stage's unscaled `offsetWidth`; the
 * fourth lays the stage out pre-scaled, so it cannot be read uniformly from the
 * DOM and is pinned here instead. Dividing the stage's on-screen width by it
 * gives screen-pixels-per-slide-pixel whatever mechanism a binding uses to fit.
 */
export const SLIDE_WIDTH_PX = 1280;

/** What had to happen for the next keystroke to reach the viewer. */
export type FocusState = 'kept' | 'repaired' | 'unfocusable';

/**
 * Ensure the next keystroke is delivered inside the viewer.
 *
 * `'kept'` means the previous interaction already left focus somewhere real.
 * `'repaired'` means focus had fallen back to `document.body` and this moved it
 * to the nearest focusable ancestor of the stage, which is what a keyboard user
 * reaches by tabbing.
 */
export async function armKeyboard(page: Page): Promise<FocusState> {
	return page.evaluate<FocusState>(() => {
		if (document.activeElement && document.activeElement !== document.body) {
			return 'kept';
		}
		let node = document.querySelector('[aria-roledescription="slide"]')?.parentElement ?? null;
		while (node) {
			if (node.hasAttribute('tabindex')) {
				node.focus();
				return 'repaired';
			}
			node = node.parentElement;
		}
		return 'unfocusable';
	});
}

/** Press one shortcut at the viewer and let the resulting edit settle. */
export async function pressShortcut(page: Page, key: string, settleMs = 500): Promise<void> {
	await armKeyboard(page);
	await page.keyboard.press(key);
	await page.waitForTimeout(settleMs);
}

/**
 * Elements that are not nested inside another element.
 *
 * Grouping is observable as "two top-level elements became one", but the
 * bindings disagree about whether a group's children keep the element contract
 * attribute, so a plain count would measure that disagreement instead of the
 * grouping.
 */
export async function topLevelElementCount(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			[...document.querySelectorAll('[data-pptx-viewport] [data-pptx-element="true"]')].filter(
				(node) => !node.parentElement?.closest('[data-pptx-element="true"]'),
			).length,
	);
}

/** Screen pixels per slide pixel, so a nudge can be asserted in slide units. */
export async function stageScale(page: Page): Promise<number> {
	const box = await slideStage(page).boundingBox();
	if (!box) {
		throw new Error('the slide stage has no bounding box');
	}
	return box.width / SLIDE_WIDTH_PX;
}

/** An element's left edge in slide pixels, i.e. independent of the fit zoom. */
export async function slideLeftOf(target: Locator, scale: number): Promise<number> {
	const box = await target.boundingBox();
	if (!box) {
		throw new Error('the element under test has no bounding box');
	}
	return box.x / scale;
}

/** Drag an element horizontally by `dx` screen pixels, from its centre. */
export async function dragBy(page: Page, target: Locator, dx: number): Promise<void> {
	const box = await target.boundingBox();
	if (!box) {
		throw new Error('cannot drag an element with no bounding box');
	}
	const y = box.y + box.height / 2;
	await page.mouse.move(box.x + box.width / 2, y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + dx, y, { steps: 12 });
	await page.mouse.up();
	await page.waitForTimeout(400);
}

/**
 * The keyboard-shortcut reference panel.
 *
 * Bindings that ship one mark it with `data-pptx-shortcuts-panel`, except one
 * that only gives it `role="dialog"`, so the union is matched and then narrowed
 * by the panel's own heading.
 */
export function shortcutReference(page: Page): Locator {
	return page
		.locator('[data-pptx-shortcuts-panel], [role="dialog"]')
		.filter({ hasText: /keyboard shortcuts/iu })
		.first();
}

/** The visible slide counter, e.g. `"Slide 2 of 7"`. */
export async function slidePosition(page: Page): Promise<string> {
	return page.evaluate(
		() => /Slide \d+ of \d+/u.exec(document.body.innerText ?? '')?.[0] ?? 'no slide counter',
	);
}
