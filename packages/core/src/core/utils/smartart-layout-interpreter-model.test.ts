import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { discoverArrangement } from './smartart-layout-interpreter-model';

function definitionWith(rootNode: PptxSmartArtLayoutNode): PptxSmartArtLayoutDefinition {
	return { rootNode };
}

/**
 * A real `dgm:choose` structure whose branch depends on the DECLARING node's
 * own position among its siblings (`func="pos"`), modelled on PowerPoint's
 * "Basic Pyramid" (`ppt/diagrams/layout1.xml`), which uses this exact pattern
 * (`axis="self" ptType="node" func="pos" op="equ" val="1"`) to give the first
 * item a distinct constraint set from every other item. `discoverArrangement`
 * is the production call site `chooseAlgType` is invoked from; before this
 * change it only ever supplied `presLayoutVars`, so `func="pos"` was always
 * undecidable there even though `evaluateWhen` has implemented it since G8.
 */
describe('discoverArrangement dgm:choose func="pos"', () => {
	it("decides a choose branch from the declaring node's own sibling position", () => {
		const secondChild: PptxSmartArtLayoutNode = {
			name: 'second',
			choose: [
				{
					when: [
						{
							function: 'pos',
							operator: 'equ',
							value: '2',
							rawXml: { 'dgm:alg': { '@_type': 'cycle' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [{ name: 'first' }, secondChild],
		};
		const plan = discoverArrangement(definitionWith(root), 3);
		// `second` is position 2 of 2 siblings, so `func="pos" op="equ" val="2"`
		// is true and the `cycle` branch (not the `otherwise` `lin` branch) wins.
		expect(plan?.kind).toBe('cycle');
	});

	it('falls back to the otherwise branch when pos does not match', () => {
		const firstChild: PptxSmartArtLayoutNode = {
			name: 'first',
			choose: [
				{
					when: [
						{
							function: 'pos',
							operator: 'equ',
							value: '2',
							rawXml: { 'dgm:alg': { '@_type': 'cycle' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [firstChild, { name: 'second' }],
		};
		const plan = discoverArrangement(definitionWith(root), 3);
		// `first` is position 1 of 2, so `func="pos" op="equ" val="2"` is false
		// and the `otherwise` (`lin`) branch wins instead.
		expect(plan?.kind).toBe('linear');
	});

	it('decides func="revPos" from the sibling count and position', () => {
		const lastChild: PptxSmartArtLayoutNode = {
			name: 'last',
			choose: [
				{
					when: [
						{
							function: 'revPos',
							operator: 'equ',
							value: '1',
							rawXml: { 'dgm:alg': { '@_type': 'snake' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [{ name: 'a' }, { name: 'b' }, lastChild],
		};
		const plan = discoverArrangement(definitionWith(root), 3);
		// `last` is position 3 of 3, so revPos = 3 - 3 + 1 = 1, matching val="1".
		expect(plan?.kind).toBe('snake');
	});

	it('decides func="depth" from the declaring node\'s distance from the root', () => {
		const grandchild: PptxSmartArtLayoutNode = {
			name: 'grandchild',
			choose: [
				{
					when: [
						{
							function: 'depth',
							operator: 'equ',
							value: '2',
							rawXml: { 'dgm:alg': { '@_type': 'cycle' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [{ name: 'child', children: [grandchild] }],
		};
		const plan = discoverArrangement(definitionWith(root), 3);
		expect(plan?.kind).toBe('cycle');
	});

	it('decides func="maxDepth" from the whole tree\'s deepest node', () => {
		const deepNode: PptxSmartArtLayoutNode = {
			name: 'deep',
			choose: [
				{
					when: [
						{
							function: 'maxDepth',
							operator: 'gte',
							value: '2',
							rawXml: { 'dgm:alg': { '@_type': 'cycle' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			children: [{ name: 'child', children: [{ name: 'grandchild' }] }, deepNode],
		};
		const plan = discoverArrangement(definitionWith(root), 3);
		// Tree depth reaches 2 (root -> child -> grandchild), so maxDepth >= 2 is true.
		expect(plan?.kind).toBe('cycle');
	});
});
