/**
 * Loading a deck, and the neutral locators every binding agrees on.
 *
 * Only hooks that all five viewers emit belong here. Anything narrower is a
 * parity bug in the binding that is missing it, and should be fixed there
 * rather than papered over with a per-binding fallback in a spec.
 *
 * @module e2e/support/deck
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Locator, Page } from '@playwright/test';

/** Absolute path to a file in `e2e/fixtures`. */
export function fixture(name: string): string {
	return resolve(fileURLToPath(new URL('../fixtures/', import.meta.url)), name);
}

/** The deck most specs use: 7 slides covering text, tables, charts and images. */
export const SAMPLE_DECK = fixture('sample-deck.pptx');

/**
 * Upload `fixturePath` and wait until the deck has actually rendered.
 *
 * Waiting on a rendered element rather than the stage matters: every binding
 * paints the stage box before it has laid out any content, so a spec that waits
 * only for the stage measures an empty slide and passes for the wrong reason.
 */
export async function loadDeck(page: Page, fixturePath: string = SAMPLE_DECK): Promise<void> {
	await page.goto('/');
	await uploadDeck(page, fixturePath);
}

/**
 * Forget this tab's restored session so the NEXT navigation lands on the
 * landing dropzone.
 *
 * `packages/shared/src/render/session-restore.ts` keys the restore off a
 * `sessionStorage` tab id, so a spec that opens a deck and then navigates back
 * to `/` in the same page is restored straight into the viewer and never sees
 * `#file-input` - which exists only in the empty/dropzone state. Viewer
 * PREFERENCES live in `localStorage` and are deliberately left intact, so a
 * spec asserting that a persisted choice survives a reload still gets one.
 *
 * Not folded into {@link loadDeck}: it is called ~200 times and would need a
 * probe on every first load, and `session-restore.spec.ts` deliberately relies
 * on the restore happening.
 */
export async function resetTabSession(page: Page): Promise<void> {
	await page.evaluate(() => sessionStorage.clear());
}

/** As {@link loadDeck}, but against an explicit URL (cross-binding harness). */
export async function loadDeckAt(page: Page, url: string, fixturePath: string): Promise<void> {
	await page.goto(url);
	await uploadDeck(page, fixturePath);
}

async function uploadDeck(page: Page, fixturePath: string): Promise<void> {
	await page.locator('#file-input').setInputFiles(fixturePath);
	await slideStage(page).waitFor();
	// Waits on `data-element-id`, not on `data-pptx-element="true"`. Two bindings
	// omit the element marker on graphic-frame types (charts, tables), so a deck
	// whose first slide is only a frame never satisfies a marker-based wait there
	// and the load times out for a reason that has nothing to do with loading.
	await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
}

/**
 * The main-canvas slide region.
 *
 * Thumbnails carry the same roledescription, so the first match is the contract
 * for "the slide the user is editing" - the bindings all render the main canvas
 * ahead of the thumbnail rail in DOM order.
 */
export function slideStage(page: Page): Locator {
	return page.locator('[aria-roledescription="slide"]').first();
}

/**
 * Every rendered element on the current slide.
 *
 * Scoped to the canvas viewport on purpose. Thumbnails carry the same
 * `data-pptx-element` marker, and React and Vue strip `data-element-id` from
 * their thumbnail stages while Angular, Vanilla and Svelte leave it on, so an
 * unscoped count is a different number in each binding for reasons that have
 * nothing to do with the slide.
 */
export function slideElements(page: Page): Locator {
	return page.locator('[data-pptx-viewport] [data-pptx-element="true"]');
}

/**
 * Elements of one PPTX type, via the shared accessibility contract
 * (`packages/shared/src/render/accessibility.ts`), which is the only per-type
 * discriminator all five bindings agree on. CSS classes are per-binding and
 * `data-element-type` exists in two of the five.
 *
 * Angular and Svelte apply these attributes in a `queueMicrotask` after the
 * node exists, so always await a locator rather than counting synchronously.
 */
export function elementsOfType(page: Page, roleDescription: string): Locator {
	return page.locator(
		`[data-pptx-viewport] [data-pptx-element="true"][aria-roledescription="${roleDescription}"]`,
	);
}

/** A slide thumbnail in the slides pane, 1-based. */
export function thumbnail(page: Page, slideNumber: number): Locator {
	return page.getByRole('button', { name: new RegExp(`^Go to slide ${slideNumber}$`, 'iu') });
}

/**
 * The zoom-to-fit control.
 *
 * By title, not by role: React, Vue and Angular give it only a `title`, so it
 * has no accessible name to match on in three of the five bindings.
 */
export function zoomFitButton(page: Page): Locator {
	return page.getByTitle(/^zoom to fit$/iu).last();
}

/** The element whose text contains `needle`, scoped to the main canvas. */
export function elementWithText(page: Page, needle: string): Locator {
	return slideElements(page).filter({ hasText: needle }).first();
}

/** The scrolling viewport that holds the stage. */
export function viewport(page: Page): Locator {
	return page.locator('[data-pptx-viewport]').first();
}

/** The desktop ribbon. */
export function ribbon(page: Page): Locator {
	return page.getByRole('toolbar', { name: 'Presentation toolbar' });
}

/** A ribbon tab by its visible name. */
export function ribbonTab(page: Page, name: string): Locator {
	return ribbon(page).getByRole('tab', { name, exact: true });
}

/** Switch the ribbon to `name` and wait for the content row to settle. */
export async function openRibbonTab(page: Page, name: string): Promise<void> {
	await ribbonTab(page, name).click();
	await page.waitForTimeout(150);
}

/** The properties inspector, when it is on screen. */
export function inspector(page: Page): Locator {
	return page.locator('[data-pptx-inspector]:visible').first();
}

/** Select an element on the canvas by clicking its centre. */
export async function selectElement(page: Page, target: Locator): Promise<void> {
	const box = await target.boundingBox();
	if (!box) {
		throw new Error('cannot select an element with no bounding box');
	}
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
