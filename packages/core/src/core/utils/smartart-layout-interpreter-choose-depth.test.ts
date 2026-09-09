import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtWhen } from '../types';
import {
	structuralChooseAlgDepth,
	tunnelsPastOwnCompositeSlot,
} from './smartart-layout-interpreter-choose-depth';

/** A `dgm:if` condition that is ALWAYS decidable true, regardless of `nodeCount`/`context` - keeps every fixture below focused on the raw-XML shape being measured, not on guard evaluation itself. */
function alwaysTrue(rawXml: object): PptxSmartArtWhen {
	return { function: 'cnt', operator: 'gte', value: '0', rawXml };
}

describe('structuralChooseAlgDepth', () => {
	it('returns undefined for a node with no choose', () => {
		expect(structuralChooseAlgDepth({ name: 'leaf' }, 1, {})).toBeUndefined();
	});

	it("depth 0: a structural dgm:alg found at the winning branch's own top level", () => {
		const rawXml = { 'dgm:alg': { '@_type': 'lin' } };
		const node: PptxSmartArtLayoutNode = {
			name: 'root',
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(structuralChooseAlgDepth(node, 1, {})).toStrictEqual({ depth: 0, crossedNames: [] });
	});

	it("depth 1: a structural dgm:alg found ONE dgm:layoutNode level down (horizontal-picture-list's own shape)", () => {
		const rawXml = {
			'dgm:layoutNode': { '@_name': 'child', 'dgm:alg': { '@_type': 'lin' } },
		};
		const node: PptxSmartArtLayoutNode = {
			name: 'root',
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(structuralChooseAlgDepth(node, 1, {})).toStrictEqual({
			depth: 1,
			crossedNames: ['child'],
		});
	});

	/**
	 * `nested-target--hier5.pptx`'s exact shape: `Name0`'s winning choose
	 * branch is the ENTIRE `outerBox` layoutNode, which itself nests
	 * `outerBoxChildren`, whose OWN (here: direct, for test simplicity - the
	 * real fixture nests it one level deeper still, inside `outerBoxChildren`'s
	 * own `.choose`) `dgm:alg type="lin"` is TWO `dgm:layoutNode` boundaries
	 * from `Name0`'s own winning branch.
	 */
	it("depth 2: a structural dgm:alg found TWO dgm:layoutNode levels down (nested-target's own shape)", () => {
		const rawXml = {
			'dgm:layoutNode': {
				'@_name': 'outerBox',
				'dgm:layoutNode': {
					'@_name': 'outerBoxChildren',
					'dgm:alg': { '@_type': 'lin' },
				},
			},
		};
		const node: PptxSmartArtLayoutNode = {
			name: 'Name0',
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(structuralChooseAlgDepth(node, 1, {})).toStrictEqual({
			depth: 2,
			crossedNames: ['outerBox', 'outerBoxChildren'],
		});
	});

	it('returns undefined when no branch resolves a STRUCTURAL type (a plain composite alg does not count)', () => {
		const rawXml = { 'dgm:alg': { '@_type': 'composite' } };
		const node: PptxSmartArtLayoutNode = {
			name: 'root',
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(structuralChooseAlgDepth(node, 1, {})).toBeUndefined();
	});

	it('returns undefined when no branch is decidable', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'root',
			choose: [
				{ when: [{ function: 'var', argument: 'unsupported', operator: 'equ', value: 'x' }] },
			],
		};
		expect(structuralChooseAlgDepth(node, 1, {})).toBeUndefined();
	});
});

describe('tunnelsPastOwnCompositeSlot', () => {
	const mapsSlotsConstraint = [{ type: 'l', for: 'ch' as const, forName: 'child' }];

	it('true: node has its own direct composite alg, real mapped slots, and its choose tunnels 2 levels deep', () => {
		const rawXml = {
			'dgm:layoutNode': {
				'@_name': 'outerBox',
				'dgm:layoutNode': { '@_name': 'outerBoxChildren', 'dgm:alg': { '@_type': 'lin' } },
			},
		};
		const node: PptxSmartArtLayoutNode = {
			name: 'Name0',
			algorithm: { type: 'composite' },
			constraints: mapsSlotsConstraint,
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(tunnelsPastOwnCompositeSlot(node, 1, {}, new Set())).toBeTruthy();
	});

	it("false: same shape but only depth 1 (horizontal-picture-list's own shape - already correct, must stay untouched)", () => {
		const rawXml = { 'dgm:layoutNode': { '@_name': 'child', 'dgm:alg': { '@_type': 'lin' } } };
		const node: PptxSmartArtLayoutNode = {
			name: 'Name0',
			algorithm: { type: 'composite' },
			constraints: mapsSlotsConstraint,
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(tunnelsPastOwnCompositeSlot(node, 1, {}, new Set())).toBeFalsy();
	});

	it('false: depth 2 but the node has no direct composite alg of its own (a passive/choose-wrapped wrapper, e.g. outerBoxChildren itself)', () => {
		const rawXml = {
			'dgm:layoutNode': {
				'@_name': 'a',
				'dgm:layoutNode': { '@_name': 'b', 'dgm:alg': { '@_type': 'lin' } },
			},
		};
		const node: PptxSmartArtLayoutNode = {
			name: 'outerBoxChildren',
			constraints: mapsSlotsConstraint,
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(tunnelsPastOwnCompositeSlot(node, 1, {}, new Set())).toBeFalsy();
	});

	it('false: depth 2 with a direct composite alg but NO real mapped slots (mapsSlots false)', () => {
		const rawXml = {
			'dgm:layoutNode': {
				'@_name': 'a',
				'dgm:layoutNode': { '@_name': 'b', 'dgm:alg': { '@_type': 'lin' } },
			},
		};
		const node: PptxSmartArtLayoutNode = {
			name: 'Name0',
			algorithm: { type: 'composite' },
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(tunnelsPastOwnCompositeSlot(node, 1, {}, new Set())).toBeFalsy();
	});

	it('false: depth 2, own composite alg, mapped slots, but the node is itself a per-item template (itemTemplates has it)', () => {
		const rawXml = {
			'dgm:layoutNode': {
				'@_name': 'a',
				'dgm:layoutNode': { '@_name': 'b', 'dgm:alg': { '@_type': 'lin' } },
			},
		};
		const node: PptxSmartArtLayoutNode = {
			name: 'Name0',
			algorithm: { type: 'composite' },
			constraints: mapsSlotsConstraint,
			choose: [{ when: [alwaysTrue(rawXml)] }],
		};
		expect(tunnelsPastOwnCompositeSlot(node, 1, {}, new Set([node]))).toBeFalsy();
	});
});
