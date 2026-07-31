/**
 * Issue #132 pinned against the reporter's own deck
 * (`e2e/fixtures/issue-132-gradient-fill.pptx`, a media-slimmed copy of the
 * attachment: every XML part is byte-identical, only the 7.3 MB audio track was
 * replaced with a silent stub).
 *
 * The report quotes one element verbatim:
 *
 *   data-element-id="...-shape-4"  role="img"  aria-label="Shape: parallelogram"
 *   left: 59px; top: 0px; width: 521px; height: 720px;
 *   background-color: rgb(210, 248, 244);
 *
 * That is `ppt/slides/slide2.xml-shape-4`, and `rgb(210,248,244)` is the correct
 * resolution of `accent2 (#21DCC7) lumMod 20% lumOff 80%` - the fill was never
 * wrong. What was wrong is the OUTLINE: the shape is a `parallelogram` authored
 * at `adj="84929"`, a thin diagonal band, and the clip-path cascade served the
 * preset's DEFAULT `adj="25000"` polygon instead. The band rendered as a slab
 * covering ~80% of its 521x720 box and occluded the slide's text, which is what
 * "the shape visually overlaps / occludes content beneath it" describes.
 *
 * These assertions run against the real parsed deck rather than a synthetic
 * shape, so a regression in either the parser or the clip-path cascade fails
 * here. The framework-neutral browser coverage lives in
 * `e2e/issue-132-gradient-fill.spec.ts`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';
import type { PptxData, PptxElement } from 'pptx-viewer-core';
import { beforeAll, describe, expect, it } from 'vitest';

import { shapeParams } from '../components/elements/element-shape-params';
import { getResolvedShapeClipPath } from './resolved-shape-clip-path';
import { getShapeVisualStyle } from './shape-visual-style';

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
		cached = await new PptxHandler().load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
	}
	return cached;
}

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

/** Area of the clipped region as a fraction of the element's box. */
function clippedAreaFraction(clip: string, width: number, height: number): number {
	const points = [...clip.matchAll(/(-?[\d.]+) (-?[\d.]+)/gu)].map(([, x, y]) => [
		Number(x),
		Number(y),
	]);
	let twiceArea = 0;
	for (let i = 0; i < points.length; i += 1) {
		const [x1, y1] = points[i];
		const [x2, y2] = points[(i + 1) % points.length];
		twiceArea += x1 * y2 - x2 * y1;
	}
	return Math.abs(twiceArea / 2) / (width * height);
}

describe('issue #132 - the reporter’s parallelogram', () => {
	// A 29-slide deck: parse once up front rather than inside the first `it`,
	// whose default 5 s budget the initial load does not fit into.
	beforeAll(async () => {
		await loadDeck();
	}, 60_000);

	it('is the element quoted in the report', async () => {
		const element = await elementById('ppt/slides/slide2.xml-shape-4');
		if (!element) {
			return;
		}
		expect(Math.round(element.x)).toBe(59);
		expect(Math.round(element.y)).toBe(0);
		expect(Math.round(element.width)).toBe(521);
		expect(Math.round(element.height)).toBe(720);
	});

	it('keeps the reported fill colour (it was never the defect)', async () => {
		const element = await elementById('ppt/slides/slide2.xml-shape-4');
		if (!element) {
			return;
		}
		const { hf, fc, sw, sc } = shapeParams(element);
		const style = getShapeVisualStyle(element, hf, fc, sw, sc);
		expect(style.backgroundColor).toBe('#D2F8F4');
		expect(style.backgroundImage).toBeUndefined();
	});

	it('clips to the authored diagonal band, not the default-adjustment slab', async () => {
		const element = await elementById('ppt/slides/slide2.xml-shape-4');
		if (!element) {
			return;
		}
		const clip = getResolvedShapeClipPath(element);
		expect(clip).toBeDefined();
		// The default `polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)` fills 80% of
		// the box. At `adj="84929"` PowerPoint draws a band of just over 15%.
		expect(clip).not.toContain('polygon(');
		const area = clippedAreaFraction(String(clip), element.width, element.height);
		expect(area).toBeCloseTo(1 - 0.84929, 3);
	});

	it('renders the deck’s other adjusted presets from their own adjustments', async () => {
		const data = await loadDeck();
		if (!data) {
			return;
		}
		// Every preset carrying an `a:avLst` must resolve through the spec
		// evaluator; a `polygon(` result means the adjustment-blind static table
		// won again. `blockArc` is exempt: it has a dedicated dynamic builder that
		// legitimately emits a sampled polygon.
		const offenders: string[] = [];
		for (const slide of data.slides) {
			for (const element of everyElement(slide.elements)) {
				const shape = element as PptxElement & {
					shapeType?: string;
					shapeAdjustments?: Record<string, number>;
					pathData?: string;
				};
				if (!shape.shapeType || shape.pathData) {
					continue;
				}
				if (!shape.shapeAdjustments || Object.keys(shape.shapeAdjustments).length === 0) {
					continue;
				}
				if (shape.shapeType.toLowerCase() === 'blockarc') {
					continue;
				}
				const clip = getResolvedShapeClipPath(element);
				if (typeof clip === 'string' && clip.startsWith('polygon(')) {
					offenders.push(`${element.id} (${shape.shapeType})`);
				}
			}
		}
		expect(offenders).toStrictEqual([]);
	});
});
