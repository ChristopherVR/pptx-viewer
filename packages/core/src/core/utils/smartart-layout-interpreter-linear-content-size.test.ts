import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition } from '../types';
import { DEFAULT_FONT_ADVANCE_TABLE } from './font-advance-widths.generated';
import { buildConstraintIndex } from './smartart-constraint-solver';
import {
	isMainAxisContentSized,
	resolveContentSizedExtents,
} from './smartart-layout-interpreter-linear-content-size';

describe('isMainAxisContentSized', () => {
	it('is true for a literal val="INF" h constraint ("Vertical Box List"\'s own parentLin item template)', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'linear',
				algorithm: { type: 'lin' },
				children: [{ name: 'parentLin' }],
				constraints: [
					{ type: 'h', for: 'ch', forName: 'parentLin', value: Number.POSITIVE_INFINITY },
				],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(isMainAxisContentSized(index, 'linear', 'parentLin', 'h')).toBeTruthy();
	});

	it('is false when nothing is declared at all (the common, unrelated case)', () => {
		const index = buildConstraintIndex({
			rootNode: { name: 'linear', algorithm: { type: 'lin' } },
		});
		expect(isMainAxisContentSized(index, 'linear', 'parentLin', 'h')).toBeFalsy();
	});

	it('is false for a finite literal h (a real declared value, not "no limit")', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'linear',
				algorithm: { type: 'lin' },
				children: [{ name: 'node' }],
				constraints: [{ type: 'h', for: 'ch', forName: 'node', value: 100 }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(isMainAxisContentSized(index, 'linear', 'node', 'h')).toBeFalsy();
	});
});

describe('resolveContentSizedExtents', () => {
	const index = buildConstraintIndex({ rootNode: { name: 'linear', algorithm: { type: 'lin' } } });

	it('gives a longer text a taller natural extent than a short one, at the SAME font size', () => {
		const extents = resolveContentSizedExtents(
			['Short', 'A much, much longer line of text that wraps repeatedly'],
			200,
			24,
			DEFAULT_FONT_ADVANCE_TABLE,
			0.9,
			'node',
			index,
			0,
			10000,
			10,
		);
		expect(extents[1]).toBeGreaterThan(extents[0]);
	});

	it('scales every extent down by the SAME factor when the sum would overflow usableMain (the ECMA fallback)', () => {
		const usableMain = 100;
		const extents = resolveContentSizedExtents(
			['Alpha', 'Alpha'],
			200,
			24,
			DEFAULT_FONT_ADVANCE_TABLE,
			0.9,
			'node',
			index,
			0,
			usableMain,
			0,
		);
		expect(extents[0]).toBeCloseTo(extents[1], 5);
		expect(extents[0] + extents[1]).toBeCloseTo(usableMain, 5);
	});

	it('leaves extents unscaled when the sum already fits usableMain', () => {
		const extents = resolveContentSizedExtents(
			['Alpha', 'Beta'],
			200,
			24,
			DEFAULT_FONT_ADVANCE_TABLE,
			0.9,
			'node',
			index,
			0,
			10000,
			10,
		);
		const total = extents[0] + extents[1] + 10;
		expect(total).toBeLessThan(10000);
		expect(extents[0]).toBeGreaterThan(0);
	});
});
