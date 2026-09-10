import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex } from './smartart-constraint-solver';
import {
	fitAspectRatioBox,
	isUserSizeHubRole,
	readAlgorithmAspectRatio,
} from './smartart-layout-interpreter-composite-aspect';

describe('readAlgorithmAspectRatio', () => {
	it("reads a composite's own declared ar param (radial-cluster: Name0, ar=1.00)", () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'Name0',
			algorithm: { type: 'composite', parameters: [{ type: 'ar', value: '1.00' }] },
		};
		expect(readAlgorithmAspectRatio(node)).toBe(1);
	});

	it('returns undefined when no ar param is declared', () => {
		expect(
			readAlgorithmAspectRatio({ name: 'Name0', algorithm: { type: 'composite' } }),
		).toBeUndefined();
		expect(readAlgorithmAspectRatio({ name: 'Name0' })).toBeUndefined();
		expect(readAlgorithmAspectRatio(undefined)).toBeUndefined();
	});

	it('returns undefined for a non-numeric or non-positive ar value', () => {
		expect(
			readAlgorithmAspectRatio({
				name: 'Name0',
				algorithm: { type: 'composite', parameters: [{ type: 'ar', value: 'not-a-number' }] },
			}),
		).toBeUndefined();
		expect(
			readAlgorithmAspectRatio({
				name: 'Name0',
				algorithm: { type: 'composite', parameters: [{ type: 'ar', value: '0' }] },
			}),
		).toBeUndefined();
	});
});

describe('fitAspectRatioBox', () => {
	it('returns the box unchanged when ar is undefined', () => {
		const box = { width: 867, height: 533 };
		expect(fitAspectRatioBox(box, undefined)).toBe(box);
	});

	it("fits a square (ar=1) inside a wider-than-tall box, matching radial-cluster's own COM-verified 533-wide working rectangle", () => {
		const box = { width: 867, height: 533 };
		expect(fitAspectRatioBox(box, 1)).toStrictEqual({ width: 533, height: 533 });
	});

	it('fits a wide rectangle inside a taller-than-wide box (width is the limiting dimension)', () => {
		const box = { width: 300, height: 800 };
		expect(fitAspectRatioBox(box, 2)).toStrictEqual({ width: 300, height: 150 });
	});

	it('returns the box unchanged when it already has exactly the target ratio', () => {
		const box = { width: 400, height: 400 };
		expect(fitAspectRatioBox(box, 1)).toBe(box);
	});
});

describe('isUserSizeHubRole', () => {
	it("true when a userS constraint anywhere targets role via referenceForName (radial-cluster's textCenter)", () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [
					{
						type: 'userS',
						for: 'des',
						pointType: 'node',
						referenceType: 'w',
						referenceFor: 'ch',
						referenceForName: 'textCenter',
						factor: 0.67,
					},
				],
				children: [{ name: 'textCenter' }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(isUserSizeHubRole('textCenter', index)).toBeTruthy();
	});

	it('false for a role no userS constraint ever references', () => {
		const definition: PptxSmartArtLayoutDefinition = {
			rootNode: {
				name: 'Name0',
				constraints: [{ type: 'w', forName: 'plainSlot', referenceType: 'w', factor: 0.5 }],
				children: [{ name: 'plainSlot' }],
			},
		};
		const index = buildConstraintIndex(definition);
		expect(isUserSizeHubRole('plainSlot', index)).toBeFalsy();
	});

	it('false over an empty index', () => {
		expect(isUserSizeHubRole('anything', { entries: new Map(), rootRole: '' })).toBeFalsy();
	});
});
