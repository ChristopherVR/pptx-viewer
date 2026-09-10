import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { resolveRingItemNode } from './smartart-layout-interpreter-cycle-item-node';

describe('resolveRingItemNode', () => {
	it('falls back to the first genuinely repeating (forEachOrigin) child when no sibSp name match exists', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'cycle',
			children: [
				{ name: 'centerShape' },
				{ name: 'node', algorithm: { type: 'tx' }, forEachOrigin: { axis: ['ch'] } },
			],
		};
		const item = resolveRingItemNode(node, []);
		expect(item?.name).toBe('node');
	});

	it('trusts a sibSp name match only when it also genuinely repeats (forEachOrigin set)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'cycle',
			children: [
				{ name: 'centerShape' },
				{ name: 'node', algorithm: { type: 'tx' }, forEachOrigin: { axis: ['ch'] } },
			],
		};
		const item = resolveRingItemNode(node, [{ type: 'sibSp', referenceForName: 'node' }]);
		expect(item?.name).toBe('node');
	});

	it('declines a sibSp name match onto a SINGULAR node with no forEachOrigin (radial-list: sibSp references centerShape, the hub, not the ring item)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'cycle',
			children: [
				{ name: 'centerShape' },
				{ name: 'node', algorithm: { type: 'tx' }, forEachOrigin: { axis: ['ch'] } },
			],
		};
		const item = resolveRingItemNode(node, [{ type: 'sibSp', referenceForName: 'centerShape' }]);
		expect(item?.name).toBe('node');
	});

	it("skips a repeating CONNECTOR (alg.type==='conn') when a repeating non-connector sibling exists, even when the connector sits FIRST in document order (radial-cluster's own singleCycle: Name56 connector precedes text0)", () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'singleCycle',
			children: [
				{ name: 'singleCenter', algorithm: { type: 'tx' } },
				{ name: 'Name56', algorithm: { type: 'conn' }, forEachOrigin: { axis: ['self'] } },
				{ name: 'text0', algorithm: { type: 'tx' }, forEachOrigin: { axis: ['self'] } },
			],
		};
		const item = resolveRingItemNode(node, []);
		expect(item?.name).toBe('text0');
	});

	it('falls back to the repeating connector when NO non-connector repeating child exists at all (unchanged old behaviour, a defensive degenerate case)', () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'cycle',
			children: [{ name: 'conn1', algorithm: { type: 'conn' }, forEachOrigin: { axis: ['self'] } }],
		};
		const item = resolveRingItemNode(node, []);
		expect(item?.name).toBe('conn1');
	});

	it("falls back to itemNode()'s children[0] guess when nothing repeats at all (basic-cycle/multidirectional-cycle's own unchanged shape)", () => {
		const node: PptxSmartArtLayoutNode = {
			name: 'cycle',
			children: [{ name: 'node', algorithm: { type: 'tx' } }],
		};
		const item = resolveRingItemNode(node, []);
		expect(item?.name).toBe('node');
	});
});
