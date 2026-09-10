import { readFile } from 'node:fs/promises';
/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Save As -> "PowerPoint 97-2003 Presentation (*.ppt)" produces a real
 * binary `.ppt` (OLE2/CFB compound file), in every binding.
 *
 * The format choice sits on the File backstage's "Save As" page, alongside
 * the existing .pptx / .ppsx / .pptm cards (`packages/shared/src/render/
 * backstage-cards.ts` is the one shared source for the card list every
 * binding renders). This spec drives that shared contract only (dialog role
 * "File", "Save As" nav entry, the card's exact accessible name), so it runs
 * unmodified against all five demos via the Playwright project matrix.
 *
 * Verification has two layers, matching how `save-pptx.ts` / `save-corruption-
 * repro.spec.ts` verify `.pptx` downloads:
 *   1. The downloaded bytes start with the CFB signature
 *      `D0 CF 11 E0 A1 B1 1A E1` (proves it is really an OLE2 container, not
 *      a mislabelled OOXML ZIP).
 *   2. `pptx-viewer-core` (the same package the browser bundle embeds) can
 *      load the bytes back and reports the deck's real slide count, proving
 *      the file is not just correctly-signed but structurally readable.
 *
 * Run: bunx playwright test save-as-ppt --workers=1
 */
import { createRequire } from 'node:module';

import { test, expect } from '@playwright/test';

import {
	HYPERLINK_SHAPE_TEXT,
	HYPERLINK_TARGET_URL,
} from './fixtures/generate-hyperlink-action-fixture';
import { fixture, loadDeck } from './support/deck';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
type CoreModule = typeof import('pptx-viewer-core');
const { PptxHandler } = coreRequire('pptx-viewer-core') as CoreModule;

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

test('Save As PowerPoint 97-2003 (.ppt) downloads a real OLE2 binary deck', async ({ page }) => {
	await loadDeck(page);

	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	await toolbar.getByRole('tab', { name: 'File', exact: true }).click();

	const backstage = page.getByRole('dialog', { name: 'File' });
	await backstage.waitFor();

	// "Save As" is a distinct backstage page from "Save"; the format cards
	// (.pptx/.ppsx/.pptm/.ppt) only live there.
	await backstage.getByRole('button', { name: 'Save As', exact: true }).click();

	// The card's accessible name is its title AND body text concatenated (both
	// live inside the same `<button>`), so match the title as a PREFIX rather
	// than the exact full string.
	const downloadPromise = page.waitForEvent('download');
	await backstage.getByRole('button', { name: /^PowerPoint 97-2003 Presentation/u }).click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toMatch(/\.ppt$/iu);

	const path = await download.path();
	expect(path).toBeTruthy();
	const bytes = await readFile(path!);
	expect(Array.from(bytes.subarray(0, 8))).toStrictEqual(CFB_SIGNATURE);

	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	// e2e/fixtures/sample-deck.pptx (loaded by `loadDeck`) has 7 slides.
	expect(data.slides.length).toBe(7);
});

test('Save As .ppt preserves a shape-level hyperlink (a:hlinkClick)', async ({ page }) => {
	// hyperlink-action.pptx (generate-hyperlink-action-fixture.ts) has one
	// slide, one rectangle whose p:cNvPr carries a real a:hlinkClick pointing
	// at an external URL relationship: the binding-neutral input every save
	// path shares, so this proves the same thing for every one of the five
	// demos the Playwright project matrix runs this spec against.
	await loadDeck(page, fixture('hyperlink-action.pptx'));

	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	await toolbar.getByRole('tab', { name: 'File', exact: true }).click();

	const backstage = page.getByRole('dialog', { name: 'File' });
	await backstage.waitFor();
	await backstage.getByRole('button', { name: 'Save As', exact: true }).click();

	const downloadPromise = page.waitForEvent('download');
	await backstage.getByRole('button', { name: /^PowerPoint 97-2003 Presentation/u }).click();
	const download = await downloadPromise;

	const path = await download.path();
	expect(path).toBeTruthy();
	const bytes = await readFile(path!);
	expect(Array.from(bytes.subarray(0, 8))).toStrictEqual(CFB_SIGNATURE);

	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	expect(data.slides.length).toBe(1);
	const shape = data.slides[0]!.elements.find(
		(el) => 'textSegments' in el && el.textSegments?.some((s) => s.text === HYPERLINK_SHAPE_TEXT),
	) as { actionClick?: { url?: string } } | undefined;
	expect(shape).toBeDefined();
	expect(shape?.actionClick?.url).toBe(HYPERLINK_TARGET_URL);
});
