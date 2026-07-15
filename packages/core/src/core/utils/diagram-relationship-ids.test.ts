import { describe, expect, it } from 'vitest';

import type { PptxSmartArtData, XmlObject } from '../types';
import {
	applyDiagramRelationshipIds,
	parseDiagramRelationshipIds,
} from './diagram-relationship-ids';

describe('diagramML CT_RelIds', () => {
	it('parses Transitional relationship ids', () => {
		expect(
			parseDiagramRelationshipIds({
				'dgm:relIds': {
					'@_r:dm': 'rId1',
					'@_r:lo': 'rId2',
					'@_r:qs': 'rId3',
					'@_r:cs': 'rId4',
				},
			}),
		).toStrictEqual({
			dataRelId: 'rId1',
			layoutRelId: 'rId2',
			styleRelId: 'rId3',
			colorsRelId: 'rId4',
		});
	});

	it('parses Strict markup with arbitrary namespace prefixes', () => {
		expect(
			parseDiagramRelationshipIds({
				'x:relIds': {
					'@_relationships:dm': 'strictData',
					'@_relationships:lo': 'strictLayout',
					'@_relationships:qs': 'strictStyle',
					'@_relationships:cs': 'strictColors',
					'@_xmlns:x': 'http://purl.oclc.org/ooxml/drawingml/diagram',
					'@_xmlns:relationships': 'http://purl.oclc.org/ooxml/officeDocument/relationships',
				},
			}),
		).toMatchObject({
			dataRelId: 'strictData',
			layoutRelId: 'strictLayout',
			styleRelId: 'strictStyle',
			colorsRelId: 'strictColors',
		});
	});

	it('updates typed ids while preserving unknown and extension markup', () => {
		const relIds: XmlObject = {
			'@_relationships:dm': 'oldData',
			'@_relationships:lo': 'keepLayout',
			'@_future:token': 'preserve-me',
			'x:extLst': { 'x:ext': { '@_uri': 'keep-extension' } },
		};
		const frame: XmlObject = {
			'p:graphic': { 'a:graphicData': { 'dgm:relIds': relIds } },
		};

		applyDiagramRelationshipIds(frame, {
			dataRelId: 'newData',
			colorsRelId: 'newColors',
		} as PptxSmartArtData);

		expect(relIds).toStrictEqual({
			'@_relationships:dm': 'newData',
			'@_relationships:lo': 'keepLayout',
			'@_r:cs': 'newColors',
			'@_future:token': 'preserve-me',
			'x:extLst': { 'x:ext': { '@_uri': 'keep-extension' } },
		});
		expect(parseDiagramRelationshipIds({ 'dgm:relIds': relIds })).toMatchObject({
			dataRelId: 'newData',
			layoutRelId: 'keepLayout',
			colorsRelId: 'newColors',
		});
	});

	it('leaves non-SmartArt frames unchanged', () => {
		const frame: XmlObject = { 'p:graphic': { 'a:graphicData': { 'a:tbl': {} } } };
		applyDiagramRelationshipIds(frame, { dataRelId: 'rId1' });
		expect(frame).toStrictEqual({ 'p:graphic': { 'a:graphicData': { 'a:tbl': {} } } });
	});
});
