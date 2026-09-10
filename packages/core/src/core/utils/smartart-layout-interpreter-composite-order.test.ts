import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { representativeSlotsPerPoint } from './smartart-layout-interpreter-composite-order';
import type { SlottedDims } from './smartart-layout-interpreter-composite-slots';

function slot(name: string, algType: string | undefined, hideGeom = false): SlottedDims {
	const node: PptxSmartArtLayoutNode = {
		name,
		algorithm: algType ? { type: algType } : undefined,
		shape: hideGeom ? { hideGeometry: true } : undefined,
	};
	return { node, dims: { w: { px: 10 } } };
}

/**
 * `hexagon-cluster--hier5.pptx` (round 40): a repeated per-point template
 * declares 4 positioned roles per point (`textN`/`textaccentN`/`imageN`/
 * `imageaccentN`) on the composite root; `arrangeByOrder`'s blind
 * document-order zip against 3 real points consumed `text1, textaccent1,
 * image1` (point 1's own 4 roles) instead of one representative per point.
 */
describe('representativeSlotsPerPoint (round 40)', () => {
	it('collapses a 4-roles-per-point run down to the text role, one per point', () => {
		const slotted = [
			slot('text1', 'tx'),
			slot('textaccent1', 'sp'),
			slot('image1', 'sp'),
			slot('imageaccent1', 'sp'),
			slot('text2', 'tx'),
			slot('textaccent2', 'sp'),
			slot('image2', 'sp'),
			slot('imageaccent2', 'sp'),
			slot('text3', 'tx'),
			slot('textaccent3', 'sp'),
			slot('image3', 'sp'),
			slot('imageaccent3', 'sp'),
		];
		const result = representativeSlotsPerPoint(slotted, 3);
		expect(result.map((entry) => entry.node.name)).toStrictEqual(['text1', 'text2', 'text3']);
	});

	it('falls back to the first non-hideGeom member when a run has no text role', () => {
		const slotted = [
			slot('accent1', 'sp', true),
			slot('image1', 'sp'),
			slot('accent2', 'sp', true),
			slot('image2', 'sp'),
		];
		const result = representativeSlotsPerPoint(slotted, 2);
		expect(result.map((entry) => entry.node.name)).toStrictEqual(['image1', 'image2']);
	});

	it('is a no-op when there are no more slots than points (the ordinary case)', () => {
		const slotted = [slot('a', 'tx'), slot('b', 'tx'), slot('c', 'tx')];
		expect(representativeSlotsPerPoint(slotted, 3)).toBe(slotted);
		expect(representativeSlotsPerPoint(slotted, 5)).toBe(slotted);
	});

	it('is a no-op when the slot count does not split evenly across the points', () => {
		const slotted = [
			slot('a', 'tx'),
			slot('b', 'tx'),
			slot('c', 'tx'),
			slot('d', 'tx'),
			slot('e', 'tx'),
		];
		expect(representativeSlotsPerPoint(slotted, 2)).toBe(slotted);
	});
});
