/**
 * SmartArt flat-path parity against `e2e/fixtures/three-d-parity/three-d-smartart.pptx`:
 * Basic Venn (slide 71) caches its circles as `accent1` at `a:alpha 50000`,
 * which the drawing reader used to drop, so every overlap painted opaque.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxSmartArtData, SmartArtPptxElement } from '../../types';

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url),
);

async function loadSmartArt(slideNumbers: number[]): Promise<PptxSmartArtData[]> {
	const bytes = readFileSync(fixture);
	const data = await new PptxHandler().load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return slideNumbers.map((n) => {
		const element = data.slides[n - 1].elements.find(
			(el): el is SmartArtPptxElement => el.type === 'smartArt',
		);
		if (!element) {
			throw new Error(`slide ${n} has no smartArt element`);
		}
		return element.smartArtData;
	});
}

describe('smartArt drawing fill alpha (ground truth)', () => {
	it('keeps the Basic Venn circles at 50% and the pyramid tiers opaque', async () => {
		const [venn, pyramid] = await loadSmartArt([71, 57]);
		const circles = venn.drawingShapes ?? [];
		expect(circles).toHaveLength(4);
		for (const circle of circles) {
			expect(circle.fillColor).toBe('#156082');
			expect(circle.fillOpacity).toBe(0.5);
		}
		for (const tier of pyramid.drawingShapes ?? []) {
			expect(tier.fillOpacity).toBeUndefined();
		}
	});
});
