/**
 * Core-level regression guards for issue #130, pinned against the reporter's
 * own deck (`e2e/fixtures/solution-explorer.pptx` - a media-slimmed copy whose
 * XML parts are byte-identical to the attachment).
 *
 * Ground truth for every expectation below is PowerPoint's own render of the
 * same file, exported via COM.
 *
 * The four defects covered here are all parse-side, so fixing them here fixes
 * every binding at once:
 *
 *  - Morph written as a direct `<p159:morph/>` child was dropped to `cut`.
 *  - Text colour fell through to `p:defaultTextStyle` black instead of the
 *    white supplied by the shape's `<p:style><a:fontRef>`.
 *  - `<a:ln><a:noFill/></a:ln>` made the shape-style extractor return early,
 *    discarding `fontRef` (and every effect below it).
 *  - A bullet with no `buSz` was sized from the text body default rather than
 *    the paragraph's first run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxElement } from '../../core/types';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/solution-explorer.pptx', import.meta.url),
);

let cached: PptxData | undefined;

async function loadDeck(): Promise<PptxData | undefined> {
	if (!existsSync(fixture)) {
		return undefined;
	}
	if (!cached) {
		const bytes = readFileSync(fixture);
		const handler = new PptxHandler();
		cached = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
	}
	return cached;
}

/** Depth-first walk including group children. */
function everyElement(elements: readonly PptxElement[]): PptxElement[] {
	const out: PptxElement[] = [];
	const visit = (element: PptxElement): void => {
		out.push(element);
		for (const child of (element as { children?: PptxElement[] }).children ?? []) {
			visit(child);
		}
	};
	for (const element of elements) {
		visit(element);
	}
	return out;
}

function findByName(data: PptxData, slideIndex: number, name: string): PptxElement | undefined {
	return everyElement(data.slides[slideIndex].elements).find((e) => e.name === name);
}

describe('issue #130 - solution-explorer parse fidelity', () => {
	it('recognises the direct-child morph on every slide that carries one', async () => {
		const data = await loadDeck();
		if (!data) {
			return;
		}

		// Slides 3-14 all carry `<p159:morph option="byObject"/>` inside an
		// `mc:Choice Requires="p159"`. Every one of them parsed as `cut` before.
		const morphSlides = data.slides.filter((s) => s.transition?.type === 'morph');

		expect(morphSlides).toHaveLength(12);
		for (const slide of morphSlides) {
			expect(slide.transition?.morphOption).toBe('byObject');
			expect(slide.transition?.speed).toBe('slow');
		}
	});

	it('resolves text colour from the shape style fontRef, not the presentation default', async () => {
		const data = await loadDeck();
		if (!data) {
			return;
		}

		// "Explore solution" (slide 3) is an orange button whose runs declare no
		// `a:solidFill`. Its colour comes from
		// `<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>` -> theme
		// lt1 -> white. It resolved to #000000 (tx1, via `p:defaultTextStyle`).
		const button = findByName(data, 2, 'Rectangle 4');

		expect(button).toBeDefined();
		expect((button as { textStyle?: { color?: string } }).textStyle?.color).toBe('#FFFFFF');
		// The run-level style is what the renderers actually paint, so the fix has
		// to reach the segments, not just the element.
		const segments = (button as { textSegments?: Array<{ style?: { color?: string } }> })
			.textSegments;
		expect(segments?.length).toBeGreaterThan(0);
		for (const segment of segments ?? []) {
			expect(segment.style?.color).toBe('#FFFFFF');
		}
	});

	it('keeps the fontRef style reference on a shape with an explicit no-fill outline', async () => {
		const data = await loadDeck();
		if (!data) {
			return;
		}

		// Every button in this deck carries `<a:ln><a:noFill/></a:ln>`, which used
		// to short-circuit the whole shape-style extractor.
		const button = findByName(data, 2, 'Rectangle 4') as
			| { shapeStyle?: { fontRefIdx?: string; strokeFillMode?: string } }
			| undefined;

		expect(button?.shapeStyle?.fontRefIdx).toBe('minor');
		// ...without losing what the early return DID get right.
		expect(button?.shapeStyle?.strokeFillMode).toBe('none');
	});

	it('sizes an unsized bullet from its paragraph first run, not the body default', async () => {
		const data = await loadDeck();
		if (!data) {
			return;
		}

		// Slide 14 mixes a Wingdings and an Arial `buChar`, neither carrying
		// `buSzPct`/`buSzPts`. PowerPoint draws both at 100% of the paragraph's
		// first run (8-10pt); the Wingdings ones were coming out at the 18pt
		// body default - 24px against the Arial one's 13.3px.
		const bulletSizes = everyElement(data.slides[13].elements)
			.flatMap(
				(e) =>
					(e as { textSegments?: Array<{ bulletInfo?: unknown; style?: { fontSize?: number } }> })
						.textSegments ?? [],
			)
			.filter((segment) => segment.bulletInfo)
			.map((segment) => segment.style?.fontSize)
			.filter((size): size is number => typeof size === 'number');

		expect(bulletSizes.length).toBeGreaterThan(1);
		expect(Math.max(...bulletSizes)).toBeLessThan(20);
		// All three derive from 8-10pt runs, so they must land close together.
		expect(Math.max(...bulletSizes) / Math.min(...bulletSizes)).toBeLessThan(1.6);
	});

	it('keeps a grouped shape its own hyperlink, font and colour', async () => {
		const data = await loadDeck();
		if (!data) {
			return;
		}

		// Slide 12's callouts are `p:grpSp` children carrying their own
		// `a:hlinkClick` slide-jump plus an explicit Arial / bg1 run style.
		const callout = findByName(data, 11, 'TextBox 6') as
			| {
					actionClick?: { action?: string; targetSlideIndex?: number };
					textStyle?: { color?: string; fontFamily?: string };
			  }
			| undefined;

		expect(callout?.actionClick?.action).toBe('ppaction://hlinksldjump');
		expect(callout?.actionClick?.targetSlideIndex).toBe(12);
		expect(callout?.textStyle?.fontFamily).toBe('Arial');
		expect(callout?.textStyle?.color).toBe('#FFFFFF');
	});
});
