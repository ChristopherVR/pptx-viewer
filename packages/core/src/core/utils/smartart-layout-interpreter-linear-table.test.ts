import { describe, expect, it } from 'vitest';

import type {
	PptxSmartArtIteratorAttributes,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
} from '../types';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import {
	arrangeRecursiveTable,
	isRecursiveTableItemTemplate,
} from './smartart-layout-interpreter-linear-table';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';

const CH_NODE_FOREACH: PptxSmartArtIteratorAttributes = { axis: ['ch'], pointTypes: ['node'] };
const SELF_NODE_FOREACH: PptxSmartArtIteratorAttributes = { axis: ['self'], pointTypes: ['node'] };

/**
 * A `table-hierarchy--hier5.pptx`-shaped item template, trimmed to the
 * structural essentials: `label` (a self-presenting `tx` leaf) plus `row` (a
 * `lin` sibling whose own child, `nested`, is reached through a genuine
 * `axis="ch" ptType="node"` forEach - i.e. `nested` is the SAME shape one
 * generation deeper). `forEachOrigin` on the template itself matches how
 * `vertOne` is reached through `Name0`'s own `axis="ch" ptType="node"`
 * `dgm:forEach`.
 */
function tableTemplate(): PptxSmartArtLayoutNode {
	const label = { name: 'label', algorithm: { type: 'tx' }, presentationOf: { axis: ['self'] } };
	const nested: PptxSmartArtLayoutNode = {
		name: 'nested',
		algorithm: { type: 'lin' },
		forEachOrigin: CH_NODE_FOREACH,
	};
	const row: PptxSmartArtLayoutNode = {
		name: 'row',
		algorithm: { type: 'lin' },
		children: [nested],
	};
	return {
		name: 'template',
		algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromT' }] },
		children: [label, row],
		forEachOrigin: CH_NODE_FOREACH,
	};
}

describe('isRecursiveTableItemTemplate', () => {
	it('matches the label + nested-lin-reached-via-ch/node shape (Table Hierarchy)', () => {
		expect(isRecursiveTableItemTemplate(tableTemplate(), undefined)).toBeTruthy();
	});

	it('declines when the nested lin child is reached via axis=self, not ch (sub-step-process)', () => {
		// `sub-step-process--hier5.pptx`'s own `txAndLines1`: a `lin` sibling
		// nested inside the item template, but reached through a `self`-axis
		// forEach (a once-per-point decoration), never a recursion boundary.
		const label = { name: 'label', algorithm: { type: 'tx' }, presentationOf: { axis: ['self'] } };
		const nested: PptxSmartArtLayoutNode = {
			name: 'nested',
			algorithm: { type: 'lin' },
			forEachOrigin: SELF_NODE_FOREACH,
		};
		const row: PptxSmartArtLayoutNode = {
			name: 'row',
			algorithm: { type: 'lin' },
			children: [nested],
		};
		const template: PptxSmartArtLayoutNode = {
			name: 'template',
			algorithm: { type: 'lin' },
			children: [label, row],
			forEachOrigin: CH_NODE_FOREACH,
		};
		expect(isRecursiveTableItemTemplate(template, undefined)).toBeFalsy();
	});

	it('declines a template with no self-presenting text label', () => {
		const nested: PptxSmartArtLayoutNode = {
			name: 'nested',
			algorithm: { type: 'lin' },
			forEachOrigin: CH_NODE_FOREACH,
		};
		const row: PptxSmartArtLayoutNode = {
			name: 'row',
			algorithm: { type: 'lin' },
			children: [nested],
		};
		const template: PptxSmartArtLayoutNode = {
			name: 'template',
			algorithm: { type: 'lin' },
			children: [row],
			forEachOrigin: CH_NODE_FOREACH,
		};
		expect(isRecursiveTableItemTemplate(template, undefined)).toBeFalsy();
	});

	it('declines when the template itself was not reached through an axis=ch/node forEach', () => {
		const template = tableTemplate();
		expect(
			isRecursiveTableItemTemplate({ ...template, forEachOrigin: undefined }, undefined),
		).toBeFalsy();
	});
});

describe('arrangeRecursiveTable', () => {
	it('gives every generation the SAME row height, and only splits a column when a node has more than one child', () => {
		// root -> [a, b] (2 generations: root's own row, then a/b's shared row).
		const root: PptxSmartArtNode = { id: 'root', text: 'Root' };
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const b: PptxSmartArtNode = { id: 'b', text: 'B' };
		const nodes = [root, a, b];
		const childrenOf = new Map<string, PptxSmartArtNode[]>([['root', [a, b]]]);
		const plan: ArrangementPlan = { kind: 'linear', node: tableTemplate() };
		const result = arrangeRecursiveTable(
			plan,
			nodes,
			{ width: 400, height: 300 },
			['#fff'],
			'flat',
			'e',
			EMPTY_CONSTRAINT_INDEX,
			childrenOf,
			undefined,
			undefined,
		);
		const byId = new Map(
			result.nodes.map((rendered) => {
				if (rendered.kind !== 'rect') {
					throw new Error('expected rect nodes');
				}
				return [rendered.nodeId, rendered] as const;
			}),
		);
		const rootRect = byId.get('root');
		const aRect = byId.get('a');
		const bRect = byId.get('b');
		if (!rootRect || !aRect || !bRect) {
			throw new Error('missing rendered node');
		}
		// Row height is shared across BOTH generations (root's own row and
		// a/b's shared row) - not derived independently per row.
		expect(aRect.height).toBeCloseTo(rootRect.height, 5);
		expect(bRect.height).toBeCloseTo(rootRect.height, 5);
		// Root has no split (a single top-level point): full box width.
		expect(rootRect.width).toBeCloseTo(400, 5);
		// a/b split root's own column width in half (a small shared gap
		// between them), never the full diagram width each.
		expect(aRect.width).toBeLessThan(400);
		expect(aRect.width).toBeCloseTo(bRect.width, 5);
		expect(aRect.x).toBeLessThan(bRect.x);
		// a/b sit strictly below root (the next generation's row).
		expect(aRect.y).toBeGreaterThan(rootRect.y);
		expect(bRect.y).toBeCloseTo(aRect.y, 5);
	});

	it('reverses the row order (deepest-first) for a fromB direction (Architecture Layout)', () => {
		const root: PptxSmartArtNode = { id: 'root', text: 'Root' };
		const child: PptxSmartArtNode = { id: 'child', text: 'Child' };
		const nodes = [root, child];
		const childrenOf = new Map<string, PptxSmartArtNode[]>([['root', [child]]]);
		const template = tableTemplate();
		template.algorithm = { type: 'lin', parameters: [{ type: 'linDir', value: 'fromB' }] };
		const plan: ArrangementPlan = { kind: 'linear', node: template };
		const result = arrangeRecursiveTable(
			plan,
			nodes,
			{ width: 400, height: 300 },
			['#fff'],
			'flat',
			'e',
			EMPTY_CONSTRAINT_INDEX,
			childrenOf,
			undefined,
			undefined,
		);
		const byId = new Map(
			result.nodes.map((rendered) => {
				if (rendered.kind !== 'rect') {
					throw new Error('expected rect nodes');
				}
				return [rendered.nodeId, rendered] as const;
			}),
		);
		const rootRect = byId.get('root');
		const childRect = byId.get('child');
		if (!rootRect || !childRect) {
			throw new Error('missing rendered node');
		}
		// `fromB`: the root sits in the BOTTOM row, its child ABOVE it.
		expect(rootRect.y).toBeGreaterThan(childRect.y);
	});
});
