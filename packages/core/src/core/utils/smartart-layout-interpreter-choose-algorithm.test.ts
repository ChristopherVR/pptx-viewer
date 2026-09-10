import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import {
	chooseAlgorithm,
	chooseAlgorithmOfType,
	chooseAlgType,
} from './smartart-layout-interpreter-choose-algorithm';

/** The exact shape "Basic Block List"'s `diagram` root declares (layout1.xml). */
function basicBlockListDiagramNode(): PptxSmartArtLayoutNode {
	const paramList = (grDir: string) => [
		{ '@_type': 'grDir', '@_val': grDir },
		{ '@_type': 'flowDir', '@_val': 'row' },
		{ '@_type': 'contDir', '@_val': 'sameDir' },
		{ '@_type': 'off', '@_val': 'ctr' },
	];
	return {
		choose: [
			{
				when: [
					{
						function: 'var',
						operator: 'equ',
						value: 'norm',
						argument: 'dir',
						rawXml: { 'dgm:alg': { '@_type': 'snake', 'dgm:param': paramList('tL') } },
					},
				],
				otherwise: {
					rawXml: { 'dgm:alg': { '@_type': 'snake', 'dgm:param': paramList('tR') } },
				},
			},
		],
		rawXml: {},
	};
}

describe('chooseAlgorithm', () => {
	it('resolves the winning branch\'s FULL algorithm, not just its type (basic-block-list--flat3.pptx: off="ctr"/contDir="sameDir" must survive)', () => {
		const node = basicBlockListDiagramNode();
		const resolved = chooseAlgorithm(node, 3, { presLayoutVars: { direction: 'norm' } });
		expect(resolved?.type).toBe('snake');
		expect(resolved?.parameters).toStrictEqual([
			{ type: 'grDir', value: 'tL' },
			{ type: 'flowDir', value: 'row' },
			{ type: 'contDir', value: 'sameDir' },
			{ type: 'off', value: 'ctr' },
		]);
		// Agrees with the type-only resolution `chooseAlgType` already gave.
		expect(chooseAlgType(node, 3, { presLayoutVars: { direction: 'norm' } })).toBe('snake');
	});

	it('resolves the OTHER branch (mirrored grDir) when the decision flips', () => {
		const node = basicBlockListDiagramNode();
		const resolved = chooseAlgorithm(node, 3, { presLayoutVars: { direction: 'rev' } });
		expect(resolved?.parameters).toContainEqual({ type: 'grDir', value: 'tR' });
	});

	it('is undefined for a node with no choose at all', () => {
		expect(chooseAlgorithm({ rawXml: {} }, 3)).toBeUndefined();
	});

	it('is undefined when the choose is undecidable (no matching branch/context)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'var',
							operator: 'equ',
							value: 'rev',
							argument: 'dir',
							rawXml: { 'dgm:alg': { '@_type': 'cycle' } },
						},
					],
					otherwise: null,
				},
			],
			rawXml: {},
		};
		expect(chooseAlgorithm(node, 3)).toBeUndefined();
	});

	it('omits `parameters` entirely when the winning branch declares no `dgm:param`', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'cnt',
							operator: 'equ',
							value: '3',
							rawXml: { 'dgm:alg': { '@_type': 'lin' } },
						},
					],
					otherwise: null,
				},
			],
			rawXml: {},
		};
		const resolved = chooseAlgorithm(node, 3);
		expect(resolved).toStrictEqual({ type: 'lin' });
	});

	// hexagon-radial--hier5.pptx's `Name0`: an outer `dir`-choose wraps an
	// INNER `dgm:choose` with per-child-count `dgm:if`s, each selecting a
	// DIFFERENT `dgm:alg type="composite"` - two choose levels deep, no
	// intervening layoutNode. `composite` is excluded from the primary
	// structural search (`CHOOSE_ALG_TYPES`), so this only resolves via the
	// bounded fallback (`boundedCompositeAlg`), tried after the primary
	// search finds nothing.
	it('resolves a composite alg nested TWO choose levels deep via the bounded fallback (hexagon-radial pattern)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: {
								'dgm:choose': {
									'dgm:if': [
										{
											'@_func': 'cnt',
											'@_axis': 'ch ch',
											'@_op': 'equ',
											'@_val': '0',
											'dgm:alg': { '@_type': 'composite', '@_param': 'zero' },
										},
										{
											'@_func': 'cnt',
											'@_axis': 'ch ch',
											'@_op': 'lte',
											'@_val': '1',
											'dgm:alg': {
												'@_type': 'composite',
												'dgm:param': { '@_type': 'ar', '@_val': '0.8305' },
											},
										},
									],
								},
							},
						},
					],
					otherwise: null,
				},
			],
			rawXml: {},
		};
		const resolved = chooseAlgorithm(node, 2, {
			presLayoutVars: { direction: 'norm' },
			nodes: [
				{ id: 'a', text: 'A' },
				{ id: 'b', text: 'B', parentId: 'a' },
			],
		});
		expect(resolved?.type).toBe('composite');
		expect(resolved?.parameters).toStrictEqual([{ type: 'ar', value: '0.8305' }]);
	});

	it('never lets the bounded composite fallback steal a decision from an already-reachable structural alg (CHOOSE_ALG_TYPES priority preserved)', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: {
								'dgm:alg': { '@_type': 'cycle' },
								'dgm:layoutNode': {
									'@_name': 'item',
									'dgm:alg': { '@_type': 'composite' },
								},
							},
						},
					],
					otherwise: null,
				},
			],
			rawXml: {},
		};
		const resolved = chooseAlgorithm(node, 3, { presLayoutVars: { direction: 'norm' } });
		expect(resolved?.type).toBe('cycle');
	});

	it('does not cross into a nested dgm:layoutNode when resolving the bounded composite fallback', () => {
		const node: PptxSmartArtLayoutNode = {
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: {
								'dgm:layoutNode': {
									'@_name': 'item',
									'dgm:alg': { '@_type': 'composite' },
								},
							},
						},
					],
					otherwise: null,
				},
			],
			rawXml: {},
		};
		const resolved = chooseAlgorithm(node, 3, { presLayoutVars: { direction: 'norm' } });
		expect(resolved).toBeUndefined();
	});
});

describe('chooseAlgorithmOfType', () => {
	/** `square-accent-list--hier5.pptx`'s own `Parent`/`Child` shape: a `tx` alg declared entirely inside a `dir="norm"/"rev"` choose. */
	function chooseWrappedTxNode(): PptxSmartArtLayoutNode {
		return {
			choose: [
				{
					when: [
						{
							function: 'var',
							operator: 'equ',
							value: 'norm',
							argument: 'dir',
							rawXml: {
								'dgm:alg': {
									'@_type': 'tx',
									'dgm:param': [{ '@_type': 'parTxLTRAlign', '@_val': 'l' }],
								},
							},
						},
					],
					otherwise: {
						rawXml: {
							'dgm:alg': {
								'@_type': 'tx',
								'dgm:param': [{ '@_type': 'parTxLTRAlign', '@_val': 'r' }],
							},
						},
					},
				},
			],
			rawXml: {},
		};
	}

	it('resolves a choose-wrapped `tx` algorithm when `tx` is in the caller-supplied allowed set', () => {
		const node = chooseWrappedTxNode();
		const resolved = chooseAlgorithmOfType(node, 5, new Set(['tx']), {
			presLayoutVars: { direction: 'norm' },
		});
		expect(resolved?.type).toBe('tx');
		expect(resolved?.parameters).toStrictEqual([{ type: 'parTxLTRAlign', value: 'l' }]);
	});

	it('resolves the OTHER branch when the decision flips', () => {
		const node = chooseWrappedTxNode();
		const resolved = chooseAlgorithmOfType(node, 5, new Set(['tx']), {
			presLayoutVars: { direction: 'rev' },
		});
		expect(resolved?.parameters).toStrictEqual([{ type: 'parTxLTRAlign', value: 'r' }]);
	});

	it('is undefined when `tx` is not in the caller-supplied allowed set', () => {
		const node = chooseWrappedTxNode();
		const resolved = chooseAlgorithmOfType(node, 5, new Set(['lin']), {
			presLayoutVars: { direction: 'norm' },
		});
		expect(resolved).toBeUndefined();
	});

	it("does NOT widen `chooseAlgType`/`chooseAlgorithm`'s own default structural whitelist - `tx` stays invisible to them", () => {
		const node = chooseWrappedTxNode();
		expect(chooseAlgType(node, 5, { presLayoutVars: { direction: 'norm' } })).toBeUndefined();
		expect(chooseAlgorithm(node, 5, { presLayoutVars: { direction: 'norm' } })).toBeUndefined();
	});

	it('is undefined for a node with no choose at all', () => {
		expect(chooseAlgorithmOfType({ rawXml: {} }, 3, new Set(['tx']))).toBeUndefined();
	});
});
