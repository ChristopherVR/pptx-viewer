/**
 * Real PowerPoint ink, end to end.
 *
 * PowerPoint writes every inked stroke as `mc:Choice Requires="p14"` around a
 * `p:contentPart` whose children are all p14-qualified. The `p14` capability
 * set in `mc-capabilities.ts` listed only transition / media / bookmark local
 * names, so `isAlternateContentChoiceSupported` rejected that Choice, the
 * rasterized `mc:Fallback` was taken instead, and the InkML decoder - which
 * works - never once received a stroke from a real deck. Three further faults
 * sat behind it and were invisible while nothing reached them:
 *
 *  1. `parseContentPart` read `p:xfrm` only, so a selected Choice would still
 *     have fallen back to the hardcoded 0,0,120x80 placement.
 *  2. The trace decoder split values on whitespace, but PowerPoint emits the
 *     compact difference encoding where the sign doubles as the separator
 *     (`100 200,'40'46,"0"-5,0-10`), so a stroke decoded to ONE point.
 *  3. Brushes were looked up as direct children of `<ink>`, but PowerPoint
 *     nests them in `<inkml:definitions>` and measures them in `cm`, so every
 *     stroke fell back to 1 px black.
 *
 * The fixture is PowerPoint's own serialization: the markup was injected into a
 * PowerPoint-created deck and then saved again FROM PowerPoint, which is where
 * the difference-encoded traces come from. PowerPoint reports both content
 * parts as msoInk (Shape.Type 23) at the exact `p14:xfrm` box.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { ContentPartPptxElement, PptxElement } from '../../core/types';
import { requireFixture } from '../require-fixture';

const fixture = requireFixture(
	path.resolve(__dirname, '../../../../../e2e/fixtures/ink-contentpart.pptx'),
);

const contentParts = (elements: readonly PptxElement[]): ContentPartPptxElement[] =>
	elements.filter((el): el is ContentPartPptxElement => el.type === 'contentPart');

async function loadFixture() {
	return new PptxHandler().load(new Uint8Array(readFileSync(fixture)));
}

describe('real PowerPoint contentPart ink', () => {
	it('selects the p14 Choice, so the ink reaches the model at all', async () => {
		const data = await loadFixture();
		const parts = data.slides.flatMap((slide) => contentParts(slide.elements));
		expect(parts).toHaveLength(2);
		// The rejected-Choice path used to leave the mc:Fallback shape instead,
		// a plain grey rectangle carrying the text "ink fallback".
		const fallbackText = data.slides
			.flatMap((slide) => slide.elements)
			.filter((el) => el.type === 'text' || el.type === 'shape')
			.map((el) => String((el as { text?: string }).text ?? ''));
		expect(fallbackText.join(' ')).not.toContain('ink fallback');
	});

	it('places the strokes from p14:xfrm, not the 120x80 default', async () => {
		const data = await loadFixture();
		const [first, second] = data.slides.flatMap((slide) => contentParts(slide.elements));
		// slide 1: off 1524000,1905000  ext 3240000x1224000 EMU at 9525 EMU/px.
		expect(first.x).toBeCloseTo(160, 3);
		expect(first.y).toBeCloseTo(200, 3);
		expect(first.width).toBeCloseTo(3240000 / 9525, 3);
		expect(first.height).toBeCloseTo(1224000 / 9525, 3);
		// slide 2: off 914400,2743200  ext 4572000x914400.
		expect(second.x).toBeCloseTo(96, 3);
		expect(second.width).toBeCloseTo(480, 3);
		expect(second.height).toBeCloseTo(96, 3);
	});

	it('decodes every difference-encoded trace, with its InkML brush', async () => {
		const data = await loadFixture();
		const [first, second] = data.slides.flatMap((slide) => contentParts(slide.elements));

		expect(first.inkStrokes).toHaveLength(4);
		expect(second.inkStrokes).toHaveLength(3);

		// The 31-point sine would have decoded to a single point (one `M`, no `L`)
		// under the whitespace tokenizer.
		const sine = first.inkStrokes?.[0];
		expect(sine?.path.match(/L/gu) ?? []).toHaveLength(30);

		// Brush colours come from <inkml:definitions>, widths from `units="cm"`
		// (0.05 cm and 0.1 cm at 96 px/in).
		expect(first.inkStrokes?.map((stroke) => stroke.color)).toStrictEqual([
			'#E81123',
			'#0078D7',
			'#0078D7',
			'#0078D7',
		]);
		expect(first.inkStrokes?.[0].width).toBeCloseTo((0.05 * 96) / 2.54, 4);
		expect(first.inkStrokes?.[1].width).toBeCloseTo((0.1 * 96) / 2.54, 4);
	});

	it('normalises the ink coordinate space onto the p14:xfrm box', async () => {
		const data = await loadFixture();
		const [first] = data.slides.flatMap((slide) => contentParts(slide.elements));
		const numbers = (first.inkStrokes ?? []).flatMap((stroke) =>
			[...stroke.path.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/gu)].map((m) => [
				Number(m[1]),
				Number(m[2]),
			]),
		);
		const xs = numbers.map(([x]) => x);
		const ys = numbers.map(([, y]) => y);
		// PowerPoint stretches the union bounding box of all traces onto the box
		// independently per axis (measured against its own 120 px/in render), so
		// the extremes land exactly on the element bounds.
		expect(Math.min(...xs)).toBeCloseTo(0, 6);
		expect(Math.min(...ys)).toBeCloseTo(0, 6);
		expect(Math.max(...xs)).toBeCloseTo(first.width, 6);
		expect(Math.max(...ys)).toBeCloseTo(first.height, 6);
	});

	it('leaves both InkML parts byte-identical on an untouched save', async () => {
		const bytes = new Uint8Array(readFileSync(fixture));
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes);
		const saved = await handler.save(loaded.slides);

		const before = await JSZip.loadAsync(bytes);
		const after = await JSZip.loadAsync(saved);
		for (const part of ['ppt/ink/ink1.xml', 'ppt/ink/ink2.xml']) {
			const original = await before.file(part)?.async('string');
			const written = await after.file(part)?.async('string');
			expect(written, `${part} must survive the save`).toBeDefined();
			// `buildInkMlContent` rewrites the part into the library's own authored
			// dialect. It also used to key the rebuilt root `ink:ink` while the
			// loaded part was keyed `inkml:ink`, producing an XML part with TWO
			// root elements. Neither may happen when nothing about the ink changed.
			expect(written).toBe(original);
		}

		const reloaded = await new PptxHandler().load(saved);
		const parts = reloaded.slides.flatMap((slide) => contentParts(slide.elements));
		expect(parts.map((part) => part.inkStrokes?.length)).toStrictEqual([4, 3]);
		expect(parts[0].inkStrokes?.[0].color).toBe('#E81123');
	});
});
