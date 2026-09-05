import { describe, expect, it } from 'vitest';

import type { PptxSmartArtConnection, XmlObject } from '../types';
import {
	resolveSmartArtNodeCoherent3DOff,
	resolveSmartArtNodeStyleRoles,
} from './smartart-node-style-role';

const localName = (key: string): string => key.split(':').pop() ?? key;

function presPoint(
	modelId: string,
	presStyleLbl: string,
	presName = 'node',
	coherent3DOff?: string,
): XmlObject {
	return {
		'@_modelId': modelId,
		'@_type': 'pres',
		'dgm:prSet': {
			'@_presStyleLbl': presStyleLbl,
			'@_presName': presName,
			...(coherent3DOff !== undefined ? { '@_coherent3DOff': coherent3DOff } : {}),
		},
	};
}

describe('resolveSmartArtNodeStyleRoles', () => {
	it('resolves a content node role from its presOf-linked pres point', () => {
		const points = [presPoint('p1', 'node1')];
		const connections: PptxSmartArtConnection[] = [
			{ sourceId: 'n1', destId: 'p1', type: 'presOf' },
		];
		const roles = resolveSmartArtNodeStyleRoles(points, connections, localName);
		expect(roles.get('n1')).toBe('node1');
	});

	it('prefers the pres point whose presName is "node" over a decorative one', () => {
		const points = [presPoint('bg', 'bgShp', 'bg'), presPoint('primary', 'node1', 'node')];
		const connections: PptxSmartArtConnection[] = [
			// Decorative background presOf resolved FIRST in document order.
			{ sourceId: 'n1', destId: 'bg', type: 'presOf' },
			{ sourceId: 'n1', destId: 'primary', type: 'presOf' },
		];
		const roles = resolveSmartArtNodeStyleRoles(points, connections, localName);
		expect(roles.get('n1')).toBe('node1');
	});

	it('ignores non-presOf connections', () => {
		const points = [presPoint('p1', 'node1')];
		const connections: PptxSmartArtConnection[] = [{ sourceId: 'n1', destId: 'p1', type: 'parOf' }];
		expect(resolveSmartArtNodeStyleRoles(points, connections, localName).size).toBe(0);
	});

	it('returns an empty map when there are no pres points', () => {
		expect(resolveSmartArtNodeStyleRoles([], [], localName).size).toBe(0);
	});

	it('resolves distinct roles for an org-chart manager and assistant', () => {
		const points = [presPoint('pm', 'node1'), presPoint('pa', 'asst0')];
		const connections: PptxSmartArtConnection[] = [
			{ sourceId: 'mgr', destId: 'pm', type: 'presOf' },
			{ sourceId: 'asst', destId: 'pa', type: 'presOf' },
		];
		const roles = resolveSmartArtNodeStyleRoles(points, connections, localName);
		expect(roles.get('mgr')).toBe('node1');
		expect(roles.get('asst')).toBe('asst0');
	});
});

// G12: `dgm:prSet/@coherent3DOff` opts a node out of the diagram's coherent
// 3D scene rotation. PowerPoint always writes it on the presentation point,
// resolved via `presOf` like `styleRole` (see `resolveSmartArtNodeStyleRoles`).
describe('resolveSmartArtNodeCoherent3DOff', () => {
	it('resolves coherent3DOff="1" from the presOf-linked pres point', () => {
		const points = [presPoint('p1', 'node1', 'node', '1')];
		const connections: PptxSmartArtConnection[] = [
			{ sourceId: 'n1', destId: 'p1', type: 'presOf' },
		];
		expect(resolveSmartArtNodeCoherent3DOff(points, connections, localName).has('n1')).toBeTruthy();
	});

	it('treats an absent attribute or "0" as not set', () => {
		const points = [presPoint('p1', 'node1', 'node'), presPoint('p2', 'node1', 'node', '0')];
		const connections: PptxSmartArtConnection[] = [
			{ sourceId: 'n1', destId: 'p1', type: 'presOf' },
			{ sourceId: 'n2', destId: 'p2', type: 'presOf' },
		];
		const off = resolveSmartArtNodeCoherent3DOff(points, connections, localName);
		expect(off.has('n1')).toBeFalsy();
		expect(off.has('n2')).toBeFalsy();
	});

	it('returns an empty set when there are no pres points', () => {
		expect(resolveSmartArtNodeCoherent3DOff([], [], localName).size).toBe(0);
	});
});
