import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import {
	applySmartArtConnectionAttributes,
	applySmartArtPointAttributes,
	parseSmartArtConnection,
	validateSmartArtDataModelCore,
} from '../../utils/smartart-data-model-attributes';
import { PptxSmartArtParser } from '../builders/PptxSmartArtParser';
import {
	buildSmartArtConnectionXml,
	mergeSmartArtConnectionXml,
	mergeSmartArtPointXml,
} from './smartart-xml-builders';

describe('diagramML CT_Cxn typed attributes', () => {
	it('parses core identifiers and relationships', () => {
		expect(
			parseSmartArtConnection({
				'@_modelId': '{connection}',
				'@_srcId': '{source}',
				'@_destId': '{destination}',
				'@_type': 'presOf',
				'@_srcOrd': '2',
				'@_destOrd': '3',
				'@_parTransId': '{parent-transition}',
				'@_sibTransId': '{sibling-transition}',
				'@_presId': 'urn:layout',
			}),
		).toStrictEqual({
			modelId: '{connection}',
			sourceId: '{source}',
			destId: '{destination}',
			type: 'presOf',
			srcOrd: 2,
			destOrd: 3,
			parentTransitionId: '{parent-transition}',
			siblingTransitionId: '{sibling-transition}',
			presentationId: 'urn:layout',
		});
	});

	it('rejects a connection missing a required endpoint', () => {
		expect(parseSmartArtConnection({ '@_modelId': 'c', '@_srcId': 'a' })).toBeUndefined();
	});

	it('serializes supplied identifiers and relationships', () => {
		const [connection] = buildSmartArtConnectionXml([
			{
				modelId: '{connection}',
				sourceId: 'a',
				destId: 'b',
				parentTransitionId: '{parent-transition}',
				siblingTransitionId: '{sibling-transition}',
				presentationId: 'urn:layout',
			},
		]);
		expect(connection).toMatchObject({
			'@_modelId': '{connection}',
			'@_srcId': 'a',
			'@_destId': 'b',
			'@_parTransId': '{parent-transition}',
			'@_sibTransId': '{sibling-transition}',
			'@_presId': 'urn:layout',
		});
	});

	it('edits typed attributes while preserving unknown XML and extLst', () => {
		const existing: XmlObject = {
			'@_modelId': '{connection}',
			'@_srcId': 'a',
			'@_destId': 'b',
			'@_parTransId': '{old}',
			'@_vendor': 'keep',
			'dgm:extLst': { 'dgm:ext': { '@_uri': 'vendor' } },
		};
		const [merged] = mergeSmartArtConnectionXml(
			[existing],
			[
				{
					modelId: '{connection}',
					sourceId: 'new-source',
					destId: 'new-destination',
					parentTransitionId: '{new}',
				},
			],
		);
		expect(merged).toMatchObject({
			'@_modelId': '{connection}',
			'@_srcId': 'new-source',
			'@_destId': 'new-destination',
			'@_parTransId': '{new}',
			'@_vendor': 'keep',
		});
		expect(merged['dgm:extLst']).toStrictEqual(existing['dgm:extLst']);
	});

	it('supports explicit removal without deleting unspecified attributes', () => {
		const xml: XmlObject = {
			'@_modelId': '{connection}',
			'@_srcId': 'a',
			'@_destId': 'b',
			'@_parTransId': '{parent}',
			'@_sibTransId': '{sibling}',
		};
		applySmartArtConnectionAttributes(
			xml,
			{
				modelId: undefined,
				sourceId: 'a',
				destId: 'b',
				parentTransitionId: null,
			},
			() => '{generated}',
		);
		expect(xml['@_modelId']).toBe('{connection}');
		expect(xml['@_parTransId']).toBeUndefined();
		expect(xml['@_sibTransId']).toBe('{sibling}');
	});
});

describe('diagramML CT_Pt typed attributes', () => {
	it('applies and removes cxnId without disturbing unknown point content', () => {
		const point: XmlObject = {
			'@_modelId': '{point}',
			'@_cxnId': '{old}',
			'@_vendor': 'keep',
			'dgm:extLst': { 'dgm:ext': { '@_uri': 'vendor' } },
		};
		applySmartArtPointAttributes(point, {
			id: '{point}',
			text: 'Text',
			connectionId: null,
		});
		expect(point['@_cxnId']).toBeUndefined();
		expect(point['@_vendor']).toBe('keep');
		expect(point['dgm:extLst']).toBeDefined();
	});

	it('round-trips cxnId through the surgical point merge', () => {
		const existing: XmlObject = {
			'@_modelId': '{point}',
			'@_cxnId': '{old}',
			'dgm:t': { 'a:p': { 'a:r': { 'a:t': 'Old' } } },
			'dgm:extLst': { 'dgm:ext': { '@_uri': 'vendor' } },
		};
		const [merged] = mergeSmartArtPointXml(
			[existing],
			[{ id: '{point}', text: 'New', connectionId: '{new}' }],
		);
		expect(merged['@_cxnId']).toBe('{new}');
		expect(merged['dgm:extLst']).toStrictEqual(existing['dgm:extLst']);
	});
});

describe('diagramML prefix-independent typed parsing', () => {
	const lookup = {
		getChildByLocalName: (obj: XmlObject | undefined, name: string) => {
			const key = Object.keys(obj ?? {}).find((entry) => entry.split(':').pop() === name);
			return key ? (obj?.[key] as XmlObject) : undefined;
		},
		getChildrenArrayByLocalName: (obj: XmlObject | undefined, name: string) => {
			const child = lookup.getChildByLocalName(obj, name);
			return child ? (Array.isArray(child) ? child : [child]) : [];
		},
	};

	it.each(['dgm', 'strictDiagram', 'producerAlias'])(
		'parses point and connection fields with the %s prefix',
		(prefix) => {
			const model: XmlObject = {
				[`${prefix}:ptLst`]: {
					[`${prefix}:pt`]: {
						'@_modelId': 'point',
						'@_cxnId': 'connection',
						[`${prefix}:t`]: { 'a:p': { 'a:r': { 'a:t': 'Text' } } },
					},
				},
				[`${prefix}:cxnLst`]: {
					[`${prefix}:cxn`]: {
						'@_modelId': 'connection',
						'@_srcId': 'source',
						'@_destId': 'point',
						'@_parTransId': 'transition',
					},
				},
			};
			const parser = new PptxSmartArtParser();
			expect(parser.parseNodes(model, lookup)[0]).toMatchObject({
				id: 'point',
				connectionId: 'connection',
			});
			expect(parser.parseConnections(model, lookup).connections[0]).toMatchObject({
				modelId: 'connection',
				parentTransitionId: 'transition',
			});
		},
	);
});

describe('diagramML data-model validation', () => {
	it('accepts a valid core point and connection graph', () => {
		expect(
			validateSmartArtDataModelCore({
				'x:ptLst': { 'x:pt': [{ '@_modelId': 'a' }, { '@_modelId': 'b' }] },
				'x:cxnLst': { 'x:cxn': { '@_modelId': 'c', '@_srcId': 'a', '@_destId': 'b' } },
			}),
		).toStrictEqual([]);
	});

	it('reports missing, duplicate, and dangling identifiers', () => {
		const issues = validateSmartArtDataModelCore({
			'd:ptLst': {
				'd:pt': [{ '@_modelId': 'a' }, { '@_modelId': 'a' }, {}],
			},
			'd:cxnLst': {
				'd:cxn': [
					{ '@_modelId': 'c', '@_srcId': 'a', '@_destId': 'missing' },
					{ '@_modelId': 'c', '@_srcId': 'missing', '@_destId': 'a' },
					{},
				],
			},
		});
		expect(issues.map((issue) => issue.code)).toStrictEqual(
			expect.arrayContaining([
				'POINT_ID_REQUIRED',
				'POINT_ID_DUPLICATE',
				'CONNECTION_ATTRIBUTE_REQUIRED',
				'CONNECTION_ID_DUPLICATE',
				'CONNECTION_ENDPOINT_MISSING',
			]),
		);
	});
});
