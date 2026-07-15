import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	parseSmartArtColorStyleLabels,
	parseSmartArtDefinitionMetadata,
	parseSmartArtQuickStyleLabels,
	validateSmartArtColorStyleLabels,
	validateSmartArtDefinitionMetadata,
} from './smartart-definition-metadata';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const localName = (key: string) => key.split(':').at(-1)!;

describe('diagramML style and color definition metadata', () => {
	it('parses CT_StyleDefinition without depending on the namespace prefix', () => {
		const xml = parser.parse(`<x:styleDef xmlns:x="urn:dgm" uniqueId="u1" minVer="12">
			<x:title lang="en-AU" val="Modern"/><x:desc val="Description"/>
			<x:catLst><x:cat type="urn:cat" pri="7"/></x:catLst>
			<x:styleLbl name="node0"><x:scene3d/></x:styleLbl></x:styleDef>`) as XmlObject;
		const root = xml['x:styleDef'] as XmlObject;
		expect(parseSmartArtDefinitionMetadata(root, localName)).toStrictEqual({
			uniqueId: 'u1',
			minimumVersion: '12',
			titles: [{ value: 'Modern', language: 'en-AU' }],
			descriptions: [{ value: 'Description', language: undefined }],
			categories: [{ type: 'urn:cat', priority: 7 }],
		});
		expect(parseSmartArtQuickStyleLabels(root, localName)).toStrictEqual([{ name: 'node0' }]);
	});

	it('parses all CT_Colors application metadata on CT_CTStyleLabel', () => {
		const xml = parser.parse(`<z:colorsDef xmlns:z="urn:dgm"><z:styleLbl name="n">
			<z:fillClrLst meth="cycle" hueDir="ccw"/><z:linClrLst meth="repeat"/>
			<z:effectClrLst/><z:txLinClrLst/><z:txFillClrLst/><z:txEffectClrLst/>
		</z:styleLbl></z:colorsDef>`) as XmlObject;
		const root = xml['z:colorsDef'] as XmlObject;
		expect(parseSmartArtColorStyleLabels(root, localName)).toStrictEqual([
			{
				name: 'n',
				fill: { method: 'cycle', hueDirection: 'ccw' },
				line: { method: 'repeat', hueDirection: undefined },
				effect: { method: undefined, hueDirection: undefined },
				textLine: { method: undefined, hueDirection: undefined },
				textFill: { method: undefined, hueDirection: undefined },
				textEffect: { method: undefined, hueDirection: undefined },
			},
		]);
	});

	it('validates required values, unsigned priorities, and CT_Colors enums', () => {
		expect(
			validateSmartArtDefinitionMetadata({
				titles: [{ value: '' }],
				categories: [{ type: '', priority: -1 }],
			}),
		).toHaveLength(3);
		expect(
			validateSmartArtColorStyleLabels([
				{
					name: '',
					fill: { method: 'invalid' as never, hueDirection: 'sideways' as never },
				},
			]),
		).toHaveLength(3);
	});
});
