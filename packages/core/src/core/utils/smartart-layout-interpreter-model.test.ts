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

/**
 * `gear`'s composite positions its named slots (`gear1`, `gear2`, ...) via
 * its OWN `for="ch" forName="<slot>"` constraint, not a self-declared one on
 * the slot's own `constrLst` - `mapsSlots` must recognise this shape too, or
 * a genuine top-level composite arranger is never found at all.
 */
describe('discoverArrangement composite mapsSlots', () => {
	it('finds a composite whose slots are positioned by the ARRANGER, not self-declared', () => {
		const composite: PptxSmartArtLayoutNode = {
			name: 'composite',
			algorithm: { type: 'composite' },
			constraints: [{ type: 'w', for: 'ch', forName: 'slot1' }],
			children: [{ name: 'slot1', algorithm: { type: 'tx' } }],
		};
		const plan = discoverArrangement(definitionWith(composite));
		expect(plan?.kind).toBe('composite');
	});

	it('does NOT let a per-item composite template hijack a correctly-found structural arranger', () => {
		// The Meet the Team shape: an outer `lin`-driven forEach whose item
		// template (`compNode`) is itself a composite with arranger-declared
		// slot positioning - that composite must stay a per-item detail, not
		// win over the outer `lin` as the diagram's own top-level arranger.
		const compNode: PptxSmartArtLayoutNode = {
			name: 'compNode',
			algorithm: { type: 'composite' },
			constraints: [{ type: 'w', for: 'ch', forName: 'nameText' }],
			children: [{ name: 'nameText', algorithm: { type: 'tx' } }],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			algorithm: { type: 'lin' },
			forEach: [{ axis: ['ch'], pointTypes: ['node'] }],
			children: [compNode],
		};
		const plan = discoverArrangement(definitionWith(root));
		expect(plan?.kind).toBe('linear');
	});

	it('reaches composite constraints declared inside a dgm:choose wrapping the SAME node', () => {
		// `gear`'s composite has no DIRECT constrLst at all: its slot
		// positioning is entirely inside a count-decidable `dgm:choose`.
		const composite: PptxSmartArtLayoutNode = {
			name: 'composite',
			algorithm: { type: 'composite' },
			allConstraints: [{ type: 'w', for: 'ch', forName: 'slot1' }],
			children: [{ name: 'slot1', algorithm: { type: 'tx' } }],
		};
		const plan = discoverArrangement(definitionWith(composite));
		expect(plan?.kind).toBe('composite');
	});
});

describe('discoverArrangement skips a decorative transition-only child matching the chosen alg type', () => {
	it("picks the declaring node itself over a sibling reached through a followSib/sibTrans forEach ('hProcess7' Detailed Process's vProcSp)", () => {
		// `hProcess7`'s `Name0` choose decides `type="lin"` for itself, but its
		// OWN `.children` (flattened across every `dgm:forEach` it declares)
		// also include `vProcSp`: a decorative connector-simulation spacer
		// reached via `forEach axis="followSib" ptType="sibTrans"`, which reuses
		// the SAME `dgm:alg type="lin"` purely to line up its own three tiny
		// sub-shapes. A plain "first child whose algorithm type matches" search
		// picked `vProcSp` BEFORE ever falling back to `Name0` itself, hijacking
		// the diagram into arranging three decorative slivers instead of its
		// real per-item content (measured: 3 interpreted shapes where 5 were
		// expected, `detailed-process--hier5.pptx`).
		const vProcSp: PptxSmartArtLayoutNode = {
			name: 'vProcSp',
			algorithm: { type: 'lin' },
			forEachOrigin: { axis: ['followSib'], pointTypes: ['sibTrans'] },
		};
		const compositeNode: PptxSmartArtLayoutNode = {
			name: 'compositeNode',
			algorithm: { type: 'composite' },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'] },
		};
		const name0: PptxSmartArtLayoutNode = {
			name: 'Name0',
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: { 'dgm:alg': { '@_type': 'lin' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
			children: [compositeNode, vProcSp],
		};
		const plan = discoverArrangement(definitionWith(name0), 3, { direction: 'norm' });
		expect(plan?.kind).toBe('linear');
		expect(plan?.node.name).toBe('Name0');
	});

	it('still picks a genuinely matching child when it is NOT transition-only', () => {
		const realArranger: PptxSmartArtLayoutNode = { name: 'itemsFlow', algorithm: { type: 'lin' } };
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: { 'dgm:alg': { '@_type': 'lin' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
			children: [realArranger],
		};
		const plan = discoverArrangement(definitionWith(root), 3, { direction: 'norm' });
		expect(plan?.node.name).toBe('itemsFlow');
	});
});

/**
 * `stacked-list--hier5.pptx` (gallery corpus): the top-level `list` node's own
 * `dgm:choose` is undecidable directly (no branch declares a bare `dgm:alg`),
 * but its descendant `vertFlow` DOES carry a DIRECT `dgm:alg type="lin"` -
 * reached ONLY through a `dgm:forEach axis="ch" ptType="node" st="2"`, a
 * CONTINUATION iterator picking up from the SECOND point (the layout's
 * `firstComp` slot separately consumes point 1). Before this fix,
 * `discoverArrangement` picked `vertFlow` as the driving arranger, so
 * `selectArrangedNodes` only ever saw 2 of the diagram's 3 real top-level
 * points (measured: interpreted 3 shapes where the cached drawing has 5).
 * `table-list--hier5.pptx`'s `pillars` (`st="2"` too, skipping the
 * composite's own `roof` slot) is the same shape one level deeper (reached
 * through a genuine top-level `composite`, not a choose).
 */
describe('discoverArrangement excludes a continuation forEach (st > 1) from arranger candidacy', () => {
	it('prefers the outer node over a descendant reached only via `dgm:forEach st="2"`', () => {
		const continuationChild: PptxSmartArtLayoutNode = {
			name: 'vertFlow',
			algorithm: { type: 'lin' },
			forEach: [{ axis: ['ch'], pointTypes: ['node'], start: [2] }],
		};
		const list: PptxSmartArtLayoutNode = {
			name: 'list',
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: { 'dgm:alg': { '@_type': 'lin' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
			children: [continuationChild],
		};
		const plan = discoverArrangement(definitionWith(list), 3, { direction: 'norm' });
		expect(plan?.kind).toBe('linear');
		// The continuation child is excluded, so the choose-declaring node
		// itself (with the resolved `lin` algorithm attached) wins instead.
		expect(plan?.node.name).toBe('list');
	});

	it('still picks a genuinely matching child with no `st` restriction (st absent, or st=1)', () => {
		const realArranger: PptxSmartArtLayoutNode = {
			name: 'itemsFlow',
			algorithm: { type: 'lin' },
			forEach: [{ axis: ['ch'], pointTypes: ['node'] }],
		};
		const root: PptxSmartArtLayoutNode = {
			name: 'root',
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: { 'dgm:alg': { '@_type': 'lin' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
			children: [realArranger],
		};
		const plan = discoverArrangement(definitionWith(root), 3, { direction: 'norm' });
		expect(plan?.node.name).toBe('itemsFlow');
	});

	it('excludes a top-level `dgm:choose` on the continuation node itself', () => {
		// The continuation node can ALSO carry its own decidable choose (e.g.
		// picking `lin` direction) - `pillars` in `table-list--hier5.pptx`.
		// Its OWN choose must not win either, since it covers only PART of
		// the diagram's points.
		const pillars: PptxSmartArtLayoutNode = {
			name: 'pillars',
			forEach: [{ axis: ['ch'], pointTypes: ['node'], start: [2] }],
			choose: [
				{
					when: [
						{
							function: 'var',
							argument: 'dir',
							operator: 'equ',
							value: 'norm',
							rawXml: { 'dgm:alg': { '@_type': 'lin' } },
						},
					],
					otherwise: { rawXml: { 'dgm:alg': { '@_type': 'lin' } } },
				},
			],
		};
		const composite: PptxSmartArtLayoutNode = {
			name: 'composite',
			algorithm: { type: 'composite' },
			constraints: [{ type: 'l', for: 'ch', forName: 'pillars' }],
			children: [pillars],
		};
		const plan = discoverArrangement(definitionWith(composite), 3, { direction: 'norm' });
		expect(plan?.kind).toBe('composite');
		expect(plan?.node.name).toBe('composite');
	});
});
