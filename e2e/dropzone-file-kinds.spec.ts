/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The landing dropzone must accept every file the loader can open.
 *
 * ## The drift this pins
 *
 * All five demos hand-rolled the same two things: a
 * `/\.(?:pptx|ppt|json)$/iu` test in their drop handler and an
 * `accept=".pptx,.ppt,.json"` on the hidden input. The loader, meanwhile, has
 * always read `.pptm`, `.ppsx`, `.potx` and the legacy `.pps` / `.pot` as well
 * (`LOADABLE_EXTENSION_PATTERN` in
 * `packages/shared/src/render/presentation-file-kinds.ts`).
 *
 * The visible symptom was a contradiction inside one product: dragging
 * `deck.pptm` onto the landing page did nothing at all, and then opening the
 * exact same file through File > Open inside the viewer worked. A silent
 * refusal is the worst version of that bug, because the user cannot tell it
 * from a broken page.
 *
 * The fix is not five corrected regexes, which would drift again the next time
 * the loader learns a format. Each binding now re-exports `PPTX_OPEN_ACCEPT`
 * and `isSupportedPresentationFile` from its root barrel and the demos consume
 * those, so there is one list. This spec is what keeps a future copy-paste
 * from reintroducing a local allow-list: it drops a `.pptm` and requires the
 * deck to actually render.
 *
 * Run: node node_modules/@playwright/test/cli.js test dropzone-file-kinds
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * A real deck's bytes, reused under other names. The container is what decides
 * whether a deck loads; the extension is only the pre-filter under test, so
 * renaming the same valid package is exactly the right probe and avoids
 * committing near-duplicate binary fixtures.
 */
const sampleDeckBase64 = readFileSync(
	resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url))),
).toString('base64');

const dropzone = (page: Page): Locator => page.locator('[data-testid="dropzone"]').first();

async function gotoLanding(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place the drop handler is mounted) never appears.
	await resetTabSession(page);
	await page.goto('/');
	await expect(dropzone(page)).toBeVisible();
}

/** Dispatch a real `drop` carrying one named file at the dropzone. */
async function dropFile(page: Page, fileName: string): Promise<void> {
	await dropzone(page).evaluate(
		(node, payload) => {
			const binary = atob(payload.base64);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			const file = new File([bytes], payload.fileName, {
				type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			});
			const transfer = new DataTransfer();
			transfer.items.add(file);
			// Some demos gate on dragover having been seen first; sending both
			// mirrors what a browser does and costs nothing.
			node.dispatchEvent(
				new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }),
			);
			node.dispatchEvent(
				new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }),
			);
		},
		{ fileName, base64: sampleDeckBase64 },
	);
}

test.describe('landing dropzone file kinds', () => {
	test('the file input advertises every extension the loader can open', async ({ page }) => {
		await gotoLanding(page);
		const accept = await page.locator('#file-input').first().getAttribute('accept');
		expect(accept).toBe('.pptx,.ppsx,.pptm,.potx,.ppt,.json');
		// The three the demos used to omit, named individually so a failure says
		// which one regressed rather than just "string mismatch".
		for (const extension of ['.pptm', '.ppsx', '.potx']) {
			expect(accept).toContain(extension);
		}
	});

	test('a dropped .pptm is accepted and renders', async ({ page }) => {
		await gotoLanding(page);
		await dropFile(page, 'macro-deck.pptm');

		// The deck has to actually mount. Asserting only that the dropzone went
		// away would pass on a demo that cleared the landing page and then failed
		// to load anything.
		await page.locator('[aria-roledescription="slide"]').first().waitFor();
		await page.locator('[data-pptx-element="true"]').first().waitFor();
		await expect(dropzone(page)).toHaveCount(0);
	});

	test('a dropped .pptx still works, and an unrelated file is still refused', async ({ page }) => {
		await gotoLanding(page);
		await dropFile(page, 'notes.docx');
		// Still on the landing page: the extension filter rejected it before the
		// bytes were ever read.
		await expect(dropzone(page)).toBeVisible();

		await dropFile(page, 'deck.pptx');
		await page.locator('[aria-roledescription="slide"]').first().waitFor();
		await expect(dropzone(page)).toHaveCount(0);
	});
});
