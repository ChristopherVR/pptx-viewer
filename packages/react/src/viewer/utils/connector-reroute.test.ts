import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	rerouteConnectorsForMovedElements,
	computeConnectorGeometry,
	applyReroutedConnectors,
} from './connector-reroute';

// ---------------------------------------------------------------------------
// Helper: minimal element factory
// ---------------------------------------------------------------------------

function makeShape(id: string, x: number, y: number, width: number, height: number): PptxElement {
	return { id, type: 'shape', x, y, width, height } as PptxElement;
}

function makeConnector(
	id: string,
	x: number,
	y: number,
	width: number,
	height: number,
	startShapeId?: string,
	startSiteIndex?: number,
	endShapeId?: string,
	endSiteIndex?: number,
): PptxElement {
	return {
		id,
		type: 'connector',
		x,
		y,
		width,
		height,
		shapeType: 'straightConnector1',
		shapeStyle: {
			strokeColor: '#000',
			connectorStartConnection: startShapeId
				? { shapeId: startShapeId, connectionSiteIndex: startSiteIndex ?? 0 }
				: undefined,
			connectorEndConnection: endShapeId
				? { shapeId: endShapeId, connectionSiteIndex: endSiteIndex ?? 0 }
				: undefined,
		},
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// rerouteConnectorsForMovedElements
// ---------------------------------------------------------------------------

describe('rerouteConnectorsForMovedElements', () => {
	it('returns empty array when no elements were moved', () => {
		const elements = [
			makeShape('s1', 0, 0, 100, 100),
			makeConnector('c1', 50, 0, 50, 50, 's1', 0, 's2', 2),
			makeShape('s2', 100, 50, 100, 100),
		];
		const result = rerouteConnectorsForMovedElements(elements, new Set());
		expect(result).toStrictEqual([]);
	});

	it('returns empty array when no connectors reference moved elements', () => {
		const elements = [
			makeShape('s1', 0, 0, 100, 100),
			makeShape('s2', 200, 0, 100, 100),
			makeConnector('c1', 50, 0, 150, 50, 's1', 0, 's2', 0),
		];
		// Move s3 which doesn't exist; no connectors reference it
		const result = rerouteConnectorsForMovedElements(elements, new Set(['s3']));
		expect(result).toStrictEqual([]);
	});

	it('reroutes connector when start shape is moved', () => {
		// Shape s1 at (100, 100), 200x100: site 0 (top center) = (200, 100)
		// Shape s2 at (400, 300), 200x100: site 2 (bottom center) = (500, 400)
		const elements = [
			makeShape('s1', 100, 100, 200, 100),
			makeShape('s2', 400, 300, 200, 100),
			// Connector from s1 top-center to s2 bottom-center
			makeConnector('c1', 200, 100, 300, 300, 's1', 0, 's2', 2),
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s1']));
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('c1');
		// s1 site 0 (top center) = (100 + 100, 100 + 0) = (200, 100)
		// s2 site 2 (bottom center) = (400 + 100, 300 + 100) = (500, 400)
		expect(result[0].x).toBe(200);
		expect(result[0].y).toBe(100);
		expect(result[0].width).toBe(300);
		expect(result[0].height).toBe(300);
	});

	it('reroutes connector when end shape is moved', () => {
		// s1 at (0,0), 100x100, site 1 (right center) = (100, 50)
		// s2 moved to (300, 200), 100x100, site 3 (left center) = (300, 250)
		const elements = [
			makeShape('s1', 0, 0, 100, 100),
			makeShape('s2', 300, 200, 100, 100),
			makeConnector('c1', 100, 50, 200, 200, 's1', 1, 's2', 3),
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s2']));
		expect(result).toHaveLength(1);
		// s1 site 1 (right center) = (0+100, 0+50) = (100, 50)
		// s2 site 3 (left center) = (300+0, 200+50) = (300, 250)
		expect(result[0].x).toBe(100);
		expect(result[0].y).toBe(50);
		expect(result[0].width).toBe(200);
		expect(result[0].height).toBe(200);
	});

	it('reroutes connector when both shapes are moved', () => {
		const elements = [
			makeShape('s1', 50, 50, 100, 100),
			makeShape('s2', 250, 250, 100, 100),
			makeConnector('c1', 100, 50, 200, 200, 's1', 0, 's2', 2),
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s1', 's2']));
		expect(result).toHaveLength(1);
		// s1 site 0 (top center) = (50+50, 50+0) = (100, 50)
		// s2 site 2 (bottom center) = (250+50, 250+100) = (300, 350)
		expect(result[0].x).toBe(100);
		expect(result[0].y).toBe(50);
		expect(result[0].width).toBe(200);
		expect(result[0].height).toBe(300);
	});

	it('skips connectors that are themselves being moved', () => {
		const elements = [
			makeShape('s1', 50, 50, 100, 100),
			makeConnector('c1', 100, 50, 100, 100, 's1', 0, 's2', 2),
			makeShape('s2', 200, 200, 100, 100),
		];

		// Both the shape and the connector are being moved
		const result = rerouteConnectorsForMovedElements(elements, new Set(['s1', 'c1']));
		expect(result).toStrictEqual([]);
	});

	it('handles connectors with only start connection', () => {
		const elements = [
			makeShape('s1', 0, 0, 200, 100),
			// Connector with start connection only (no end connection)
			makeConnector('c1', 100, 0, 200, 200, 's1', 0),
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s1']));
		expect(result).toHaveLength(1);
		// s1 site 0 (top center) = (0+100, 0+0) = (100, 0)
		// No end connection; use existing: (100+200, 0+200) = (300, 200)
		expect(result[0].x).toBe(100);
		expect(result[0].y).toBe(0);
		expect(result[0].width).toBe(200);
		expect(result[0].height).toBe(200);
	});

	it('handles connectors with only end connection', () => {
		const elements = [
			makeShape('s2', 300, 300, 200, 100),
			// Connector with end connection only (no start connection)
			makeConnector('c1', 50, 50, 250, 300, undefined, undefined, 's2', 2),
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s2']));
		expect(result).toHaveLength(1);
		// No start connection; use existing: (50, 50)
		// s2 site 2 (bottom center) = (300+100, 300+100) = (400, 400)
		expect(result[0].x).toBe(50);
		expect(result[0].y).toBe(50);
		expect(result[0].width).toBe(350);
		expect(result[0].height).toBe(350);
	});

	it('reroutes multiple connectors for same moved shape', () => {
		const elements = [
			makeShape('s1', 100, 100, 100, 100),
			makeShape('s2', 300, 100, 100, 100),
			makeShape('s3', 100, 300, 100, 100),
			makeConnector('c1', 150, 100, 200, 0, 's1', 0, 's2', 0),
			makeConnector('c2', 150, 200, 0, 100, 's1', 2, 's3', 0),
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s1']));
		expect(result).toHaveLength(2);
		expect(result.map((r) => r.id).sort()).toStrictEqual(['c1', 'c2']);
	});

	it('skips non-connector elements even if they have shapeStyle with connections', () => {
		const elements = [
			makeShape('s1', 0, 0, 100, 100),
			// A text element masquerading with connection metadata
			{
				id: 't1',
				type: 'text',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				shapeStyle: {
					connectorStartConnection: { shapeId: 's1', connectionSiteIndex: 0 },
				},
			} as unknown as PptxElement,
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s1']));
		expect(result).toStrictEqual([]);
	});

	it('skips connectors without shapeStyle', () => {
		const elements = [
			makeShape('s1', 0, 0, 100, 100),
			{ id: 'c1', type: 'connector', x: 0, y: 0, width: 50, height: 50 } as PptxElement,
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s1']));
		expect(result).toStrictEqual([]);
	});

	it('excludes connectors when referenced shape is absent from elements', () => {
		const elements = [
			makeShape('s1', 0, 0, 100, 100),
			// Connector references s1 (present) and s_gone (absent from elements)
			makeConnector('c1', 0, 0, 50, 50, 's1', 0, 's_gone', 0),
		];

		const result = rerouteConnectorsForMovedElements(elements, new Set(['s1']));
		// computeConnectorGeometry returns null because s_gone is missing
		expect(result).toStrictEqual([]);
	});

	it('handles a chain of connectors through multiple shapes', () => {
		const elements = [
			makeShape('a', 0, 0, 100, 100),
			makeShape('b', 200, 0, 100, 100),
			makeShape('c', 400, 0, 100, 100),
			makeConnector('c_ab', 0, 0, 10, 10, 'a', 1, 'b', 3),
			makeConnector('c_bc', 0, 0, 10, 10, 'b', 1, 'c', 3),
		];

		// Move shape b; both connectors reference it
		const result = rerouteConnectorsForMovedElements(elements, new Set(['b']));
		expect(result).toHaveLength(2);
		expect(result.map((r) => r.id).sort()).toStrictEqual(['c_ab', 'c_bc']);
	});

	it('handles large slide with many elements', () => {
		const elements: PptxElement[] = [];

		// Create 100 shapes
		for (let i = 0; i < 100; i++) {
			elements.push(makeShape(`s${i}`, i * 50, i * 30, 40, 20));
		}

		// Create 50 connectors between consecutive shapes
		for (let i = 0; i < 50; i++) {
			elements.push(makeConnector(`c${i}`, 0, 0, 10, 10, `s${i}`, 1, `s${i + 1}`, 3));
		}

		// Move shape s0; should affect only c0
		const result = rerouteConnectorsForMovedElements(elements, new Set(['s0']));
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('c0');
	});
});

// ---------------------------------------------------------------------------
// computeConnectorGeometry
// ---------------------------------------------------------------------------

describe('computeConnectorGeometry', () => {
	it('returns null when start shape not found', () => {
		const connector = makeConnector('c1', 0, 0, 100, 100);
		const elementMap = new Map<string, PptxElement>();

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 'missing', connectionSiteIndex: 0 },
			undefined,
			elementMap,
		);
		expect(result).toBeNull();
	});

	it('returns null when end shape not found', () => {
		const s1 = makeShape('s1', 0, 0, 100, 100);
		const connector = makeConnector('c1', 0, 0, 100, 100);
		const elementMap = new Map<string, PptxElement>([['s1', s1]]);

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 0 },
			{ shapeId: 'missing', connectionSiteIndex: 0 },
			elementMap,
		);
		expect(result).toBeNull();
	});

	it('computes geometry for two connected shapes', () => {
		const s1 = makeShape('s1', 0, 0, 100, 100);
		const s2 = makeShape('s2', 200, 200, 100, 100);
		const connector = makeConnector('c1', 0, 0, 200, 200);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 1 }, // right center = (100, 50)
			{ shapeId: 's2', connectionSiteIndex: 3 }, // left center = (200, 250)
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.x).toBe(100);
		expect(result!.y).toBe(50);
		expect(result!.width).toBe(100);
		expect(result!.height).toBe(200);
	});

	it('ensures minimum width of 1', () => {
		const s1 = makeShape('s1', 0, 0, 100, 100);
		const s2 = makeShape('s2', 0, 200, 100, 100);
		const connector = makeConnector('c1', 50, 100, 1, 100);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		// Both at x=50 (top center of both) → width would be 0
		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 0 }, // top center = (50, 0)
			{ shapeId: 's2', connectionSiteIndex: 0 }, // top center = (50, 200)
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.width).toBe(1); // minimum width
		expect(result!.height).toBe(200);
	});

	it('uses different connection site indices correctly', () => {
		const s1 = makeShape('s1', 0, 0, 200, 100);
		const s2 = makeShape('s2', 300, 0, 200, 100);
		const connector = makeConnector('c1', 0, 0, 300, 100);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		// Sites: 0=top-center, 1=right-center, 2=bottom-center, 3=left-center
		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 2 }, // bottom center = (100, 100)
			{ shapeId: 's2', connectionSiteIndex: 0 }, // top center = (400, 0)
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.x).toBe(100);
		expect(result!.y).toBe(0);
		expect(result!.width).toBe(300);
		expect(result!.height).toBe(100);
	});

	it('ensures minimum height of 1 when start and end have same y', () => {
		const s1 = makeShape('s1', 0, 0, 100, 100);
		const s2 = makeShape('s2', 200, 0, 100, 100);
		const connector = makeConnector('c1', 0, 0, 200, 1);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		// Both at left-center site 3: s1=(0, 50), s2=(200, 50)
		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 3 },
			{ shapeId: 's2', connectionSiteIndex: 3 },
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.height).toBe(1); // |50-50| → clamped to 1
		expect(result!.width).toBe(200); // |200-0|
	});

	it('ensures both width and height are 1 when start and end fully coincide', () => {
		const s1 = makeShape('s1', 100, 100, 200, 100);
		const connector = makeConnector('c1', 0, 0, 1, 1);
		const elementMap = new Map<string, PptxElement>([['s1', s1]]);

		// Same shape, same site → start == end
		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 0 },
			{ shapeId: 's1', connectionSiteIndex: 0 },
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.width).toBe(1);
		expect(result!.height).toBe(1);
	});

	it('defaults connectionSiteIndex to 0 when not specified', () => {
		const s1 = makeShape('s1', 100, 200, 60, 40);
		const s2 = makeShape('s2', 300, 400, 80, 50);
		const connector = makeConnector('c1', 0, 0, 1, 1);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		// No connectionSiteIndex → defaults to 0 (top center)
		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1' },
			{ shapeId: 's2' },
			elementMap,
		);
		expect(result).not.toBeNull();
		// site 0 = top center: (width/2, 0)
		// start: (100+30, 200+0) = (130, 200)
		// end:   (300+40, 400+0) = (340, 400)
		expect(result!.x).toBe(130);
		expect(result!.y).toBe(200);
		expect(result!.width).toBe(210);
		expect(result!.height).toBe(200);
	});

	it('falls back to site 0 when connectionSiteIndex is out of range', () => {
		const s1 = makeShape('s1', 0, 0, 100, 100);
		const connector = makeConnector('c1', 0, 0, 50, 50);
		const elementMap = new Map<string, PptxElement>([['s1', s1]]);

		// Index 99 does not exist in the 4-element sites array → fallback to sites[0]
		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 99 },
			undefined,
			elementMap,
		);
		expect(result).not.toBeNull();
		// Fallback site 0: (50, 0) → start = (50, 0)
		// end = connector end: (0+50, 0+50) = (50, 50)
		expect(result!.x).toBe(50);
		expect(result!.y).toBe(0);
		expect(result!.width).toBe(1); // |50-50| → clamped
		expect(result!.height).toBe(50);
	});

	it('handles zero-size shapes', () => {
		const s1 = makeShape('s1', 50, 75, 0, 0);
		const connector = makeConnector('c1', 0, 0, 10, 10);
		const elementMap = new Map<string, PptxElement>([['s1', s1]]);

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 0 },
			undefined,
			elementMap,
		);
		expect(result).not.toBeNull();
		// Site 0 on zero-size shape: (0/2, 0) = (0, 0) → start = (50, 75)
		// end = (0+10, 0+10) = (10, 10)
		expect(result!.x).toBe(10); // min(50, 10)
		expect(result!.y).toBe(10); // min(75, 10)
		expect(result!.width).toBe(40); // |50-10|
		expect(result!.height).toBe(65); // |75-10|
	});

	it('handles end point to the left of start point', () => {
		const s1 = makeShape('s1', 500, 100, 100, 100);
		const s2 = makeShape('s2', 100, 300, 100, 100);
		const connector = makeConnector('c1', 0, 0, 1, 1);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 2 }, // bottom center: (550, 200)
			{ shapeId: 's2', connectionSiteIndex: 0 }, // top center: (150, 300)
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.x).toBe(150); // min(550, 150)
		expect(result!.y).toBe(200); // min(200, 300)
		expect(result!.width).toBe(400); // |150-550|
		expect(result!.height).toBe(100); // |300-200|
	});

	it('handles end point above start point', () => {
		const s1 = makeShape('s1', 100, 400, 100, 100);
		const s2 = makeShape('s2', 100, 100, 100, 100);
		const connector = makeConnector('c1', 0, 0, 1, 1);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 0 }, // top center: (150, 400)
			{ shapeId: 's2', connectionSiteIndex: 2 }, // bottom center: (150, 200)
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.x).toBe(150);
		expect(result!.y).toBe(200); // min(400, 200)
		expect(result!.width).toBe(1); // |150-150| → clamped
		expect(result!.height).toBe(200); // |200-400|
	});

	it('uses connector position when both connections are undefined', () => {
		const connector = makeConnector('c1', 10, 20, 300, 400);
		const elementMap = new Map<string, PptxElement>();

		const result = computeConnectorGeometry(connector, undefined, undefined, elementMap);
		expect(result).not.toBeNull();
		// start: (10, 20), end: (310, 420)
		expect(result!.x).toBe(10);
		expect(result!.y).toBe(20);
		expect(result!.width).toBe(300);
		expect(result!.height).toBe(400);
	});

	it('uses connector position for start when startConn has no shapeId', () => {
		const s2 = makeShape('s2', 200, 200, 100, 100);
		const connector = makeConnector('c1', 10, 20, 300, 400);
		const elementMap = new Map<string, PptxElement>([['s2', s2]]);

		const result = computeConnectorGeometry(
			connector,
			{ connectionSiteIndex: 0 }, // no shapeId
			{ shapeId: 's2', connectionSiteIndex: 0 }, // top center = (250, 200)
			elementMap,
		);
		expect(result).not.toBeNull();
		// start: connector pos = (10, 20)
		// end: (250, 200)
		expect(result!.x).toBe(10);
		expect(result!.y).toBe(20);
		expect(result!.width).toBe(240);
		expect(result!.height).toBe(180);
	});

	it('uses connector end position when endConn has no shapeId', () => {
		const s1 = makeShape('s1', 0, 0, 100, 100);
		const connector = makeConnector('c1', 10, 20, 300, 400);
		const elementMap = new Map<string, PptxElement>([['s1', s1]]);

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 1 }, // right center = (100, 50)
			{ connectionSiteIndex: 0 }, // no shapeId
			elementMap,
		);
		expect(result).not.toBeNull();
		// start: (100, 50)
		// end: connector end = (10+300, 20+400) = (310, 420)
		expect(result!.x).toBe(100);
		expect(result!.y).toBe(50);
		expect(result!.width).toBe(210);
		expect(result!.height).toBe(370);
	});

	it('handles all four connection site indices on a single shape', () => {
		const shape = makeShape('s', 100, 200, 300, 400);
		const elementMap = new Map<string, PptxElement>([['s', shape]]);

		// Use a fixed end point via connector position (no end connection)
		const connector = makeConnector('c', 0, 0, 0, 0);

		// Site 0: top center = (100+150, 200+0) = (250, 200)
		const r0 = computeConnectorGeometry(
			connector,
			{ shapeId: 's', connectionSiteIndex: 0 },
			undefined,
			elementMap,
		);
		expect(r0).not.toBeNull();
		// start: (250, 200), end: (0+0, 0+0) = (0, 0)
		expect(r0!.x).toBe(0);
		expect(r0!.y).toBe(0);
		expect(r0!.width).toBe(250);
		expect(r0!.height).toBe(200);

		// Site 1: right center = (100+300, 200+200) = (400, 400)
		const r1 = computeConnectorGeometry(
			connector,
			{ shapeId: 's', connectionSiteIndex: 1 },
			undefined,
			elementMap,
		);
		expect(r1).not.toBeNull();
		expect(r1!.x).toBe(0);
		expect(r1!.y).toBe(0);
		expect(r1!.width).toBe(400);
		expect(r1!.height).toBe(400);

		// Site 2: bottom center = (100+150, 200+400) = (250, 600)
		const r2 = computeConnectorGeometry(
			connector,
			{ shapeId: 's', connectionSiteIndex: 2 },
			undefined,
			elementMap,
		);
		expect(r2).not.toBeNull();
		expect(r2!.x).toBe(0);
		expect(r2!.y).toBe(0);
		expect(r2!.width).toBe(250);
		expect(r2!.height).toBe(600);

		// Site 3: left center = (100+0, 200+200) = (100, 400)
		const r3 = computeConnectorGeometry(
			connector,
			{ shapeId: 's', connectionSiteIndex: 3 },
			undefined,
			elementMap,
		);
		expect(r3).not.toBeNull();
		expect(r3!.x).toBe(0);
		expect(r3!.y).toBe(0);
		expect(r3!.width).toBe(100);
		expect(r3!.height).toBe(400);
	});

	it('handles shapes at negative coordinates', () => {
		const s1 = makeShape('s1', -100, -200, 200, 100);
		const s2 = makeShape('s2', 100, 100, 200, 100);
		const connector = makeConnector('c1', 0, 0, 1, 1);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 0 }, // top center: (-100+100, -200+0) = (0, -200)
			{ shapeId: 's2', connectionSiteIndex: 2 }, // bottom center: (100+100, 100+100) = (200, 200)
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.x).toBe(0);
		expect(result!.y).toBe(-200);
		expect(result!.width).toBe(200);
		expect(result!.height).toBe(400);
	});

	it('handles very large coordinate values', () => {
		const s1 = makeShape('s1', 100000, 200000, 50000, 30000);
		const s2 = makeShape('s2', 300000, 400000, 50000, 30000);
		const connector = makeConnector('c1', 0, 0, 1, 1);
		const elementMap = new Map<string, PptxElement>([
			['s1', s1],
			['s2', s2],
		]);

		const result = computeConnectorGeometry(
			connector,
			{ shapeId: 's1', connectionSiteIndex: 1 }, // right center: (150000, 215000)
			{ shapeId: 's2', connectionSiteIndex: 3 }, // left center: (300000, 415000)
			elementMap,
		);
		expect(result).not.toBeNull();
		expect(result!.x).toBe(150000);
		expect(result!.y).toBe(215000);
		expect(result!.width).toBe(150000);
		expect(result!.height).toBe(200000);
	});
});

// ---------------------------------------------------------------------------
// applyReroutedConnectors
// ---------------------------------------------------------------------------

describe('applyReroutedConnectors', () => {
	it('returns original array when no reroutes', () => {
		const elements = [makeShape('s1', 0, 0, 100, 100), makeConnector('c1', 50, 0, 50, 50)];
		const result = applyReroutedConnectors(elements, []);
		expect(result).toBe(elements); // same reference
	});

	it('updates only rerouted connector geometry', () => {
		const elements = [
			makeShape('s1', 0, 0, 100, 100),
			makeConnector('c1', 50, 0, 50, 50),
			makeShape('s2', 200, 200, 100, 100),
		];

		const rerouted = [{ id: 'c1', x: 100, y: 50, width: 200, height: 200 }];
		const result = applyReroutedConnectors(elements, rerouted);

		expect(result).not.toBe(elements);
		expect(result).toHaveLength(3);
		// Shape s1 unchanged
		expect(result[0]).toBe(elements[0]);
		// Connector c1 updated
		expect(result[1].x).toBe(100);
		expect(result[1].y).toBe(50);
		expect(result[1].width).toBe(200);
		expect(result[1].height).toBe(200);
		// Shape s2 unchanged
		expect(result[2]).toBe(elements[2]);
	});

	it('preserves non-geometric connector properties', () => {
		const connector = makeConnector('c1', 0, 0, 100, 100, 's1', 0, 's2', 2);
		const elements = [connector];

		const rerouted = [{ id: 'c1', x: 10, y: 20, width: 300, height: 400 }];
		const result = applyReroutedConnectors(elements, rerouted);

		const updated = result[0] as unknown as {
			type: string;
			shapeStyle: { connectorStartConnection: { shapeId: string } };
		};
		expect(updated.type).toBe('connector');
		expect(updated.shapeStyle.connectorStartConnection.shapeId).toBe('s1');
	});

	it('applies multiple rerouted connectors', () => {
		const elements = [
			makeConnector('c1', 0, 0, 50, 50),
			makeConnector('c2', 10, 10, 60, 60),
			makeConnector('c3', 20, 20, 70, 70),
		];

		const rerouted = [
			{ id: 'c1', x: 100, y: 200, width: 300, height: 400 },
			{ id: 'c3', x: 500, y: 600, width: 700, height: 800 },
		];

		const result = applyReroutedConnectors(elements, rerouted);

		expect(result[0].x).toBe(100);
		expect(result[0].y).toBe(200);
		expect(result[1]).toBe(elements[1]); // c2 untouched
		expect(result[2].x).toBe(500);
		expect(result[2].y).toBe(600);
		expect(result[2].width).toBe(700);
		expect(result[2].height).toBe(800);
	});

	it('does not mutate the original elements array', () => {
		const elements = [makeConnector('c1', 0, 0, 50, 50)];
		const rerouted = [{ id: 'c1', x: 100, y: 100, width: 200, height: 200 }];

		const result = applyReroutedConnectors(elements, rerouted);

		expect(result).not.toBe(elements);
		// Original element unchanged
		expect(elements[0].x).toBe(0);
		expect(elements[0].y).toBe(0);
	});

	it('gracefully ignores rerouted entries that match no elements', () => {
		const elements = [makeConnector('c1', 0, 0, 50, 50)];
		const rerouted = [{ id: 'nonexistent', x: 100, y: 100, width: 200, height: 200 }];

		const result = applyReroutedConnectors(elements, rerouted);

		expect(result).toHaveLength(1);
		expect(result[0]).toBe(elements[0]); // unchanged
	});
});

// ---------------------------------------------------------------------------
// Integration: reroute + apply
// ---------------------------------------------------------------------------

describe('integration: reroute and apply', () => {
	it('correctly reroutes and applies connector updates for a moved shape', () => {
		// Shape A at (200, 200), 200x100; shape B at (600, 400), 200x100
		const shapeA = makeShape('a', 200, 200, 200, 100);
		const shapeB = makeShape('b', 600, 400, 200, 100);
		const connector = makeConnector(
			'c1',
			100,
			100,
			500,
			300,
			'a',
			1, // right center
			'b',
			3, // left center
		);

		const elements = [shapeA, shapeB, connector];

		const rerouted = rerouteConnectorsForMovedElements(elements, new Set(['a']));
		expect(rerouted).toHaveLength(1);

		const updated = applyReroutedConnectors(elements, rerouted);

		expect(updated).toHaveLength(3);
		expect(updated[0]).toBe(shapeA); // unchanged
		expect(updated[1]).toBe(shapeB); // unchanged

		const conn = updated[2];
		// start: A right center = (200+200, 200+50) = (400, 250)
		// end: B left center = (600+0, 400+50) = (600, 450)
		expect(conn.x).toBe(400);
		expect(conn.y).toBe(250);
		expect(conn.width).toBe(200);
		expect(conn.height).toBe(200);
	});

	it('handles overlapping elements at same position', () => {
		const shapeA = makeShape('a', 100, 100, 200, 200);
		const shapeB = makeShape('b', 100, 100, 200, 200); // exact overlap
		const connector = makeConnector(
			'c1',
			0,
			0,
			10,
			10,
			'a',
			1, // right center: (300, 200)
			'b',
			1, // right center: (300, 200), same
		);

		const elements = [shapeA, shapeB, connector];
		const rerouted = rerouteConnectorsForMovedElements(elements, new Set(['a']));

		expect(rerouted).toHaveLength(1);
		// Both endpoints are (300, 200) → width and height clamped to 1
		expect(rerouted[0].x).toBe(300);
		expect(rerouted[0].y).toBe(200);
		expect(rerouted[0].width).toBe(1);
		expect(rerouted[0].height).toBe(1);
	});

	it('handles elements at negative coordinates', () => {
		const shapeA = makeShape('a', -100, -200, 200, 100);
		const shapeB = makeShape('b', 100, 100, 200, 100);
		const connector = makeConnector(
			'c1',
			0,
			0,
			10,
			10,
			'a',
			0, // top center: (0, -200)
			'b',
			2, // bottom center: (200, 200)
		);

		const elements = [shapeA, shapeB, connector];
		const rerouted = rerouteConnectorsForMovedElements(elements, new Set(['a']));

		expect(rerouted).toHaveLength(1);
		expect(rerouted[0].x).toBe(0);
		expect(rerouted[0].y).toBe(-200);
		expect(rerouted[0].width).toBe(200);
		expect(rerouted[0].height).toBe(400);
	});

	it('reroutes chain of connectors when middle shape moves', () => {
		const a = makeShape('a', 0, 0, 100, 100);
		const b = makeShape('b', 200, 0, 100, 100);
		const c = makeShape('c', 400, 0, 100, 100);

		const cAB = makeConnector('c_ab', 0, 0, 10, 10, 'a', 1, 'b', 3);
		const cBC = makeConnector('c_bc', 0, 0, 10, 10, 'b', 1, 'c', 3);

		const elements = [a, b, c, cAB, cBC];

		// Move shape b; both connectors should reroute
		const rerouted = rerouteConnectorsForMovedElements(elements, new Set(['b']));
		expect(rerouted).toHaveLength(2);

		const updated = applyReroutedConnectors(elements, rerouted);

		// Find updated connectors
		const updatedAB = updated.find((e) => e.id === 'c_ab')!;
		const updatedBC = updated.find((e) => e.id === 'c_bc')!;

		// c_ab: A right center (100, 50) → B left center (200, 50)
		expect(updatedAB.x).toBe(100);
		expect(updatedAB.y).toBe(50);
		expect(updatedAB.width).toBe(100);
		expect(updatedAB.height).toBe(1); // same y → clamped

		// c_bc: B right center (300, 50) → C left center (400, 50)
		expect(updatedBC.x).toBe(300);
		expect(updatedBC.y).toBe(50);
		expect(updatedBC.width).toBe(100);
		expect(updatedBC.height).toBe(1); // same y → clamped
	});
});
