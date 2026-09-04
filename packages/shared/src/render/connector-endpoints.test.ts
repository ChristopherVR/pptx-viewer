import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	collectConnectorSiteCandidates,
	findConnectorSiteNear,
	getConnectorEndpointHandles,
	resolveConnectorEndpointUpdate,
	withConnectorEndpointUpdate,
} from './connector-endpoints';

function box(overrides: Record<string, unknown>): PptxElement {
	return {
		id: 'shape-a',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as unknown as PptxElement;
}

function connector(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'conn-1',
		type: 'connector',
		shapeType: 'straightConnector1',
		x: 50,
		y: 50,
		width: 200,
		height: 100,
		...overrides,
	} as unknown as PptxElement;
}

describe('getConnectorEndpointHandles', () => {
	it('puts the start on the top-left corner of an unflipped connector', () => {
		expect(getConnectorEndpointHandles(connector())).toStrictEqual([
			{ kind: 'start', x: 50, y: 50, attached: false },
			{ kind: 'end', x: 250, y: 150, attached: false },
		]);
	});

	it('follows the flip flags, which are what set the line direction', () => {
		const handles = getConnectorEndpointHandles(
			connector({ flipHorizontal: true, flipVertical: true }),
		);
		expect(handles[0]).toMatchObject({ kind: 'start', x: 250, y: 150 });
		expect(handles[1]).toMatchObject({ kind: 'end', x: 50, y: 50 });
	});

	it('reports which ends already carry a binding', () => {
		const handles = getConnectorEndpointHandles(
			connector({
				shapeStyle: { connectorStartConnection: { shapeId: '2', connectionSiteIndex: 2 } },
			}),
		);
		expect(handles[0].attached).toBeTruthy();
		expect(handles[1].attached).toBeFalsy();
	});
});

describe('collectConnectorSiteCandidates', () => {
	it('offers the four edge midpoints of every non-connector element', () => {
		const sites = collectConnectorSiteCandidates([
			box({ id: 'a', x: 0, y: 0, width: 100, height: 50 }),
			connector(),
		]);
		expect(sites).toHaveLength(4);
		expect(sites.map((s) => [s.x, s.y])).toStrictEqual([
			[50, 0],
			[0, 25],
			[50, 50],
			[100, 25],
		]);
	});

	it('binds by the OOXML p:cNvPr id when the deck has one', () => {
		const [site] = collectConnectorSiteCandidates([box({ id: 'model-id', shapeId: '7' })]);
		expect(site.shapeId).toBe('7');
		expect(site.elementId).toBe('model-id');
	});

	it('falls back to the model id for a shape minted in the session', () => {
		const [site] = collectConnectorSiteCandidates([box({ id: 'model-id' })]);
		expect(site.shapeId).toBe('model-id');
	});
});

describe('findConnectorSiteNear', () => {
	const sites = collectConnectorSiteCandidates([
		box({ id: 'a', x: 0, y: 0, width: 100, height: 50 }),
	]);

	it('snaps to the nearest site inside the radius', () => {
		expect(findConnectorSiteNear(sites, 104, 27, 14)).toMatchObject({ siteIndex: 3 });
	});

	it('returns null outside the radius, which is what detaches an end', () => {
		expect(findConnectorSiteNear(sites, 400, 400, 14)).toBeNull();
	});
});

describe('resolveConnectorEndpointUpdate', () => {
	const target = box({ id: 'b', shapeId: '9', x: 300, y: 200, width: 100, height: 50 });
	const elements = [target, connector()];

	it('attaches the dragged end and leaves the other where it was', () => {
		const sites = collectConnectorSiteCandidates([target]);
		const update = resolveConnectorEndpointUpdate(
			connector(),
			elements,
			'end',
			{ x: 348, y: 202 },
			findConnectorSiteNear(sites, 348, 202),
		);
		// Snapped to the target's top-centre site (350, 200).
		expect(update.endConnection).toStrictEqual({ shapeId: '9', connectionSiteIndex: 0 });
		expect(update).toMatchObject({ x: 50, y: 50, width: 300, height: 150 });
		expect(update.flipHorizontal).toBeFalsy();
		expect(update.flipVertical).toBeFalsy();
	});

	// A drop on empty canvas DETACHES: the binding must be removed, not kept.
	it('detaches on a drop over empty canvas rather than keeping a stale binding', () => {
		const bound = connector({
			shapeStyle: { connectorEndConnection: { shapeId: '9', connectionSiteIndex: 0 } },
		});
		const update = resolveConnectorEndpointUpdate(bound, elements, 'end', { x: 20, y: 10 }, null);
		expect(update.endConnection).toBeUndefined();
		// Dropped above and left of the free start, so the line now runs backwards.
		expect(update.flipHorizontal).toBeTruthy();
		expect(update.flipVertical).toBeTruthy();
		expect(update).toMatchObject({ x: 20, y: 10, width: 30, height: 40 });
	});

	it('resolves the untouched end through ITS binding, so a bound far end is not lost', () => {
		const bound = connector({
			shapeStyle: { connectorStartConnection: { shapeId: '9', connectionSiteIndex: 1 } },
		});
		const update = resolveConnectorEndpointUpdate(bound, elements, 'end', { x: 0, y: 0 }, null);
		// Site 1 of the target is its left-centre: (300, 225).
		expect(update).toMatchObject({ x: 0, y: 0, width: 300, height: 225 });
		expect(update.startConnection).toStrictEqual({ shapeId: '9', connectionSiteIndex: 1 });
	});
});

describe('withConnectorEndpointUpdate', () => {
	it('removes the key entirely when an end is detached', () => {
		const bound = connector({
			shapeStyle: {
				strokeColor: '#000',
				connectorEndConnection: { shapeId: '9', connectionSiteIndex: 0 },
			},
		});
		const next = withConnectorEndpointUpdate(bound, {
			x: 1,
			y: 2,
			width: 3,
			height: 4,
			flipHorizontal: false,
			flipVertical: false,
		});
		const style = next.shapeStyle as Record<string, unknown>;
		expect('connectorEndConnection' in style).toBeFalsy();
		expect(style.strokeColor).toBe('#000');
		expect(next).toMatchObject({ x: 1, y: 2, width: 3, height: 4 });
	});
});
