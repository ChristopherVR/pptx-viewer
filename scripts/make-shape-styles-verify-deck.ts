/**
 * Builds a deck whose shapes carry Shape Styles gallery picks applied through
 * the shared gallery (`applyRibbonGalleryItem`) and saved by the core writer,
 * for `scripts/verify-shape-styles-com.ps1` to compare against PowerPoint's
 * own `Shape.ShapeStyle` on the same deck.
 *
 *   bun scripts/make-shape-styles-verify-deck.ts <out.pptx>
 *
 * Shape N is named `gallery-<itemId>-<msoShapeStylePreset index>`.
 */
import { writeFileSync } from 'node:fs';

import { PptxHandler } from '../packages/core/src';
import type { PptxElement } from '../packages/core/src';
import { applyRibbonGalleryItem } from '../packages/shared/src/render/ribbon-galleries/gallery-registry';

const out = process.argv[2];
if (!out) {
	throw new Error('usage: bun scripts/make-shape-styles-verify-deck.ts <out.pptx>');
}

/** (gallery item id, PowerPoint msoShapeStylePreset index). */
const PICKS: ReadonlyArray<readonly [string, number]> = [
	['theme-0-0', 1],
	['theme-0-1', 2],
	['theme-1-1', 9],
	['theme-2-2', 17],
	['theme-3-3', 25],
	['theme-4-4', 33],
	['theme-5-5', 41],
	['theme-5-6', 42],
	['preset-0-1', 44],
	['preset-1-2', 52],
	['preset-2-3', 60],
	['preset-3-4', 68],
	['preset-4-5', 76],
];

const { handler, data, createSlide } = await PptxHandler.createBlank({ title: 'Shape Styles' });
let slide = createSlide('Blank');
PICKS.forEach(([, preset], i) => {
	slide = slide.addShape('rect', {
		x: 20 + (i % 5) * 180,
		y: 20 + Math.floor(i / 5) * 120,
		width: 160,
		height: 90,
		text: `S${preset}`,
		fill: { type: 'solid', color: '#FF0000' },
	});
});
data.slides = [slide.build()];
const bytes = await handler.save(data.slides);
const loader = new PptxHandler();
const loaded = await loader.load(bytes.buffer as ArrayBuffer);
const shapes = loaded.slides[0].elements.filter((el) => el.type === 'shape');
const ctx = {
	themeColorMap: loaded.themeColorMap,
	theme: loaded.theme,
	resolveStyleMatrix: (xml: Parameters<PptxHandler['resolveStyleMatrixReferences']>[0]) =>
		loader.resolveStyleMatrixReferences(xml),
};
loaded.slides[0].elements = loaded.slides[0].elements.map((el): PptxElement => {
	const index = shapes.indexOf(el);
	if (index < 0) {
		return el;
	}
	const [itemId, preset] = PICKS[index];
	const result = applyRibbonGalleryItem('shapeStyles', itemId, { ...ctx, element: el });
	if (result?.kind !== 'element') {
		throw new Error(`no patch for ${itemId}`);
	}
	return { ...el, ...result.patch, name: `gallery-${itemId}-${preset}` } as PptxElement;
});
writeFileSync(out, await loader.save(loaded.slides));
console.log(`wrote ${out}`);
