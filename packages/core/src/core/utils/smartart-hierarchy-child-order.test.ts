import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { applyChildOrder } from './smartart-hierarchy-child-order';

function node(id: string, parentId?: string): PptxSmartArtNode {
	return { id, text: id, parentId };
}

describe('applyChildOrder', () => {
	it('is a no-op when childOrder is absent', () => {
		const nodes = [node('a'), node('b')];
		expect(applyChildOrder(nodes, undefined)).toStrictEqual(nodes);
	});

	it('reorders siblings by srcOrd within a single parent (hierarchy--hier8.pptx shape)', () => {
		// COM-verified: hierarchy--hier8.pptx's 5 siblings' dgm:ptLst declaration
		// order does not match their cached left-to-right rendering order, but
		// sorting by srcOrd (from dgm:cxn) reproduces it exactly.
		const nodes = [node('c3', 'root'), node('c1', 'root'), node('c2', 'root'), node('root')];
		const childOrder = new Map<string, number>([
			['c1', 0],
			['c2', 1],
			['c3', 2],
		]);
		const ordered = applyChildOrder(nodes, childOrder);
		expect(ordered.map((n) => n.id)).toStrictEqual(['c1', 'c2', 'c3', 'root']);
	});

	it(
		"does NOT interleave two different parents' children even when their " +
			'srcOrd values collide (regression: smartart-orgchart-fan-variants.pptx, ' +
			'multiple managers each numbering their own reports from 0)',
		() => {
			// Two managers, M1 and M2, each with their own "first"/"second" report.
			// Both children sets independently declare srcOrd 0/1 - a GLOBAL sort by
			// that raw value alone would interleave them (m1First, m2First, m1Second,
			// m2Second) even though `nodes`' own array order already keeps each
			// manager's reports contiguous and in the right relative position.
			const nodes = [
				node('m1'),
				node('m1First', 'm1'),
				node('m1Second', 'm1'),
				node('m2'),
				node('m2First', 'm2'),
				node('m2Second', 'm2'),
			];
			const childOrder = new Map<string, number>([
				['m1First', 0],
				['m1Second', 1],
				['m2First', 0],
				['m2Second', 1],
			]);
			const ordered = applyChildOrder(nodes, childOrder);
			expect(ordered.map((n) => n.id)).toStrictEqual([
				'm1',
				'm1First',
				'm1Second',
				'm2',
				'm2First',
				'm2Second',
			]);
		},
	);

	it('sorts within a parent group even when declaration order is reversed relative to srcOrd', () => {
		const nodes = [
			node('m1'),
			node('m1Second', 'm1'),
			node('m1First', 'm1'),
			node('m2'),
			node('m2Second', 'm2'),
			node('m2First', 'm2'),
		];
		const childOrder = new Map<string, number>([
			['m1First', 0],
			['m1Second', 1],
			['m2First', 0],
			['m2Second', 1],
		]);
		const ordered = applyChildOrder(nodes, childOrder);
		expect(ordered.map((n) => n.id)).toStrictEqual([
			'm1',
			'm1First',
			'm1Second',
			'm2',
			'm2First',
			'm2Second',
		]);
	});
});
