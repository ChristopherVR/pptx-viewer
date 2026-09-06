import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyRotationFlipToRawNode } from './chart-user-shapes-raw-patch';

describe('applyRotationFlipToRawNode', () => {
	it('leaves a node with no existing xfrm and nothing to write untouched', () => {
		const node: XmlObject = { 'cdr:spPr': { 'a:prstGeom': { '@_prst': 'rect' } } };
		const before = JSON.stringify(node);
		applyRotationFlipToRawNode(node, undefined, undefined, undefined);
		expect(JSON.stringify(node)).toBe(before);
	});

	it('writes rot/flipH/flipV onto an existing spPr/xfrm, preserving its off/ext', () => {
		const node: XmlObject = {
			'cdr:spPr': {
				'a:xfrm': {
					'a:off': { '@_x': '0', '@_y': '0' },
					'a:ext': { '@_cx': '100', '@_cy': '200' },
				},
			},
		};
		applyRotationFlipToRawNode(node, 30, true, false);
		const xfrm = (node['cdr:spPr'] as XmlObject)['a:xfrm'] as XmlObject;
		expect(xfrm['@_rot']).toBe('1800000');
		expect(xfrm['@_flipH']).toBe('1');
		expect(xfrm['@_flipV']).toBeUndefined();
		expect(xfrm['a:off']).toStrictEqual({ '@_x': '0', '@_y': '0' });
	});

	it('fabricates a bare xfrm (no off/ext) when there is none yet but rotation is set', () => {
		const node: XmlObject = { 'cdr:spPr': { 'a:prstGeom': { '@_prst': 'rect' } } };
		applyRotationFlipToRawNode(node, 45, undefined, undefined);
		const xfrm = (node['cdr:spPr'] as XmlObject)['a:xfrm'] as XmlObject;
		expect(xfrm['@_rot']).toBe('2700000');
		expect(xfrm['a:off']).toBeUndefined();
	});

	it('deletes a stale rot/flip attribute when the field is cleared', () => {
		const node: XmlObject = {
			'cdr:spPr': { 'a:xfrm': { '@_rot': '1800000', '@_flipV': '1' } },
		};
		applyRotationFlipToRawNode(node, undefined, undefined, undefined);
		const xfrm = (node['cdr:spPr'] as XmlObject)['a:xfrm'] as XmlObject;
		expect(xfrm['@_rot']).toBeUndefined();
		expect(xfrm['@_flipV']).toBeUndefined();
	});

	it('patches a direct (no-spPr) node, e.g. a graphicFrame', () => {
		const node: XmlObject = { 'a:xfrm': { 'a:off': { '@_x': '1', '@_y': '2' } } };
		applyRotationFlipToRawNode(node, 90, false, true);
		const xfrm = node['a:xfrm'] as XmlObject;
		expect(xfrm['@_rot']).toBe('5400000');
		expect(xfrm['@_flipV']).toBe('1');
		expect(xfrm['@_flipH']).toBeUndefined();
	});
});
