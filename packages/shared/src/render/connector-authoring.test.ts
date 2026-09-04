import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	authorConnectorBetweenSites,
	connectorEndpointId,
	connectorEndpointPoint,
	connectorPresetForSpan,
} from './connector-authoring';

function rect(id: string, x: number, y: number, width = 100, height = 100): PptxElement {
	return { id, type: 'shape', x, y, width, height } as PptxElement;
}

/** A shape with a real `a:cxnLst`: one site, at the path's top-left corner. */
function shapeWithCornerSite(id: string, x: number, y: number): PptxElement {
	return {
		id,
		type: 'shape',
		x,
		y,
		width: 100,
		height: 100,
		pathWidth: 100,
		pathHeight: 100,
		customGeometryConnectionSites: [{ posX: '0', posY: '0' }],
	} as unknown as PptxElement;
}

describe('connectorPresetForSpan', () => {
	it('picks straight, elbow and curve by span', () => {
		expect(connectorPresetForSpan(10)).toBe('straightConnector1');
		expect(connectorPresetForSpan(150)).toBe('bentConnector3');
		expect(connectorPresetForSpan(400)).toBe('curvedConnector3');
	});
});

describe('connectorEndpointId', () => {
	it('prefers the OOXML cNvPr id, which is what a:stCxn/@id must carry', () => {
		const parsed = { ...rect('ppt/slides/slide1.xml-shape-0', 0, 0), shapeId: '2' } as PptxElement;
		expect(connectorEndpointId(parsed)).toBe('2');
	});

	it('falls back to the model id for a shape minted in the session', () => {
		expect(connectorEndpointId(rect('new-1', 0, 0))).toBe('new-1');
	});
});

describe('connectorEndpointPoint', () => {
	it('honours a shape with a real a:cxnLst rather than the edge-midpoint fallback', () => {
		// The bug this guards: authoring resolved site indices against the four
		// edge midpoints while the reroute resolved them against the parsed
		// connection sites, so the connector jumped on the first shape move.
		const point = connectorEndpointPoint({
			element: shapeWithCornerSite('s', 300, 400),
			siteIndex: 0,
		});
		expect(point).toStrictEqual({ x: 300, y: 400 });
	});

	it('falls back to the edge midpoints for a shape with no parsed sites', () => {
		// idx 2 on a plain rect is bottom-centre.
		expect(connectorEndpointPoint({ element: rect('s', 0, 0), siteIndex: 2 })).toStrictEqual({
			x: 50,
			y: 100,
		});
	});
});

describe('authorConnectorBetweenSites', () => {
	it('spans the two resolved sites and binds both ends', () => {
		const start = { ...rect('a', 0, 0), shapeId: '2' } as PptxElement;
		const end = { ...rect('b', 400, 300), shapeId: '3' } as PptxElement;

		const authored = authorConnectorBetweenSites(
			{ element: start, siteIndex: 2 }, // bottom-centre => (50, 100)
			{ element: end, siteIndex: 0 }, // top-centre    => (450, 300)
		);

		expect(authored).toStrictEqual({
			x: 50,
			y: 100,
			width: 400,
			height: 200,
			shapeType: 'curvedConnector3',
			startConnection: { shapeId: '2', connectionSiteIndex: 2 },
			endConnection: { shapeId: '3', connectionSiteIndex: 0 },
		});
	});

	it('keeps a purely horizontal connector paintable with a 1px height', () => {
		const authored = authorConnectorBetweenSites(
			{ element: rect('a', 0, 0), siteIndex: 3 }, // right-centre => (100, 50)
			{ element: rect('b', 200, 0), siteIndex: 1 }, // left-centre  => (200, 50)
		);
		expect(authored?.height).toBe(1);
		expect(authored?.width).toBe(100);
	});

	it('refuses a drag that starts and ends on the same shape', () => {
		const only = rect('a', 0, 0);
		expect(
			authorConnectorBetweenSites({ element: only, siteIndex: 0 }, { element: only, siteIndex: 2 }),
		).toBeNull();
	});
});
