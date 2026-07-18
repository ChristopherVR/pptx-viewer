/**
 * Shared, framework-neutral ".pptx save -> browser download" step.
 *
 * Since the full-screen File backstage landed, clicking the ribbon's File tab
 * no longer reveals a flat list with a single "Save .pptx" button: it opens a
 * modal backstage overlay (role="dialog", aria-label="File") whose sidebar has
 * BOTH a "Save" and a "Save As" entry (shared `BACKSTAGE_NAV` contract,
 * `packages/shared/src/render/backstage.ts`, rendered identically by all five
 * bindings). The old spec selector
 * `/^Save(?: as)?(?: Presentation)?(?: \(\.pptx\)| \.pptx)?$/iu` matched both,
 * and `.first()`/`.last()` could resolve to the "Save As" NAV button, which
 * only switches the backstage page (no download), so
 * `page.waitForEvent('download')` timed out in every binding.
 *
 * The real current flow, identical across React, Vue, Angular, Vanilla, and
 * Svelte:
 *   File tab -> backstage opens -> sidebar "Save" (or Save As page ->
 *   "PowerPoint Presentation") -> triggers the binding's save-as-pptx handler,
 *   which serializes the deck and starts a browser download of the .pptx,
 *   then closes the backstage.
 *
 * This helper drives that flow through the shared semantic contract only
 * (toolbar/tab/dialog roles + exact "Save" name), keeping the calling specs
 * framework-neutral per `scripts/check-e2e-neutrality.mjs`.
 */
import type { Download, Page } from '@playwright/test';

/**
 * Open the File backstage and click its sidebar "Save" entry, resolving with
 * the resulting `.pptx` `Download`. The backstage closes itself after Save,
 * so the page is back on the editor when this resolves.
 */
export async function savePptxViaBackstage(page: Page): Promise<Download> {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	await toolbar.getByRole('tab', { name: 'File', exact: true }).click();

	// The backstage is a modal dialog labelled "File" in every binding.
	const backstage = page.getByRole('dialog', { name: 'File' });
	await backstage.waitFor();

	const downloadPromise = page.waitForEvent('download');
	// `exact: true` is load-bearing: the sidebar also has a "Save As" button
	// that only switches the backstage page and must not match.
	await backstage.getByRole('button', { name: 'Save', exact: true }).click();
	return downloadPromise;
}
