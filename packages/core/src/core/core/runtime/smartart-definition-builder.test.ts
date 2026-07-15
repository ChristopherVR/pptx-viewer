import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import {
	applySmartArtColorStyleLabels,
	applySmartArtDefinitionMetadata,
} from './smartart-definition-builder';
import { applySmartArtQuickStyle } from './smartart-quick-style-builder';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const localName = (key: string) => key.split(':').at(-1)!;

describe('diagramML definition metadata merge', () => {
	it('edits CT_StyleDefinition metadata and preserves complex and unknown payloads', () => {
		const parsed = parser.parse(`<q:styleDef xmlns:q="urn:dgm" uniqueId="old">
			<q:title val="Old"/><q:styleLbl name="oldLabel"><q:scene3d/><q:sp3d/>
				<q:style><a:fillRef xmlns:a="urn:a" idx="1"/></q:style><q:future value="keep"/>
			</q:styleLbl><q:extLst><q:ext uri="keep"/></q:extLst></q:styleDef>`) as XmlObject;
		const root = parsed['q:styleDef'] as XmlObject;
		expect(
			applySmartArtQuickStyle(
				root,
				{
					name: 'legacy',
					uniqueId: 'new',
					minimumVersion: '16',
					titles: [{ value: 'Edited', language: 'en-US' }],
					labels: [{ name: 'editedLabel' }],
				},
				localName,
			),
		).toBeTruthy();
		const xml = builder.build(parsed);
		expect(xml).toContain('uniqueId="new"');
		expect(xml).toContain('<q:title val="Edited" lang="en-US"');
		expect(xml).toContain('name="editedLabel"');
		expect(xml).toContain('<q:scene3d');
		expect(xml).toContain('<q:sp3d');
		expect(xml).toContain('<a:fillRef');
		expect(xml).toContain('<q:future value="keep"');
		expect(xml).toContain('uri="keep"');
	});

	it('edits CT_Colors attributes while preserving color choices and extensions', () => {
		const parsed = parser.parse(`<d:colorsDef xmlns:d="urn:dgm" xmlns:a="urn:a">
			<d:styleLbl name="n"><d:fillClrLst meth="span"><a:schemeClr val="accent1"/>
				<d:unknown/></d:fillClrLst></d:styleLbl><d:extLst/></d:colorsDef>`) as XmlObject;
		const root = parsed['d:colorsDef'] as XmlObject;
		applySmartArtDefinitionMetadata(root, { descriptions: [{ value: 'Colors' }] }, localName);
		applySmartArtColorStyleLabels(
			root,
			[
				{
					name: 'node',
					fill: { method: 'cycle', hueDirection: 'ccw' },
				},
			],
			localName,
		);
		const xml = builder.build(parsed);
		expect(xml).toContain('<d:desc val="Colors"');
		expect(xml).toContain('name="node"');
		expect(xml).toContain('meth="cycle"');
		expect(xml).toContain('hueDir="ccw"');
		expect(xml).toContain('<a:schemeClr val="accent1"');
		expect(xml).toContain('<d:unknown');
		expect(xml).toContain('<d:extLst');
	});
});
