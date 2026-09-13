import { describe, expect, it } from 'vitest';

import type { PptxElement, PptxElementAnimation } from '../types';
import { remapEditorAnimationsToShapeIds } from './animation-shape-id-assign';
import { applyConnectorShapeIds, resolveConnectorShapeIds } from './connector-shape-id-assign';

function el(id: string, shapeId?: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeId,
	} as PptxElement;
}

describe('remapEditorAnimationsToShapeIds', () => {
	it('remaps elementId to an existing element.shapeId (real-file element)', () => {
		const elements = [el('slide1-shape-0', '2'), el('slide1-shape-1', '3')];
		const anims: PptxElementAnimation[] = [{ elementId: 'slide1-shape-1', entrance: 'fadeIn' }];
		const out = remapEditorAnimationsToShapeIds(elements, anims);
		expect(out[0].elementId).toBe('3');
		// Original array is not mutated.
		expect(anims[0].elementId).toBe('slide1-shape-1');
	});

	it('mints a fresh shapeId for an SDK element that has none, and stamps it', () => {
		const target = el('sdk-el', undefined);
		const elements = [el('other', '2'), target];
		const anims: PptxElementAnimation[] = [{ elementId: 'sdk-el', entrance: 'fadeIn' }];
		const out = remapEditorAnimationsToShapeIds(elements, anims);
		// Minted above the max existing shapeId (2).
		expect(out[0].elementId).toBe('3');
		expect(target.shapeId).toBe('3');
	});

	it('mints above the reserved id floor to avoid the spTree root collision', () => {
		const target = el('sdk-el', undefined);
		const anims: PptxElementAnimation[] = [{ elementId: 'sdk-el' }];
		// reservedMaxId 1 models the implicit <p:spTree> group cNvPr id.
		const out = remapEditorAnimationsToShapeIds([target], anims, 1);
		expect(out[0].elementId).toBe('2');
		expect(target.shapeId).toBe('2');
	});

	it('remaps a triggerShapeId reference', () => {
		const elements = [el('trigger-el', '4'), el('target-el', '5')];
		const anims: PptxElementAnimation[] = [
			{ elementId: 'target-el', triggerShapeId: 'trigger-el', trigger: 'onShapeClick' },
		];
		const out = remapEditorAnimationsToShapeIds(elements, anims);
		expect(out[0].elementId).toBe('5');
		expect(out[0].triggerShapeId).toBe('4');
	});

	it('leaves an unresolvable elementId untouched', () => {
		const elements = [el('slide1-shape-0', '2')];
		const anims: PptxElementAnimation[] = [{ elementId: 'does-not-exist', entrance: 'fadeIn' }];
		const out = remapEditorAnimationsToShapeIds(elements, anims);
		expect(out[0].elementId).toBe('does-not-exist');
	});

	it('resolves an element nested inside a group', () => {
		const child = el('group-child', '6');
		const group: PptxElement = {
			type: 'group',
			id: 'group-0',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			children: [child],
		} as PptxElement;
		const anims: PptxElementAnimation[] = [{ elementId: 'group-child', entrance: 'fadeIn' }];
		const out = remapEditorAnimationsToShapeIds([group], anims);
		expect(out[0].elementId).toBe('6');
	});
});

describe('connector native shape IDs', () => {
	it('shares the native ID space with animation targets and leaves unknown references intact', () => {
		const target = el('target');
		const animated = el('animated');
		const connector: PptxElement = {
			type: 'connector',
			id: 'connector',
			x: 0,
			y: 0,
			width: 10,
			height: 0,
			shapeStyle: {
				connectorStartConnection: { shapeId: 'target', connectionSiteIndex: 2 },
				connectorEndConnection: { shapeId: 'foreign', connectionSiteIndex: 3 },
			},
		};
		const elements = [connector, target, animated];
		const animation = remapEditorAnimationsToShapeIds(elements, [{ elementId: 'animated' }], 8);
		const ids = resolveConnectorShapeIds(elements, 8);
		expect(animation[0].elementId).toBe('9');
		expect(ids.get('target')).toBe('11');
		expect(ids.has('foreign')).toBeFalsy();
		expect(connector.shapeStyle?.connectorStartConnection?.shapeId).toBe('target');
		expect(resolveConnectorShapeIds(elements, 8)).toStrictEqual(ids);
		expect(
			resolveConnectorShapeIds([el('target'), { ...connector, shapeId: undefined }], 1).get(
				'target',
			),
		).toBe('2');
	});

	it('preserves opaque XML and unrepresented endpoint data while updating represented bindings', () => {
		const shape = {
			'p:nvCxnSpPr': {
				'p:cNvCxnSpPr': {
					'a:cxnSpLocks': { '@_noMove': '1' },
					'a:stCxn': { '@_id': '2', '@_idx': '0', '@_extension': 'keep' },
					'a:endCxn': { '@_unrepresented': 'keep' },
				},
			},
		};
		const connector: PptxElement = { type: 'connector', id: 'c', x: 0, y: 0, width: 10, height: 0 };
		const original = structuredClone(shape);
		applyConnectorShapeIds(shape, connector, new Map());
		expect(shape).toStrictEqual(original);
		connector.shapeStyle = {
			connectorStartConnection: { shapeId: 'target', connectionSiteIndex: 3 },
		};
		applyConnectorShapeIds(shape, connector, new Map([['target', '12']]));
		expect(shape['p:nvCxnSpPr']['p:cNvCxnSpPr']).toStrictEqual({
			...original['p:nvCxnSpPr']['p:cNvCxnSpPr'],
			'a:stCxn': { '@_id': '12', '@_idx': '3', '@_extension': 'keep' },
		});
	});

	it('does not write unresolved runtime IDs and inserts new endpoints before extensions', () => {
		const shape = {
			'p:nvCxnSpPr': {
				'p:cNvCxnSpPr': {
					'a:cxnSpLocks': { '@_noMove': '1' },
					'a:endCxn': { '@_id': '7', '@_idx': '0' },
					'a:extLst': { 'a:ext': { '@_uri': 'retained' } },
				},
			},
		};
		const connector: PptxElement = {
			type: 'connector',
			id: 'c',
			x: 0,
			y: 0,
			width: 10,
			height: 0,
			rawXml: structuredClone(shape),
			shapeStyle: {
				connectorStartConnection: { shapeId: 'target', connectionSiteIndex: 3 },
				connectorEndConnection: { shapeId: 'unresolved', connectionSiteIndex: 2 },
			},
		};
		applyConnectorShapeIds(shape, connector, new Map([['target', '12']]));
		expect(shape['p:nvCxnSpPr']['p:cNvCxnSpPr']['a:endCxn']).toStrictEqual({
			'@_id': '7',
			'@_idx': '0',
		});
		expect(Object.keys(shape['p:nvCxnSpPr']['p:cNvCxnSpPr'])).toStrictEqual([
			'a:cxnSpLocks',
			'a:stCxn',
			'a:endCxn',
			'a:extLst',
		]);
		delete connector.rawXml;
		applyConnectorShapeIds(shape, connector, new Map([['target', '12']]));
		expect(shape['p:nvCxnSpPr']['p:cNvCxnSpPr']).not.toHaveProperty('a:endCxn');
	});
});
