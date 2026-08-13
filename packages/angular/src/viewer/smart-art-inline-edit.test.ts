/**
 * Tests for the pure on-canvas SmartArt inline-edit helpers.
 *
 * These back the renderer's double-click-to-edit flow. The renderer component
 * itself cannot be mounted under the package's vitest setup (no Angular
 * compiler), so the testable logic lives in
 * `smart-art-inline-edit.ts` and is exercised directly here: key -> node-id
 * parsing, per-kind editor geometry, the seed-state builder, the commit wrapper
 * (which must route through the same core op the inspector uses), and the
 * slide-index lookup used to commit through `EditorStateService`.
 */
import type { PptxElement, PptxSlide, PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeSmartArtLayout } from '../internal/shared';
import type { RenderedNode } from '../internal/shared';
import { DEFAULT_PALETTE } from './smart-art-drawing';
import {
	beginNodeEdit,
	commitNodeText,
	findOwningSlideIndex,
	findSlideIndexByElementId,
	nodeEditBox,
	nodeIdFromKey,
} from './smart-art-inline-edit';

const ELEMENT_ID = 'dgm-1';
const BOX = { width: 400, height: 300 };

function node(id: string, text: string, over: Partial<PptxSmartArtNode> = {}): PptxSmartArtNode {
	return { id, text, ...over };
}

function layoutNodes(
	nodes: PptxSmartArtNode[],
	resolvedLayoutType?: Parameters<typeof computeSmartArtLayout>[5],
): RenderedNode[] {
	return computeSmartArtLayout(nodes, BOX, DEFAULT_PALETTE, 'flat', ELEMENT_ID, resolvedLayoutType)
		.nodes;
}

function smartArtData(nodes: PptxSmartArtNode[]): PptxSmartArtData {
	return { nodes, resolvedLayoutType: 'list' };
}

describe('nodeIdFromKey', () => {
	it('extracts the node id from a list-family key', () => {
		expect(nodeIdFromKey(`${ELEMENT_ID}-list-7-0`, ELEMENT_ID)).toBe('7');
	});

	it('handles node ids that themselves contain hyphens', () => {
		expect(nodeIdFromKey(`${ELEMENT_ID}-hier-pt-12-3`, ELEMENT_ID)).toBe('pt-12');
	});

	it('returns null when the key does not start with the element id', () => {
		expect(nodeIdFromKey('other-list-7-0', ELEMENT_ID)).toBeNull();
	});

	it('returns null when there is no trailing index', () => {
		expect(nodeIdFromKey(`${ELEMENT_ID}-list-7`, ELEMENT_ID)).toBeNull();
	});

	it('round-trips a real node id for every node-keyed shared family', () => {
		// Every family keys nodes as `${elementId}-${family}-${nodeId}-${index}`,
		// so the data node id is always recoverable. The lone exception is the
		// radial "centre" node, which the shared engine keys with a `centre`
		// sentinel instead of the node id (covered separately below).
		const families: Array<Parameters<typeof computeSmartArtLayout>[5]> = [
			'list',
			'process',
			'cycle',
			'hierarchy',
			'matrix',
			'pyramid',
			'venn',
			'funnel',
			'target',
		];
		for (const fam of families) {
			const rendered = layoutNodes([node('1', 'Alpha'), node('2', 'Beta')], fam);
			for (const rn of rendered) {
				const id = nodeIdFromKey(rn.key, ELEMENT_ID);
				expect(id === '1' || id === '2').toBeTruthy();
			}
		}
	});

	it('recovers satellite ids in the radial family (centre uses a sentinel)', () => {
		const rendered = layoutNodes(
			[node('1', 'Core'), node('2', 'A'), node('3', 'B')],
			'relationship',
		);
		const ids = rendered.map((rn) => nodeIdFromKey(rn.key, ELEMENT_ID));
		// Satellites map to real data ids; the centre node maps to the `centre`
		// sentinel (not a data id) and is therefore not on-canvas editable.
		expect(ids).toContain('2');
		expect(ids).toContain('3');
		expect(ids).toContain('centre');
	});
});

describe('nodeEditBox', () => {
	it('returns the rect box directly', () => {
		const [rect] = layoutNodes([node('1', 'Alpha')], 'list');
		const box = nodeEditBox(rect);
		expect(rect.kind).toBe('rect');
		if (rect.kind === 'rect') {
			expect(box).toStrictEqual({
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
			});
		}
	});

	it('squares a circle to its diameter centred on cx/cy', () => {
		const circ = layoutNodes([node('1', 'A'), node('2', 'B'), node('3', 'C')], 'cycle').find(
			(n) => n.kind === 'circle',
		);
		expect(circ).toBeDefined();
		if (circ && circ.kind === 'circle') {
			const box = nodeEditBox(circ);
			expect(box.width).toBeCloseTo(circ.r * 2);
			expect(box.height).toBeCloseTo(circ.r * 2);
			expect(box.x).toBeCloseTo(circ.cx - circ.r);
			expect(box.y).toBeCloseTo(circ.cy - circ.r);
		}
	});

	it('derives a polygon box from its points string', () => {
		const poly = layoutNodes([node('1', 'Step 1'), node('2', 'Step 2')], 'process').find(
			(n) => n.kind === 'polygon',
		);
		expect(poly).toBeDefined();
		if (poly && poly.kind === 'polygon') {
			const box = nodeEditBox(poly);
			expect(box.width).toBeGreaterThan(0);
			expect(box.height).toBeGreaterThan(0);
			// The text centre must fall inside the derived box.
			expect(poly.textX).toBeGreaterThanOrEqual(box.x);
			expect(poly.textX).toBeLessThanOrEqual(box.x + box.width);
		}
	});
});

describe('beginNodeEdit', () => {
	it('seeds the editor with the resolved node id, geometry, and raw text', () => {
		const [rect] = layoutNodes([node('1', 'Alpha')], 'list');
		const state = beginNodeEdit(rect, ELEMENT_ID, 'Alpha (full untruncated)');
		expect(state).not.toBeNull();
		expect(state?.nodeId).toBe('1');
		expect(state?.text).toBe('Alpha (full untruncated)');
		expect(state?.box.width).toBeGreaterThan(0);
	});

	it('falls back to the rendered text when no raw text is given', () => {
		const [rect] = layoutNodes([node('1', 'Alpha')], 'list');
		const state = beginNodeEdit(rect, ELEMENT_ID);
		expect(state?.text).toBe(rect.text);
	});

	it('returns null for an unparseable key', () => {
		const fake: RenderedNode = {
			kind: 'rect',
			key: 'mismatch',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			rx: 0,
			fill: '#000',
			stroke: 'none',
			strokeWidth: 0,
			opacity: 1,
			text: 'x',
			fontSize: 10,
			textX: 5,
			textY: 5,
		};
		expect(beginNodeEdit(fake, ELEMENT_ID)).toBeNull();
	});
});

describe('commitNodeText', () => {
	it('updates a node and routes through the core op (new immutable data)', () => {
		const data = smartArtData([node('1', 'Old'), node('2', 'Keep')]);
		const next = commitNodeText(data, '1', 'New');
		expect(next).not.toBe(data);
		expect(next.nodes.find((n) => n.id === '1')?.text).toBe('New');
		expect(next.nodes.find((n) => n.id === '2')?.text).toBe('Keep');
	});

	it('returns the same reference when the text is unchanged (no-op)', () => {
		const data = smartArtData([node('1', 'Same')]);
		expect(commitNodeText(data, '1', 'Same')).toBe(data);
	});

	it('updates a child node tracked in the flat parentId-linked model', () => {
		const data = smartArtData([node('1', 'Root'), node('2', 'Child', { parentId: '1' })]);
		const next = commitNodeText(data, '2', 'Renamed');
		expect(next.nodes.find((n) => n.id === '2')?.text).toBe('Renamed');
	});
});

describe('findSlideIndexByElementId', () => {
	function smartArtElement(id: string): PptxElement {
		return {
			id,
			type: 'smartArt',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			smartArtData: smartArtData([node('1', 'A')]),
		} as PptxElement;
	}

	function slide(id: string, elements: PptxElement[]): PptxSlide {
		return { id, rId: id, slideNumber: 0, elements } as PptxSlide;
	}

	it('finds the slide that directly owns the element', () => {
		const slides = [slide('s0', [smartArtElement('a')]), slide('s1', [smartArtElement('target')])];
		expect(findSlideIndexByElementId(slides, 'target')).toBe(1);
	});

	it('finds an element nested inside a group', () => {
		const group = {
			id: 'g',
			type: 'group',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			children: [smartArtElement('deep')],
		} as PptxElement;
		const slides = [slide('s0', [group])];
		expect(findSlideIndexByElementId(slides, 'deep')).toBe(0);
	});

	it('returns -1 when the element is absent', () => {
		const slides = [slide('s0', [smartArtElement('a')])];
		expect(findSlideIndexByElementId(slides, 'missing')).toBe(-1);
	});
});

describe('findOwningSlideIndex', () => {
	function slide(id: string, elements: PptxElement[]): PptxSlide {
		return { id, rId: id, slideNumber: 0, elements } as PptxSlide;
	}
	const el = (id: string): PptxElement =>
		({ id, type: 'shape', x: 0, y: 0, width: 10, height: 10 }) as PptxElement;

	it('resolves normal element ids via the deck search', () => {
		const slides = [slide('s0', [el('a')]), slide('s1', [el('b')])];
		expect(findOwningSlideIndex(slides, 'b', 's0')).toBe(1);
	});

	it('resolves template element ids to the hosting canvas slide', () => {
		// Template elements are partitioned OUT of slides[].elements, so the
		// deck search cannot see them; the canvas slide id decides ownership.
		const slides = [slide('s0', [el('a')]), slide('s1', [el('b')])];
		expect(findOwningSlideIndex(slides, 'layout-shape-1', 's1')).toBe(1);
		expect(findOwningSlideIndex(slides, 'master-shape-2', 's0')).toBe(0);
	});

	it('returns -1 for a template id without a hosting slide or with an unknown one', () => {
		const slides = [slide('s0', [el('a')])];
		expect(findOwningSlideIndex(slides, 'layout-shape-1', null)).toBe(-1);
		expect(findOwningSlideIndex(slides, 'layout-shape-1', undefined)).toBe(-1);
		expect(findOwningSlideIndex(slides, 'layout-shape-1', 'nope')).toBe(-1);
	});
});

/**
 * The gear family keys its legend rows `<elementId>-gear-extra-<nodeId>-<i>`,
 * one segment longer than every other family. Parsing the id back out of the
 * key therefore yielded `extra-<nodeId>`, which matches no model node: the
 * `data-smartart-node-id` differed from every other binding's and an inline
 * edit on a legend row committed nowhere. Callers now pass the index-aligned
 * id, the mapping the other four bindings use.
 */
describe('beginNodeEdit with a caller-resolved node id', () => {
	it('prefers the resolved id over the key parse', () => {
		const gearLegend = {
			kind: 'circle' as const,
			key: `${ELEMENT_ID}-gear-extra-{GUID-9}-4`,
			cx: 10,
			cy: 20,
			r: 3,
			fill: '#000',
			stroke: 'none',
			strokeWidth: 0,
			opacity: 1,
			text: 'Legend',
			fontSize: 10,
		};
		// The key parse alone produces the unusable `extra-` prefixed id.
		expect(nodeIdFromKey(gearLegend.key, ELEMENT_ID)).toBe('extra-{GUID-9}');
		expect(beginNodeEdit(gearLegend, ELEMENT_ID, undefined, '{GUID-9}')?.nodeId).toBe('{GUID-9}');
	});

	it('still falls back to the key parse when no id is supplied', () => {
		const [rect] = layoutNodes([node('1', 'Alpha')], 'list');
		expect(beginNodeEdit(rect, ELEMENT_ID, undefined, null)?.nodeId).toBe('1');
	});
});
