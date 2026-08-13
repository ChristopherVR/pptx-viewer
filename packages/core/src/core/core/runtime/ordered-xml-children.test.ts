/**
 * Contract for the shared ordered-children primitive.
 *
 * Both shape containers in `CT_GroupShape` form (`p:spTree` and `p:grpSp`) are
 * painter's-algorithm sequences, so this primitive is what stops either of them
 * being restacked by the one-array-per-tag object shape.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { assignOrderedXmlChildren, setOwnXmlProperty } from './ordered-xml-children';

describe('assignOrderedXmlChildren', () => {
	it('keeps an already-grouped container marker-free', () => {
		const target: XmlObject = {};
		assignOrderedXmlChildren(target, [
			{ tag: 'p:sp', node: { '@_n': '1' } },
			{ tag: 'p:sp', node: { '@_n': '2' } },
			{ tag: 'p:pic', node: { '@_n': '3' } },
		]);
		expect(Object.keys(target)).toStrictEqual(['p:sp', 'p:pic']);
		expect(target['p:sp']).toStrictEqual([{ '@_n': '1' }, { '@_n': '2' }]);
	});

	it('marks a tag that reappears after a different tag', () => {
		const target: XmlObject = {};
		assignOrderedXmlChildren(target, [
			{ tag: 'p:sp', node: { '@_n': '1' } },
			{ tag: 'p:pic', node: { '@_n': '2' } },
			{ tag: 'p:sp', node: { '@_n': '3' } },
			{ tag: 'p:sp', node: { '@_n': '4' } },
		]);
		// Key insertion order is the document order; the builder strips the marker.
		expect(Object.keys(target)).toStrictEqual(['p:sp', 'p:pic', 'p:sp#pptx-order-2']);
		expect(target['p:sp']).toStrictEqual({ '@_n': '1' });
		expect(target['p:sp#pptx-order-2']).toStrictEqual([{ '@_n': '3' }, { '@_n': '4' }]);
	});

	it('unwraps a single-node run', () => {
		const target: XmlObject = {};
		assignOrderedXmlChildren(target, [{ tag: 'p:grpSp', node: { '@_n': '1' } }]);
		expect(target['p:grpSp']).toStrictEqual({ '@_n': '1' });
	});

	it('is a no-op for an empty child list', () => {
		const target: XmlObject = { 'p:nvGrpSpPr': {} };
		assignOrderedXmlChildren(target, []);
		expect(Object.keys(target)).toStrictEqual(['p:nvGrpSpPr']);
	});
});

describe('setOwnXmlProperty', () => {
	it('creates a literal own property even for __proto__', () => {
		const target: XmlObject = {};
		setOwnXmlProperty(target, '__proto__', { hostile: true });
		expect(Object.keys(target)).toStrictEqual(['__proto__']);
		expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
	});
});
