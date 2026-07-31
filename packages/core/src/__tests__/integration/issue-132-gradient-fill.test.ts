/**
 * Core-level regression guards for issue #132, pinned against the reporter's own
 * deck (`e2e/fixtures/issue-132-gradient-fill.pptx` - a media-slimmed copy of the
 * attachment whose every XML part is byte-identical; only the 7.3 MB background
 * audio track was replaced with a silent stub).
 *
 * The report was filed as "gradient fill renders as solid colour" against a
 * parallelogram on slide 2. Two separate defects sat behind that render:
 *
 *  1. The shape the reporter quoted (`...slide2.xml-shape-4`, `rgb(210,248,244)`
 *     = `accent2 lumMod 20% lumOff 80%`) is not a gradient at all: it is a
 *     `parallelogram` authored at `adj="84929"`, a thin diagonal band. Every
 *     renderer clipped it with the preset's DEFAULT `adj="25000"` polygon, which
 *     covers ~80% of the box, so the shape flooded the slide and occluded the
 *     text behind it. The adjustment is parsed correctly and the ECMA-376 preset
 *     evaluator honours it, so the tests below pin both.
 *  2. Gradients elsewhere in the deck (slides 3, 4, 11, 13, 21) do parse into
 *     structured stops, including the `a:alpha val="0"` stop that makes slide
 *     11's shadow fade out. Those are pinned so a future parser change cannot
 *     silently collapse a `a:gradFill` back to its representative solid.
 *
 * The CSS/SVG side of the same issue is covered in `pptx-viewer-shared`
 * (`render/shape-geometry.test.ts`, `render/fill-style.test.ts`,
 * `render/svg-gradient-paint.test.ts`) and in the React binding.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, it, expect } from 'vitest';

import { getShapeClipPathFromPreset } from '../../core/geometry';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxElement } from '../../core/types';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/issue-132-gradient-fill.pptx', import.meta.url),
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

async function elementById(id: string): Promise<PptxElement | undefined> {
	const data = await loadDeck();
	if (!data) {
		return undefined;
	}
	for (const slide of data.slides) {
		const hit = everyElement(slide.elements).find((element) => element.id === id);
		if (hit) {
			return hit;
		}
	}
	return undefined;
}

describe('issue #132 - the reporter deck parses its fills and adjustments', () => {
	// A 29-slide deck: parse once up front rather than inside the first `it`,
	// whose default 5 s budget a cold load does not reliably fit into.
	beforeAll(async () => {
		await loadDeck();
	}, 60_000);

	it('loads every slide', async () => {
		const data = await loadDeck();
		if (!data) {
			return;
		}
		expect(data.slides).toHaveLength(29);
	});

	it('keeps the quoted parallelogram’s authored adj instead of the preset default', async () => {
		const element = await elementById('ppt/slides/slide2.xml-shape-4');
		if (!element) {
			return;
		}
		const shape = element as PptxElement & {
			shapeType?: string;
			shapeAdjustments?: Record<string, number>;
		};
		expect(shape.shapeType).toBe('parallelogram');
		// The exact colour quoted in the issue: accent2 (#21DCC7) lumMod 20% + lumOff 80%.
		expect(
			(element as PptxElement & { shapeStyle?: { fillColor?: string } }).shapeStyle?.fillColor,
		).toBe('#D2F8F4');
		// `<a:gd name="adj" fmla="val 84929"/>` - a thin diagonal band, NOT the
		// 25000 default that made the shape cover most of its box.
		expect(shape.shapeAdjustments?.adj).toBe(84929);
	});

	it('evaluates the parallelogram preset against its own adjustment', async () => {
		const element = await elementById('ppt/slides/slide2.xml-shape-4');
		if (!element) {
			return;
		}
		const adjustments = (element as PptxElement & { shapeAdjustments?: Record<string, number> })
			.shapeAdjustments;
		const clip = getShapeClipPathFromPreset(
			'parallelogram',
			element.width,
			element.height,
			adjustments,
		);
		expect(clip).toBeDefined();
		// x2 = ss * adj / 100000 with ss = min(w, h) = the width here, so the top
		// edge starts ~85% across. The default-adjustment polygon put it at 20%.
		const topEdgeX = Number(/L ([\d.]+) 0 /u.exec(String(clip))?.[1]);
		expect(topEdgeX / element.width).toBeCloseTo(0.84929, 4);
	});

	it('parses a linear gradFill into structured stops, not a single solid', async () => {
		const element = await elementById('ppt/slides/slide3.xml-shape-4');
		if (!element) {
			return;
		}
		const style = (
			element as PptxElement & {
				shapeStyle?: {
					fillMode?: string;
					fillGradientType?: string;
					fillGradientAngle?: number;
					fillGradientStops?: { color: string; position: number }[];
				};
			}
		).shapeStyle;
		expect(style?.fillMode).toBe('gradient');
		expect(style?.fillGradientType ?? 'linear').toBe('linear');
		// `<a:lin ang="5400000"/>` = 90 OOXML degrees (top to bottom).
		expect(style?.fillGradientAngle).toBe(90);
		expect(style?.fillGradientStops).toStrictEqual([
			expect.objectContaining({ color: '#CDAE71', position: 0 }),
			expect.objectContaining({ color: '#94714A', position: 66 }),
		]);
	});

	it('preserves a fully transparent gradient stop (a:alpha val="0")', async () => {
		const element = await elementById('ppt/slides/slide11.xml-shape-2');
		if (!element) {
			return;
		}
		const style = (
			element as PptxElement & {
				shapeStyle?: {
					fillMode?: string;
					fillGradientType?: string;
					fillGradientPathType?: string;
					fillGradientStops?: { color: string; position: number; opacity?: number }[];
				};
			}
		).shapeStyle;
		expect(style?.fillMode).toBe('gradient');
		expect(style?.fillGradientType).toBe('radial');
		expect(style?.fillGradientPathType).toBe('shape');
		const stops = style?.fillGradientStops ?? [];
		// The soft drop shadow fades to nothing; losing the alpha turns it into an
		// opaque white blob over the slide.
		expect(stops.find((stop) => stop.position === 100)?.opacity).toBe(0);
	});

	it('keeps the tileRect of the corner radial gradient PowerPoint authored', async () => {
		const element = await elementById('ppt/slides/slide4.xml-shape-3');
		if (!element) {
			return;
		}
		const style = (
			element as PptxElement & {
				shapeStyle?: {
					fillGradientPathType?: string;
					fillGradientFillToRect?: { l: number; t: number; r: number; b: number };
					fillGradientTileRect?: { l: number; t: number; r: number; b: number };
				};
			}
		).shapeStyle;
		expect(style?.fillGradientPathType).toBe('circle');
		expect(style?.fillGradientFillToRect).toMatchObject({ r: 1, b: 1 });
		// `<a:tileRect l="-100000" t="-100000"/>`: the tile is TWICE the shape and
		// hangs off its top-left, so the focal corner sits outside the box.
		expect(style?.fillGradientTileRect).toMatchObject({ l: -1, t: -1 });
	});
});
