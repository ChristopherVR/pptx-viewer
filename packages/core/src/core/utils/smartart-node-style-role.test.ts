import { describe, expect, it } from 'vitest';

import type { PptxSmartArtConnection, XmlObject } from '../types';
import { resolveSmartArtNodeStyleRoles } from './smartart-node-style-role';

const localName = (key: string): string => key.split(':').pop() ?? key;

function presPoint(modelId: string, presStyleLbl: string, presName = 'node'): XmlObject {
	return {
		'@_modelId': modelId,
		'@_type': 'pres',
		'dgm:prSet': { '@_presStyleLbl': presStyleLbl, '@_presName': presName },
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
