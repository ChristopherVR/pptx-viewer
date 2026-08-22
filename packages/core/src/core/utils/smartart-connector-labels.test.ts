import { describe, expect, it } from 'vitest';

import type { PptxSmartArtConnection, XmlObject } from '../types';
import {
	applySmartArtConnectorLabels,
	collectSmartArtTransitionText,
} from './smartart-connector-labels';

const localName = (key: string): string => key.split(':').pop() ?? key;

function collectText(point: XmlObject): string {
	const t = point['dgm:t'] as XmlObject | undefined;
	const p = t?.['a:p'] as XmlObject | undefined;
	const r = p?.['a:r'] as XmlObject | undefined;
	return String(r?.['a:t'] ?? '');
}

describe('collectSmartArtTransitionText', () => {
	it('reads text from a parTrans point', () => {
		const points: XmlObject[] = [
			{
				'@_modelId': 'pt1',
				'@_type': 'parTrans',
				'dgm:t': { 'a:p': { 'a:r': { 'a:t': 'reports to' } } },
			},
		];
		const map = collectSmartArtTransitionText(points, collectText);
		expect(map.get('pt1')).toBe('reports to');
	});

	it('reads text from a sibTrans point', () => {
		const points: XmlObject[] = [
			{
				'@_modelId': 'pt2',
				'@_type': 'sibTrans',
				'dgm:t': { 'a:p': { 'a:r': { 'a:t': 'peer' } } },
			},
		];
		expect(collectSmartArtTransitionText(points, collectText).get('pt2')).toBe('peer');
	});

	it('ignores a content point (no @_type / type="node")', () => {
		const points: XmlObject[] = [
			{ '@_modelId': 'n1', 'dgm:t': { 'a:p': { 'a:r': { 'a:t': 'Manager' } } } },
		];
		expect(collectSmartArtTransitionText(points, collectText).size).toBe(0);
	});

	it('omits a transition point with only whitespace/empty text', () => {
		const points: XmlObject[] = [
			{ '@_modelId': 'pt1', '@_type': 'parTrans', 'dgm:t': { 'a:p': { 'a:r': { 'a:t': '  ' } } } },
		];
		expect(collectSmartArtTransitionText(points, collectText).size).toBe(0);
	});
});

describe('applySmartArtConnectorLabels', () => {
	it('writes a label onto the linked parTrans point, preserving its other keys', () => {
		const parTransPoint: XmlObject = {
			'@_modelId': 'trans1',
			'@_type': 'parTrans',
			'dgm:prSet': { '@_custom': '1' },
			'dgm:spPr': {},
		};
		const points = [parTransPoint];
		const connections: PptxSmartArtConnection[] = [
			{ sourceId: 'mgr', destId: 'child', parentTransitionId: 'trans1', label: 'reports to' },
		];
		applySmartArtConnectorLabels(points, connections, localName);

		expect(parTransPoint['dgm:prSet']).toStrictEqual({ '@_custom': '1' });
		const t = parTransPoint['dgm:t'] as XmlObject;
		const p = t['a:p'] as XmlObject;
		const r = p['a:r'] as XmlObject;
		expect(r['a:t']).toBe('reports to');
	});

	it('rebuilds only the run text when an existing dgm:t/a:p/a:r chain is present', () => {
		const parTransPoint: XmlObject = {
			'@_modelId': 'trans1',
			'@_type': 'parTrans',
			'dgm:t': {
				'a:bodyPr': {},
				'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'old text' } },
			},
		};
		applySmartArtConnectorLabels(
			[parTransPoint],
			[{ sourceId: 'a', destId: 'b', parentTransitionId: 'trans1', label: 'new text' }],
			localName,
		);
		const t = parTransPoint['dgm:t'] as XmlObject;
		expect(t['a:bodyPr'] as XmlObject).toStrictEqual({});
		const run = (t['a:p'] as XmlObject)['a:r'] as XmlObject;
		expect(run['a:t']).toBe('new text');
		// The run's OWN properties (bold) survive: only the text changed.
		expect(run['a:rPr']).toStrictEqual({ '@_b': '1' });
	});

	it('uses siblingTransitionId when parentTransitionId is absent', () => {
		const sibTransPoint: XmlObject = { '@_modelId': 'sib1', '@_type': 'sibTrans' };
		applySmartArtConnectorLabels(
			[sibTransPoint],
			[{ sourceId: 'a', destId: 'b', siblingTransitionId: 'sib1', label: 'peer note' }],
			localName,
		);
		const t = sibTransPoint['dgm:t'] as XmlObject;
		expect(((t['a:p'] as XmlObject)['a:r'] as XmlObject)['a:t']).toBe('peer note');
	});

	it('does nothing for a connection with no label', () => {
		const point: XmlObject = { '@_modelId': 'trans1', '@_type': 'parTrans' };
		applySmartArtConnectorLabels(
			[point],
			[{ sourceId: 'a', destId: 'b', parentTransitionId: 'trans1' }],
			localName,
		);
		expect(point['dgm:t']).toBeUndefined();
	});

	it('does nothing when the referenced transition point is missing', () => {
		applySmartArtConnectorLabels(
			[],
			[{ sourceId: 'a', destId: 'b', parentTransitionId: 'missing', label: 'x' }],
			localName,
		);
		// No throw is the assertion; nothing to inspect.
		expect(true).toBeTruthy();
	});
});
