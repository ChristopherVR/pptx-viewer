import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	applyBar3DShapeToXml,
	applyRadarStyleToXml,
	applySeriesBar3DShapeToXml,
	applySurfaceWireframeToXml,
} from './chart-subtype-serializer';

function getLocalName(qualifiedName: string): string {
	const colonIndex = qualifiedName.lastIndexOf(':');
	return colonIndex >= 0 ? qualifiedName.substring(colonIndex + 1) : qualifiedName;
}

describe('applyBar3DShapeToXml', () => {
	it('inserts c:shape after gapWidth/gapDepth and before axId', () => {
		const container: XmlObject = {
			'c:barDir': { '@_val': 'col' },
			'c:grouping': { '@_val': 'clustered' },
			'c:ser': {},
			'c:gapWidth': { '@_val': '150' },
			'c:axId': [{ '@_val': '1' }, { '@_val': '2' }],
		};
		applyBar3DShapeToXml(container, 'bar3DChart', 'cylinder', getLocalName);
		expect(Object.keys(container)).toStrictEqual([
			'c:barDir',
			'c:grouping',
			'c:ser',
			'c:gapWidth',
			'c:shape',
			'c:axId',
		]);
		expect(container['c:shape']).toStrictEqual({ '@_val': 'cylinder' });
	});

	it('replaces an existing c:shape in place', () => {
		const container: XmlObject = {
			'c:barDir': { '@_val': 'col' },
			'c:shape': { '@_val': 'box' },
			'c:axId': [{ '@_val': '1' }],
		};
		applyBar3DShapeToXml(container, 'bar3DChart', 'coneToMax', getLocalName);
		expect(container['c:shape']).toStrictEqual({ '@_val': 'coneToMax' });
	});

	it('removes c:shape when given undefined', () => {
		const container: XmlObject = { 'c:shape': { '@_val': 'box' } };
		applyBar3DShapeToXml(container, 'bar3DChart', undefined, getLocalName);
		expect(container['c:shape']).toBeUndefined();
	});

	it('does not reorder an unknown container local name', () => {
		const container: XmlObject = { 'c:axId': [{ '@_val': '1' }] };
		applyBar3DShapeToXml(container, 'unknownChart', 'box', getLocalName);
		expect(Object.keys(container)).toStrictEqual(['c:axId', 'c:shape']);
	});
});

describe('applyRadarStyleToXml', () => {
	it('inserts c:radarStyle as the leading child', () => {
		const container: XmlObject = { 'c:varyColors': { '@_val': '0' }, 'c:ser': {} };
		applyRadarStyleToXml(container, 'radarChart', 'filled', getLocalName);
		expect(Object.keys(container)).toStrictEqual(['c:radarStyle', 'c:varyColors', 'c:ser']);
		expect(container['c:radarStyle']).toStrictEqual({ '@_val': 'filled' });
	});
});

describe('applySurfaceWireframeToXml', () => {
	it('inserts c:wireframe as the leading child, ahead of c:ser', () => {
		const container: XmlObject = { 'c:ser': {}, 'c:axId': [{ '@_val': '1' }] };
		applySurfaceWireframeToXml(container, 'surfaceChart', false, getLocalName);
		expect(Object.keys(container)).toStrictEqual(['c:wireframe', 'c:ser', 'c:axId']);
		expect(container['c:wireframe']).toStrictEqual({ '@_val': '0' });
	});

	it('writes val="1" for true', () => {
		const container: XmlObject = {};
		applySurfaceWireframeToXml(container, 'surfaceChart', true, getLocalName);
		expect(container['c:wireframe']).toStrictEqual({ '@_val': '1' });
	});

	it('removes c:wireframe when given undefined', () => {
		const container: XmlObject = { 'c:wireframe': { '@_val': '1' } };
		applySurfaceWireframeToXml(container, 'surfaceChart', undefined, getLocalName);
		expect(container['c:wireframe']).toBeUndefined();
	});
});

describe('applySeriesBar3DShapeToXml', () => {
	it('inserts c:shape after c:val, before c:extLst', () => {
		const seriesNode: XmlObject = {
			'c:idx': { '@_val': '0' },
			'c:val': {},
			'c:extLst': { 'c:ext': {} },
		};
		applySeriesBar3DShapeToXml(seriesNode, 'pyramid', getLocalName);
		expect(Object.keys(seriesNode)).toStrictEqual(['c:idx', 'c:val', 'c:shape', 'c:extLst']);
	});

	it('appends c:shape at the end when there is no c:extLst', () => {
		const seriesNode: XmlObject = { 'c:idx': { '@_val': '0' }, 'c:val': {} };
		applySeriesBar3DShapeToXml(seriesNode, 'box', getLocalName);
		expect(Object.keys(seriesNode)).toStrictEqual(['c:idx', 'c:val', 'c:shape']);
	});

	it('replaces an existing series c:shape in place', () => {
		const seriesNode: XmlObject = { 'c:shape': { '@_val': 'box' } };
		applySeriesBar3DShapeToXml(seriesNode, 'cylinder', getLocalName);
		expect(seriesNode['c:shape']).toStrictEqual({ '@_val': 'cylinder' });
	});

	it('removes an existing series c:shape when given undefined', () => {
		const seriesNode: XmlObject = { 'c:shape': { '@_val': 'box' } };
		applySeriesBar3DShapeToXml(seriesNode, undefined, getLocalName);
		expect(seriesNode['c:shape']).toBeUndefined();
	});
});
