/**
 * Label colour (`dsp:style/a:fontRef`) and translucent fill (`a:alpha`) of
 * cached SmartArt drawing shapes, against the 3D parity ground-truth deck
 * `e2e/fixtures/three-d-parity/three-d-smartart.pptx` (slide n = layout
 * floor((n-1)/14), quick style ((n-1)%14)+1).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxSmartArtData, PptxData, SmartArtPptxElement } from '../../types';
import { extractDrawingShapeFontRefColor } from './smartart-drawing-shape-font-ref';

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url),
);

let deck: Promise<PptxData> | undefined;

function loadDeck(): Promise<PptxData> {
	deck ??= (async () => {
		const bytes = readFileSync(fixture);
		return new PptxHandler().load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
	})();
	return deck;
}

async function smartArtOn(slideNumber: number): Promise<PptxSmartArtData> {
	const data = await loadDeck();
	const element = data.slides[slideNumber - 1].elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	if (!element) {
		throw new Error(`slide ${slideNumber} has no smartArt element`);
	}
	return element.smartArtData;
}

describe('smartArt drawing-shape label colour from the style matrix', () => {
	it('reads fontRef colours when the runs carry no fill of their own', async () => {
		// Simple Fill: lt1 labels; Metallic Scene: dk1 (black) labels.
		const simpleFill = await smartArtOn(1);
		expect(simpleFill.drawingShapes?.[0]?.fontColor?.toUpperCase()).toBe('#FFFFFF');
		const metallic = await smartArtOn(12);
		expect(metallic.drawingShapes?.[0]?.fontColor?.toUpperCase()).toBe('#000000');
	}, 30000);

	it('is undefined for a shape without a style reference', () => {
		const deps = {
			getChild: (node: Record<string, unknown> | undefined, local: string) =>
				node?.[local] as Record<string, unknown> | undefined,
			parseColor: () => '#123456',
		};
		expect(extractDrawingShapeFontRefColor({}, deps)).toBeUndefined();
		expect(extractDrawingShapeFontRefColor({ style: { fontRef: { schemeClr: {} } } }, deps)).toBe(
			'#123456',
		);
	});
});

describe('smartArt drawing-shape translucent fill', () => {
	it("keeps Basic Venn's 50% alpha and leaves opaque fills without one", async () => {
		const venn = await smartArtOn(71);
		expect(venn.drawingShapes?.[0]?.fillOpacity).toBeCloseTo(0.5, 6);
		const blockList = await smartArtOn(1);
		expect(blockList.drawingShapes?.[0]?.fillOpacity).toBeUndefined();
	}, 30000);
});
