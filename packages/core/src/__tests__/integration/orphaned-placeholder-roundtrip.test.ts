/**
 * Regression guard: a shape whose placeholder reference is orphaned must still
 * load, and its text must survive a save.
 *
 * `<p:ph type="title" idx="4294967295"/>` is PowerPoint's sentinel for "this
 * placeholder no longer has a counterpart on the layout" - 4294967295 is
 * 0xFFFFFFFF, the unsigned encoding of -1, because `CT_Placeholder/@idx` is an
 * `xsd:unsignedInt` and cannot hold a negative number. It is otherwise an
 * entirely ordinary `p:sp` with a `p:txBody`.
 *
 * Treating that sentinel as a real index made the layout/master lookup miss, so
 * the shape resolved no `a:xfrm`, and the parser discarded it. It never reached
 * the model, so the save pipeline had nothing to re-emit: the user's text was
 * silently and permanently gone after one open-and-save, with no warning.
 *
 * The fixture is `e2e/fixtures/solution-explorer.pptx`, a genuine
 * PowerPoint-authored deck. Slide 11 carries the orphaned `Title 1` shape whose
 * text is "---- Challenge 1 -----". Note the leading dashes: an ordinary
 * `TextBox 3` on the same slide reads "Challenge 1", so an assertion on the
 * bare phrase would pass even with the bug present.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect, beforeAll } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/solution-explorer.pptx', import.meta.url),
);

/** The text of the shape that used to be dropped, verbatim from the source. */
const ORPHANED_TEXT = '---- Challenge 1';
/** `p:cNvPr/@name` of that shape. */
const ORPHANED_NAME = 'Title 1';
/** Zero-based index of slide 11. */
const SLIDE_INDEX = 10;

function elementText(el: PptxElement): string {
	return 'text' in el && typeof el.text === 'string' ? el.text : '';
}

describe('orphaned placeholder (idx=4294967295) round trip', () => {
	beforeAll(() => {
		// Committed fixture. Fail loudly rather than skipping green: a silent
		// skip is exactly how this class of loss stayed invisible.
		if (!existsSync(fixture)) {
			throw new Error(`missing committed fixture ${fixture}`);
		}
	});

	it('keeps the sentinel-placeholder shape and its text through load -> save -> reload', async () => {
		const bytes = readFileSync(fixture);
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

		// The source really does carry the sentinel and the text.
		const sourceZip = await JSZip.loadAsync(bytes);
		const sourceSlide = await sourceZip.file('ppt/slides/slide11.xml')!.async('string');
		expect(sourceSlide).toContain('idx="4294967295"');
		expect(sourceSlide).toContain(ORPHANED_TEXT);

		// 1. It must reach the model.
		const handler = new PptxHandler();
		const loaded = await handler.load(buffer);
		const elements = loaded.slides[SLIDE_INDEX].elements;
		const orphaned = elements.find((el) => elementText(el).includes(ORPHANED_TEXT));
		expect(orphaned, 'orphaned-placeholder shape missing from the loaded model').toBeDefined();
		expect(orphaned?.name).toBe(ORPHANED_NAME);

		// 2. It must survive into the saved package.
		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedSlide = await savedZip.file('ppt/slides/slide11.xml')!.async('string');
		expect(savedSlide).toContain(ORPHANED_TEXT);
		expect(savedSlide).toContain(`name="${ORPHANED_NAME}"`);

		// 3. And it must still be there after reloading those bytes.
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reloadedElements = reloaded.slides[SLIDE_INDEX].elements;
		expect(reloadedElements.some((el) => elementText(el).includes(ORPHANED_TEXT))).toBeTruthy();
		expect(reloadedElements).toHaveLength(elements.length);
		// The fixture is a 4.9 MB, 14-slide deck and this walks it three times
		// (load, save, reload), which overruns the 5 s default when the suite
		// runs its files in parallel.
	}, 60_000);
});
