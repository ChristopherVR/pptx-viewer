import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, PptxSmartArtNode } from '../types';
import { buildHubRenderedNode, detectHubExpansion } from './smartart-layout-interpreter-hub';

/** A raw `dgm:forEach` xml body, optionally nesting another `axis="ch"` forEach. */
function forEachRawXml(nestedAxis?: string): Record<string, unknown> {
	return nestedAxis === undefined
		? { '@_axis': 'ch', 'dgm:layoutNode': { '@_name': 'centerShape' } }
		: {
				'@_axis': 'ch',
				'dgm:layoutNode': { '@_name': 'centerShape' },
				'dgm:forEach': { '@_axis': nestedAxis, '@_ptType': 'node' },
			};
}

function arranger(nestedAxis?: string): PptxSmartArtLayoutNode {
	return {
		name: 'Name0',
		children: [
			{ name: 'centerShape', algorithm: { type: 'tx' }, shape: { presetGeometry: 'ellipse' } },
		],
		forEach: [{ axis: ['ch'], pointTypes: ['node'], rawXml: forEachRawXml(nestedAxis) }],
	};
}

const hub: PptxSmartArtNode = { id: 'hub', text: 'Center' };
const childrenOf = new Map<string, PptxSmartArtNode[]>([
	[
		'hub',
		[
			{ id: 's1', text: 'Sat 1' },
			{ id: 's2', text: 'Sat 2' },
		],
	],
]);

describe('detectHubExpansion', () => {
	it('detects the hub pattern: one selected point, its forEach nests a child-axis forEach', () => {
		const expansion = detectHubExpansion(arranger('ch'), [hub], childrenOf);
		expect(expansion?.hubNode.id).toBe('hub');
		expect(expansion?.satellites.map((n) => n.id)).toStrictEqual(['s1', 's2']);
	});

	it('declines when more than one point was already selected (ordinary diagram)', () => {
		expect(
			detectHubExpansion(arranger('ch'), [hub, { id: 'x', text: 'X' }], childrenOf),
		).toBeUndefined();
	});

	it('declines when the nested forEach targets sibTrans, not node points', () => {
		const notAHub: PptxSmartArtLayoutNode = {
			name: 'Name0',
			children: [{ name: 'item', algorithm: { type: 'tx' } }],
			forEach: [
				{
					axis: ['ch'],
					pointTypes: ['node'],
					rawXml: {
						'@_axis': 'ch',
						'dgm:layoutNode': { '@_name': 'item' },
						'dgm:forEach': { '@_axis': 'followSib', '@_ptType': 'sibTrans' },
					},
				},
			],
		};
		expect(detectHubExpansion(notAHub, [hub], childrenOf)).toBeUndefined();
	});

	it('declines when the selected point genuinely has no children', () => {
		expect(detectHubExpansion(arranger('ch'), [hub], new Map())).toBeUndefined();
	});

	it('declines a CONTINUATION nested forEach (st > 1): a list header is not a hub (Table List)', () => {
		// `table-list--hier5.pptx`'s `composite` -> `roof`(self text) +
		// `pillars` -> `pillar1`(compound presOf, child #1 inline) + a nested
		// `dgm:forEach axis="ch" st="2"` for the REST of the children. This
		// "repeats a child template" in the raw sense the search checks for,
		// but is a LIST CONTINUATION (a header + its own children shown as a
		// repeated sub-list), not a genuine hub whose children ALL become
		// satellites uniformly - before this fix, `detectHubExpansion` wrongly
		// substituted `roof`'s own point for a hub with `pillars`' children as
		// satellites (measured: table-list--hier5.pptx interpreted 2 shapes,
		// both wrong, where the cached drawing has 4 - the header
		// unexpectedly missing its own separate row).
		const continuationForEach: Record<string, unknown> = {
			'@_axis': 'ch',
			'dgm:layoutNode': { '@_name': 'roof' },
			'dgm:forEach': { '@_axis': 'ch', '@_ptType': 'node', '@_st': '2' },
		};
		const notAHub: PptxSmartArtLayoutNode = {
			name: 'composite',
			children: [{ name: 'roof', algorithm: { type: 'tx' } }],
			forEach: [{ axis: ['ch'], pointTypes: ['node'], rawXml: continuationForEach }],
		};
		expect(detectHubExpansion(notAHub, [hub], childrenOf)).toBeUndefined();
	});

	it('still detects a hub whose satellite forEach starts at "1" alongside OTHER st="2".."N" branches (Converging Text)', () => {
		// `converging-text--fallback-n4.pptx`'s per-satellite-count branches
		// each declare their own `st="1"`/`"2"`/.../`"5"` single-point
		// forEach - the FIRST (`st="1"`, absent `@_st` defaults to 1 too) is
		// still found and must NOT be excluded just because sibling branches
		// also declare `st > 1` (those are a DIFFERENT, mutually exclusive
		// branch, not a continuation of THIS one).
		const mixedForEach: Record<string, unknown> = {
			'@_axis': 'ch',
			'dgm:layoutNode': { '@_name': 'Parent' },
			'dgm:forEach': [
				{ '@_axis': 'ch', '@_ptType': 'node', '@_st': '1' },
				{ '@_axis': 'ch', '@_ptType': 'node', '@_st': '2' },
			],
		};
		const genuineHub: PptxSmartArtLayoutNode = {
			name: 'Name0',
			children: [{ name: 'composite', algorithm: { type: 'composite' } }],
			forEach: [{ axis: ['ch'], pointTypes: ['node'], rawXml: mixedForEach }],
		};
		const expansion = detectHubExpansion(genuineHub, [hub], childrenOf);
		expect(expansion?.hubNode.id).toBe('hub');
	});

	it('detects a hub whose OWN driving forEach directly repeats via a nested axis="self" ptType="node" forEach (Radial Cluster)', () => {
		// `radial-cluster--hier5.pptx`'s `singleCycle`: its ONE direct forEach
		// child (`Name54 axis="ch" cnt="21"`) IS the satellite iterator itself
		// - there is no SEPARATE outer `cnt="1"` selector forEach for the
		// original `hasNestedChildForEach` search to find (that selection
		// lives one level up, in `forEachOrigin`, never captured in
		// `arranger.forEach`). Its own raw body nests `axis="self"
		// ptType="node"` (bind the current iteration as the point, then
		// render its template) directly - the real DiagramML idiom this
		// shape uses instead of a second `axis="ch"` nesting.
		const ownChildForEach: Record<string, unknown> = {
			'@_axis': 'ch',
			'@_cnt': '21',
			'dgm:forEach': [
				{ '@_axis': 'self', '@_ptType': 'parTrans', 'dgm:layoutNode': { '@_name': 'conn' } },
				{ '@_axis': 'self', '@_ptType': 'node', 'dgm:layoutNode': { '@_name': 'text0' } },
			],
		};
		const radialClusterArranger: PptxSmartArtLayoutNode = {
			name: 'singleCycle',
			algorithm: { type: 'cycle', parameters: [{ type: 'ctrShpMap', value: 'fNode' }] },
			children: [{ name: 'singleCenter', algorithm: { type: 'tx' } }],
			forEach: [{ axis: ['ch'], pointTypes: ['node'], rawXml: ownChildForEach }],
		};
		const expansion = detectHubExpansion(radialClusterArranger, [hub], childrenOf);
		expect(expansion?.hubNode.id).toBe('hub');
		expect(expansion?.satellites.map((n) => n.id)).toStrictEqual(['s1', 's2']);
	});
});

describe('buildHubRenderedNode', () => {
	it('builds a centred box using the item template shape and the hub node id', () => {
		const box = { width: 800, height: 400 };
		const rendered = buildHubRenderedNode(arranger('ch'), hub, box, ['#fff'], 'flat', 'e');
		expect(rendered.nodeId).toBe('hub');
		expect(rendered.kind).toBe('circle');
	});
});
