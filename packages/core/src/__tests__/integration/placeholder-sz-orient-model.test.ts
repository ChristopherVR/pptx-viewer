/**
 * `p:ph/@sz` and `p:ph/@orient` (CT_Placeholder, ECMA-376 §19.3.1.36) were
 * parsed into the internal `PlaceholderInfo` purely to key placeholder
 * matching, then discarded before reaching the typed element model - no
 * consumer could read a placeholder's declared size hint or vertical-text
 * orientation.
 *
 * `e2e/fixtures/header-footer-shows.pptx` authentically carries
 * `sz="quarter"` / `sz="half"` on its own slide's footer/date/slide-number
 * placeholders (not just on the layout), so this fixture is used unmodified
 * for the `sz` case. `orient="vert"` is injected onto the title placeholder
 * for the `orient` case, mirroring the pattern real decks use (co-located
 * with `a:bodyPr/@vert`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxElement } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/header-footer-shows.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Inject `orient="vert"` onto the slide's own title placeholder. */
async function fixtureWithTitleOrientVert(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(fixtureBytes());
	const slidePath = Object.keys(zip.files).find((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p))!;
	const xml = await zip.file(slidePath)!.async('string');
	expect(xml).toContain('<p:ph type="title"/>');
	zip.file(slidePath, xml.replace('<p:ph type="title"/>', '<p:ph type="title" orient="vert"/>'));
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function byPlaceholderType(elements: PptxElement[], type: string): PptxElement | undefined {
	return elements.find((el) => el.placeholderType === type);
}

describe('placeholder @sz / @orient exposed on the element model', () => {
	it('exposes `placeholderSz` for footer/date/slide-number placeholders', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const slide = data.slides[0]!;
		expect(byPlaceholderType(slide.elements, 'ftr')?.placeholderSz).toBe('quarter');
		expect(byPlaceholderType(slide.elements, 'sldnum')?.placeholderSz).toBe('quarter');
		expect(byPlaceholderType(slide.elements, 'dt')?.placeholderSz).toBe('half');
	});

	it('exposes `placeholderOrient` for a vertically-oriented placeholder', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithTitleOrientVert());
		const title = byPlaceholderType(data.slides[0]!.elements, 'title');
		expect(title?.placeholderOrient).toBe('vert');
	});

	it('leaves `placeholderSz` / `placeholderOrient` undefined when absent', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const title = byPlaceholderType(data.slides[0]!.elements, 'title');
		expect(title?.placeholderSz).toBeUndefined();
		expect(title?.placeholderOrient).toBeUndefined();
	});

	it('round-trips through a full save/reload even after an unrelated edit', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await fixtureWithTitleOrientVert());
		const slide = data.slides[0]!;
		const footer = byPlaceholderType(slide.elements, 'ftr');
		expect(footer?.placeholderSz).toBe('quarter');
		// Touch unrelated text on the same slide so the shape tree is rebuilt
		// from the typed model rather than skipped as unmodified.
		const title = byPlaceholderType(slide.elements, 'title') as { text?: string };
		if (title) {
			title.text = 'Edited Title';
		}
		slide.isDirty = true;

		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reloadedSlide = reloaded.slides[0]!;
		expect(byPlaceholderType(reloadedSlide.elements, 'ftr')?.placeholderSz).toBe('quarter');
		expect(byPlaceholderType(reloadedSlide.elements, 'title')?.placeholderOrient).toBe('vert');
	});
});
