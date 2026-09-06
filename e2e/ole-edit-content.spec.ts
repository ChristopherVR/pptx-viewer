import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * OLE embedded object CONTENT editing, run identically across every
 * framework demo (React, Vue, Angular, Vanilla, Svelte).
 *
 * Fixture: `e2e/fixtures/ole-editable.pptx`, authored via REAL PowerPoint /
 * Excel / Word COM automation (`Shapes.AddOLEObject`), not the SDK/zip-patch
 * technique `ole-and-ink.spec.ts` had to fall back to. It carries five
 * objects on slide 1: an embedded `Excel.Sheet.12` workbook
 * (`Sheet1!A1="Revenue"`, `B1=42`), an embedded `Word.Document.12`
 * ("Hello from Word"), a packaged `.txt` file (generic "Package" object,
 * always shown as an icon), a `DisplayAsIcon:=true` Excel object, and an
 * embedded `PowerPoint.Show.12` nested deck (2 slides: slide 1 has a title
 * + body text box, slide 2 has a title only).
 *
 * This spec exercises the sheet-cell edit path and the nested-deck edit path
 * end to end through the real UI: select the object, open its "Edit
 * content..." dialog (the `pptx.ole.editContent` i18n key every binding
 * shares), edit its content, save the deck through the app's own File > Save
 * (not a synthetic API call), and then verify the SAVED FILE by parsing its
 * embedded payload directly with JSZip (and, for the nested deck, this
 * repo's own `PptxHandler`) in this Node test process - not just by
 * re-rendering the deck in the browser - so a save-path regression (the
 * payload not actually being rewritten into `ppt/embeddings/*`) cannot hide
 * behind a UI that only ever reads its own in-memory state.
 */
import JSZip from 'jszip';
import { PptxHandler, readOleNestedDeckDetail } from 'pptx-viewer-core';

import { savePptxViaBackstage } from './save-pptx';
import { fixture, inspector, loadDeck, selectElement } from './support/deck';
import { downloadBytes } from './support/exports';

const OLE_EDITABLE_FIXTURE = fixture('ole-editable.pptx');
const NEW_CELL_VALUE = '999';
const NEW_DECK_BODY_TEXT = 'Edited Via E2E Nested Deck Test';

/** The nth OLE object on the canvas (0-based, in document order). */
function oleObject(page: Page, index: number): Locator {
	return page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[data-element-id]')
		.nth(index);
}

/** Open the "Edit content..." dialog for the currently-selected OLE object. */
async function openEditContentDialog(page: Page): Promise<Locator> {
	// Some bindings default the inspector to a different tab (e.g. slide
	// properties) on first selection; switch to "Properties" if that tab
	// exists, best-effort, since the OLE panel only renders there.
	const propertiesTab = inspector(page).getByRole('button', { name: 'Properties', exact: true });
	if (await propertiesTab.isVisible().catch(() => false)) {
		await propertiesTab.click();
	}

	const editButton = inspector(page).getByRole('button', { name: 'Edit content...', exact: true });
	await expect(editButton).toBeVisible();
	await editButton.click();

	const dialog = page.getByRole('dialog', { name: 'Edit Embedded Object' });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe('OLE embedded object content editing', () => {
	test('edits a spreadsheet cell and the saved file carries the new value in the embedded workbook', async ({
		page,
	}) => {
		await loadDeck(page, OLE_EDITABLE_FIXTURE);

		// The Excel object is the first shape PowerPoint wrote (see the COM
		// authoring script): select it and open its content editor.
		await selectElement(page, oleObject(page, 0));
		await expect(inspector(page)).toBeVisible();
		const dialog = await openEditContentDialog(page);

		// Every binding's sheet tab is an HTML <table> with one <input> per
		// cell (the shared contract every port followed). The first cell is
		// A1 = "Revenue"; edit B1 (the second cell) instead, which starts
		// at 42.
		const cellInputs = dialog.locator('table input');
		await expect(cellInputs.first()).toBeVisible();
		const secondCell = cellInputs.nth(1);
		await expect(secondCell).toHaveValue('42');
		await secondCell.fill(NEW_CELL_VALUE);
		await secondCell.blur();

		// Give the async edit (decode -> rewrite worksheet -> re-encode ->
		// regenerate preview) a moment to commit before closing.
		await page.waitForTimeout(500);

		const closeButtons = dialog.getByRole('button', { name: /close|save/iu });
		await closeButtons.first().click();

		// Save through the app's own File > Save, exactly as a user would.
		const download = await savePptxViaBackstage(page);
		const bytes = await downloadBytes(download);

		const zip = await JSZip.loadAsync(bytes);
		const embeddingPath = Object.keys(zip.files).find((path) =>
			/^ppt\/embeddings\/.*\.xlsx$/iu.test(path),
		);
		expect(embeddingPath, 'the embedded xlsx part still exists after save').toBeDefined();

		const xlsxBytes = await zip.file(embeddingPath!)!.async('uint8array');
		const xlsxZip = await JSZip.loadAsync(xlsxBytes);
		const sheetXml = await xlsxZip.file('xl/worksheets/sheet1.xml')!.async('string');

		expect(sheetXml, 'the edited cell value is present in the saved embedded workbook').toContain(
			NEW_CELL_VALUE,
		);
	});

	test('a non-editable payload (packaged file) still offers Replace File', async ({ page }) => {
		await loadDeck(page, OLE_EDITABLE_FIXTURE);

		// The packaged .txt object is the third shape (index 2).
		await selectElement(page, oleObject(page, 2));
		await expect(inspector(page)).toBeVisible();
		const dialog = await openEditContentDialog(page);

		await expect(dialog.getByRole('button', { name: /replace file/iu })).toBeVisible();
	});

	test('edits a text-bearing shape on a nested-deck slide and the saved file carries the new text in the embedded presentation', async ({
		page,
	}) => {
		await loadDeck(page, OLE_EDITABLE_FIXTURE);

		// The nested PowerPoint.Show.12 object is the fifth shape (index 4; see
		// the COM authoring script). It has 2 slides: slide 1 has a title + a
		// body text box, slide 2 has a title only, so its editor renders 3
		// inputs total across both slides.
		await selectElement(page, oleObject(page, 4));
		await expect(inspector(page)).toBeVisible();
		const dialog = await openEditContentDialog(page);

		// `input[type="text"]` (not just `input`) to exclude the dialog's own
		// hidden `type="file"` input used for the "Replace File" action.
		const deckInputs = dialog.locator('input[type="text"]');
		await expect(deckInputs).toHaveCount(3);
		await expect(deckInputs.nth(0)).toHaveValue('Nested Slide One Title');
		const bodyInput = deckInputs.nth(1);
		await expect(bodyInput).toHaveValue('Nested Slide One Body');
		await bodyInput.fill(NEW_DECK_BODY_TEXT);
		await bodyInput.blur();

		// Give the async edit (decode nested deck -> PptxHandler.load -> edit
		// the target text run -> PptxHandler.save -> re-encode) a moment to
		// commit before closing; this round-trips the FULL nested presentation,
		// so it is slower than the flat sheet/document edits above.
		await page.waitForTimeout(1500);

		const closeButtons = dialog.getByRole('button', { name: /close|save/iu });
		await closeButtons.first().click();

		// Save through the app's own File > Save, exactly as a user would.
		const download = await savePptxViaBackstage(page);
		const bytes = await downloadBytes(download);

		const zip = await JSZip.loadAsync(bytes);
		const embeddingPath = Object.keys(zip.files).find((path) =>
			/^ppt\/embeddings\/.*\.pptx$/iu.test(path),
		);
		expect(embeddingPath, 'the embedded nested-deck part still exists after save').toBeDefined();

		// Verify through this repo's own core, not just a raw XML string
		// search: the reloaded, saved-and-reopened nested deck's own element
		// inventory carries the edited text on the right slide/shape.
		const nestedDeckBytes = await zip.file(embeddingPath!)!.async('uint8array');
		const detail = await readOleNestedDeckDetail(nestedDeckBytes);
		expect(detail?.[0]?.elements.some((el) => el.text === NEW_DECK_BODY_TEXT)).toBe(true);
		expect(detail?.[0]?.elements.some((el) => el.text === 'Nested Slide One Title')).toBe(true);
		expect(detail?.[1]?.elements.some((el) => el.text === 'Nested Slide Two Title')).toBe(true);

		// And through a full reload of the nested deck via `PptxHandler`
		// itself, matching how the coordinator's requirement is phrased: "the
		// reloaded download's embedded deck carries the edited text via core"
		// (`readOleNestedDeckDetail` above is itself built on `PptxHandler.load`,
		// but re-load it directly too so this assertion does not depend on that
		// helper's own correctness).
		const reloadedNestedDeck = await new PptxHandler().load(
			nestedDeckBytes.buffer.slice(
				nestedDeckBytes.byteOffset,
				nestedDeckBytes.byteOffset + nestedDeckBytes.byteLength,
			) as ArrayBuffer,
		);
		const slide1Texts = reloadedNestedDeck.slides[0]!.elements.filter(
			(el) => el.type === 'text',
		) as Array<{ text?: string; paragraphs?: unknown }>;
		const reloadedRaw = JSON.stringify(slide1Texts);
		expect(reloadedRaw).toContain(NEW_DECK_BODY_TEXT);
	});
});
