/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * OLE embedded-object and ink-annotation coverage, run identically across
 * every framework demo (React / Vue / Angular).
 *
 * Before this spec, neither of these two `PptxElement` kinds (of the 11 in
 * `core/types/elements.ts`) had any e2e coverage. No real-world fixture with
 * genuine OLE or ink content existed anywhere in the repo (checked
 * `e2e/fixtures/`, `.github/assets/`, `packages/core/src/__tests__/fixtures/`
 * - none contain `p:oleObj` or `aink:` markup), and PowerPoint's own COM
 * automation (available on this machine per prior SmartArt work) was blocked
 * by the sandbox's safety classifier when attempting to script a real
 * Office-authored fixture. `generate-ole-ink-fixtures.ts` instead follows the
 * exact precedent `generate-chart-fixture.ts` already established for this
 * problem (the SDK has no from-scratch authoring path for these element
 * kinds): build a valid base deck, then post-process the zip to inject a real
 * graphic frame + relationships + parts, using the exact OOXML shapes the
 * project's own `ole-save-roundtrip.test.ts` / `ink-save-roundtrip.test.ts`
 * already verified round-trip correctly - with genuine, spec-valid binary
 * payloads (a real one-page PDF with an accurate xref table, a real PNG).
 *
 * BUG #1 (now FIXED - see `EXPECTS_PREVIEW_IMAGE` below): `previewImageData`
 * (the field every binding's OLE renderer actually reads for the `<img>`
 * preview) was never populated anywhere in the load pipeline
 * (`PptxHandlerRuntimeLoadSession.ts` populated `oleEmbeddedData` for
 * download/open, but nothing resolved the separately-parsed `previewImage`
 * relative path into `previewImageData`). So a real `.pptx`'s OLE preview image
 * never rendered in any of the three bindings - every loaded OLE object fell
 * back to the generic type-badge placeholder, identically to how
 * `chart-rendering.spec.ts` documented `chartData` not being enriched on load
 * before that was fixed. `enrichOleElementsWithEmbeddedData` now resolves the
 * preview into `previewImageData`, so all three bindings render it.
 *
 * BUG #2 (now FIXED - see `EXPECTS_OPEN_POPUP` below): all three bindings'
 * "Open" action (React `OleRenderer.tsx`, Vue `OleRenderer.vue`'s
 * `openEmbedded()`, Angular `ole-renderer.component.ts`) pointed a
 * `target="_blank"` anchor / `window.open()` directly at the `oleEmbeddedData`
 * **`data:` URL**. Chromium silently refuses to navigate a new top-level
 * browsing context straight to a `data:` URL - clicking "Open" never opened a
 * tab and never surfaced an error. The fix routes the payload through the
 * shared `openUrlInNewTab` helper, which converts the `data:` URL to a
 * `Blob`/`URL.createObjectURL` object URL (which browsers do allow a new tab to
 * navigate to) and revokes it after a delay. All three "Open" controls are now
 * normalized to a `<button>` that calls this helper.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const oleFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/ole-embed.pptx', import.meta.url)),
);
const inkFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/ink-annotation.pptx', import.meta.url)),
);

/**
 * Whether the OLE preview image (`previewImageData`) is expected to render.
 * `true` now that the load pipeline resolves a loaded OLE object's
 * `previewImage` relationship path into `previewImageData`
 * (`enrichOleElementsWithEmbeddedData`), the same way regular picture elements
 * resolve their media - so every binding renders the real preview `<img>`.
 */
const EXPECTS_PREVIEW_IMAGE = true;

/**
 * Whether clicking the "Open in a new tab" action is expected to actually open
 * a new tab. `true` now that the action converts the recovered `data:` URL to a
 * Blob object URL (`openUrlInNewTab` in `pptx-viewer-shared`) before opening,
 * which browsers do allow a new top-level document to navigate to (they refuse
 * a raw `data:` URL).
 */
const EXPECTS_OPEN_POPUP = true;

async function openFixture(page: Page, fixturePath: string): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-element-id]').first().waitFor();
}

test.describe('OLE embedded objects', () => {
	test('renders a preview (image or type placeholder) and offers download/open', async ({
		page,
	}) => {
		await openFixture(page, oleFixturePath);

		const ole = page.locator('[data-element-id]').first();
		await expect(ole).toBeVisible();

		const img = ole.locator('img');
		const hasImg = await img.count();
		if (EXPECTS_PREVIEW_IMAGE) {
			expect(hasImg, 'OLE preview <img> renders once previewImageData is wired up').toBeGreaterThan(
				0,
			);
		} else {
			// Current, documented behaviour: the previewImageData load-pipeline
			// gap means every binding falls back to the type-badge placeholder
			// (an SVG icon + label), never the real preview PNG.
			expect(hasImg, 'OLE element does not yet render its preview <img> (see header note)').toBe(0);
			await expect(ole.locator('svg').first()).toBeVisible();
		}

		// The element must still be identifiable as the PDF-typed OLE object:
		// the type-specific label ("PDF Document") is rendered as visible text
		// (placeholder) or carried on the inner `role="img"` node's aria-label
		// / title (image preview), so match broadly across both forms.
		await expect(ole).toContainText(/pdf/iu);

		// Download action: every binding renders a real `<a download>` whose
		// href is the recovered embedded-payload data: URL (see
		// `enrichOleElementsWithEmbeddedData`). Hovering first, since two of
		// the three bindings only reveal the action footer on hover/focus.
		await ole.hover();
		const downloadLink = ole.locator('a[download]').first();
		await expect(downloadLink).toBeAttached();

		const downloadPromise = page.waitForEvent('download');
		await downloadLink.click({ force: true });
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/report/iu);

		// Open-in-new-tab action: the embedded payload is a real PDF
		// (`application/pdf`), which `isBrowserOpenableMime` allows, so every
		// binding also renders an "Open" control alongside "Download". All three
		// now normalize it to a `<button>` that routes the recovered `data:` URL
		// through the shared `openUrlInNewTab` helper (data URL -> Blob object
		// URL -> new tab). Select by accessible name/role rather than tag to stay
		// robust.
		const openLink = ole
			.getByRole('link', { name: /open/iu })
			.or(ole.getByRole('button', { name: /open/iu }));
		await expect(openLink).toBeAttached();

		const popupWait = page.waitForEvent('popup', { timeout: 3000 }).catch(() => undefined);
		const pagesBefore = page.context().pages().length;
		await openLink.click();
		const popup = await popupWait;

		if (EXPECTS_OPEN_POPUP) {
			// The fix routes the recovered PDF `data:` URL through a Blob object
			// URL before opening; a new top-level tab WILL open for that (the old
			// raw `data:` URL path opened nothing at all - see the else branch).
			// That a popup opens is the portable signal for the fix. The opened
			// tab's document URL is environment-dependent and so NOT asserted: a
			// `blob:` PDF renders inline in headed Chromium but is handed to the
			// download manager in headless (leaving the tab URL empty). We only
			// assert it is never the raw `data:` URL the browser used to refuse.
			expect(popup, 'Open action opens a new tab once it uses an object URL').toBeDefined();
			expect(popup!.url()).not.toMatch(/^data:/u);
			expect(page.context().pages().length).toBeGreaterThan(pagesBefore);
			await popup!.close().catch(() => undefined);
		} else {
			// Discovered bug #2 (see header): Chromium silently refuses to
			// navigate a new top-level document straight to a `data:` URL, so
			// the click currently opens nothing at all - not a real popup, not
			// an error, and the original page stays in place.
			expect(
				popup,
				'documents discovered bug #2: no popup opens for a data: URL target',
			).toBeUndefined();
			expect(page.context().pages().length).toBe(pagesBefore);
			await expect(page.locator('[data-element-id]').first()).toBeVisible();
		}
	});
});

test.describe('ink annotations', () => {
	test('renders real multi-point strokes and survives a save + reload cycle', async ({ page }) => {
		await openFixture(page, inkFixturePath);

		const ink = page.locator('[data-element-id]').first();
		await expect(ink).toBeVisible();

		const paths = ink.locator('svg path');
		await expect(paths).toHaveCount(2);

		const dBefore = await paths.evaluateAll((els) => els.map((el) => el.getAttribute('d')));
		for (const d of dBefore) {
			expect(d, 'ink path has real geometry, not an empty/degenerate d attribute').toBeTruthy();
			// Each fixture trace has 8+ points -> at least 7 "L" (lineto) commands
			// after the initial "M"; guards against a collapsed/point-only path.
			expect((d ?? '').split('L').length - 1).toBeGreaterThanOrEqual(7);
		}

		// Save + reload through the app's own UI, then confirm the stroke data
		// is byte-for-byte unchanged - the CH-H2 regression this project's own
		// `ink-save-roundtrip.test.ts` guards against (ink used to be
		// downgraded to a plain `custGeom` shape on any dirty save).
		//
		// Scoped to the toolbar (not a bare `button` text filter): some bindings
		// render an extra, hidden duplicate control tree for responsive
		// breakpoints, so an unscoped text filter can resolve `.first()` to a
		// non-visible copy. Mirrors `ribbon-tab-parity.spec.ts`'s selector.
		const fileTab = page
			.getByRole('tab', { name: 'File', exact: true })
			.or(
				page
					.getByRole('toolbar', { name: 'Presentation toolbar' })
					.getByRole('button', { name: 'File', exact: true }),
			)
			.first();
		await fileTab.click();
		await page.waitForTimeout(300);

		// The File-tab save control is labelled "Save", "Save .pptx", or
		// "Save as .pptx" depending on the binding.
		const downloadPromise = page.waitForEvent('download');
		await page
			.getByRole('button', {
				name: /^Save(?: as)?(?: Presentation)?(?: \(\.pptx\)| \.pptx)?$/iu,
			})
			.last()
			.click();
		const download = await downloadPromise;

		const outDir = fileURLToPath(new URL('../test-results/ole-and-ink/', import.meta.url));
		const { mkdirSync } = await import('node:fs');
		mkdirSync(outDir, { recursive: true });
		const savedPath = resolve(outDir, `${test.info().project.name}-ink-reload.pptx`);
		await download.saveAs(savedPath);

		await page.goto('/');
		await page.locator('#file-input').setInputFiles(savedPath);
		const inkAfterReload = page.locator('[data-element-id]').first();
		await expect(inkAfterReload).toBeVisible();

		const pathsAfter = inkAfterReload.locator('svg path');
		await expect(pathsAfter).toHaveCount(2);
		const dAfter = await pathsAfter.evaluateAll((els) => els.map((el) => el.getAttribute('d')));

		expect(dAfter).toEqual(dBefore);
	});
});
