import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { tailedHierarchyDeclaresChAlign } from './smartart-hierarchy-tailed-transpose';

/** A `dgm:choose` branch whose raw XML nests `dgm:alg[@type=hierChild]/dgm:param`s, as `activeBranch`/`branchAlg` (choose-algorithm.ts) would see them. */
function algBranch(params: Record<string, string>): { rawXml: Record<string, unknown> } {
	return {
		rawXml: {
			'dgm:alg': {
				'@_type': 'hierChild',
				'dgm:param': Object.entries(params).map(([type, val]) => ({
					'@_type': type,
					'@_val': val,
				})),
			},
		},
	};
}

describe('tailedHierarchyDeclaresChAlign', () => {
	it('is false for undefined algorithmNode', () => {
		expect(tailedHierarchyDeclaresChAlign(undefined)).toBeFalsy();
	});

	it('is false when the top-level choose only mirrors linDir fromL/fromR (plain "Organization Chart"/"Half Circle Organization Chart"/"Name and Title Organization Chart" own shape - no chAlign at this level in either dir=norm/rtl branch)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: algBranch({ linDir: 'fromL' }).rawXml,
						},
					],
					otherwise: algBranch({ linDir: 'fromR' }),
				},
			],
		};
		expect(tailedHierarchyDeclaresChAlign(node)).toBeFalsy();
	});

	it('is true when the top-level choose declares chAlign alongside linDir fromT ("Horizontal Organization Chart" own shape, both dir=norm/rtl branches)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: algBranch({ chAlign: 'l', linDir: 'fromT' }).rawXml,
						},
					],
					otherwise: algBranch({ chAlign: 'r', linDir: 'fromT' }),
				},
			],
		};
		expect(tailedHierarchyDeclaresChAlign(node)).toBeTruthy();
	});

	it('is true from a direct (non-choose-wrapped) algorithm.parameters chAlign, when already resolved', () => {
		const node: PptxSmartArtLayoutNode = {
			algorithm: {
				type: 'hierChild',
				parameters: [
					{ type: 'chAlign', value: 'l' },
					{ type: 'linDir', value: 'fromT' },
				],
			},
		};
		expect(tailedHierarchyDeclaresChAlign(node)).toBeTruthy();
	});

	it('is false when choose is present but empty, and algorithm carries no chAlign', () => {
		const node: PptxSmartArtLayoutNode = { choose: [], algorithm: { type: 'hierChild' } };
		expect(tailedHierarchyDeclaresChAlign(node)).toBeFalsy();
	});
});
