import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { applySmartArtColorTransform } from './smartart-colors-builder';

/** Strip namespace prefix from an XML key (e.g. `dgm:styleLbl` -> `styleLbl`). */
function localName(key: string): string {
	const idx = key.indexOf(':');
	return idx >= 0 ? key.slice(idx + 1) : key;
}

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
	processEntities: false,
});
const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	format: false,
});

/**
 * A realistic colorsDef as PowerPoint emits it: a title + two style labels,
 * each with a fillClrLst and linClrLst, plus an ext list that must survive.
 */
const SAMPLE_COLORS = `<dgm:colorsDef xmlns:dgm="urn:dgm" xmlns:a="urn:a" uniqueId="urn:colors/x" title="Original">
  <dgm:styleLbl name="node0">
    <dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"/></dgm:fillClrLst>
    <dgm:linClrLst meth="repeat"><a:schemeClr val="accent1"><a:shade val="60000"/></a:schemeClr></dgm:linClrLst>
    <dgm:effectClrLst/>
  </dgm:styleLbl>
  <dgm:styleLbl name="node1">
    <dgm:fillClrLst meth="repeat"><a:srgbClr val="AABBCC"/></dgm:fillClrLst>
    <dgm:linClrLst meth="repeat"><a:srgbClr val="112233"/></dgm:linClrLst>
  </dgm:styleLbl>
  <dgm:extLst><a:ext uri="{guid}"/></dgm:extLst>
</dgm:colorsDef>`;

function parseColorsDef(): XmlObject {
	const parsed = parser.parse(SAMPLE_COLORS) as XmlObject;
	return parsed['dgm:colorsDef'] as XmlObject;
}

function labelAt(def: XmlObject, index: number): XmlObject {
	const labels = def['dgm:styleLbl'] as XmlObject[];
	return labels[index];
}

function fillVal(label: XmlObject): string | undefined {
	const list = label['dgm:fillClrLst'] as XmlObject;
	const srgb = list['a:srgbClr'] as XmlObject | undefined;
	return srgb ? String(srgb['@_val']) : undefined;
}

function lineVal(label: XmlObject): string | undefined {
	const list = label['dgm:linClrLst'] as XmlObject;
	const srgb = list['a:srgbClr'] as XmlObject | undefined;
	return srgb ? String(srgb['@_val']) : undefined;
}

describe('applySmartArtColorTransform', () => {
	it('is a no-op for undefined transform', () => {
		const def = parseColorsDef();
		expect(applySmartArtColorTransform(def, undefined, localName)).toBeFalsy();
	});

	it('does not write a @_title attribute (title is a CT_ColorTransform child element, not an attribute)', () => {
		const def = parseColorsDef();
		const changed = applySmartArtColorTransform(
			def,
			{ name: 'Colorful Accent', fillColors: [], lineColors: [] },
			localName,
		);
		expect(changed).toBeFalsy();
		expect(def['@_title']).toBe('Original');
	});

	it('does not report change when there are no colours to merge', () => {
		const def = parseColorsDef();
		const changed = applySmartArtColorTransform(
			def,
			{ name: 'Original', fillColors: [], lineColors: [] },
			localName,
		);
		expect(changed).toBeFalsy();
	});

	it('overwrites fill colours per ordered styleLbl', () => {
		const def = parseColorsDef();
		applySmartArtColorTransform(
			def,
			{ fillColors: ['#FF0000', '#00FF00'], lineColors: [] },
			localName,
		);
		expect(fillVal(labelAt(def, 0))).toBe('FF0000');
		expect(fillVal(labelAt(def, 1))).toBe('00FF00');
	});

	it('overwrites a scheme colour in place with an srgbClr', () => {
		const def = parseColorsDef();
		// label 0 fill is a schemeClr; it should be replaced by srgbClr.
		applySmartArtColorTransform(def, { fillColors: ['#123456'], lineColors: [] }, localName);
		const list = labelAt(def, 0)['dgm:fillClrLst'] as XmlObject;
		expect(list['a:schemeClr']).toBeUndefined();
		expect((list['a:srgbClr'] as XmlObject)['@_val']).toBe('123456');
	});

	it('overwrites line colours per ordered styleLbl', () => {
		const def = parseColorsDef();
		applySmartArtColorTransform(
			def,
			{ fillColors: [], lineColors: ['#0A0B0C', '#0D0E0F'] },
			localName,
		);
		expect(lineVal(labelAt(def, 0))).toBe('0A0B0C');
		expect(lineVal(labelAt(def, 1))).toBe('0D0E0F');
	});

	it('preserves the styleLbl @_name and the ext list', () => {
		const def = parseColorsDef();
		applySmartArtColorTransform(
			def,
			{ name: 'New', fillColors: ['#FF0000'], lineColors: ['#00FF00'] },
			localName,
		);
		expect(labelAt(def, 0)['@_name']).toBe('node0');
		expect(def['dgm:extLst']).toBeDefined();
		// effectClrLst on label 0 left untouched.
		expect(labelAt(def, 0)['dgm:effectClrLst']).toBeDefined();
	});

	it('leaves a list untouched when no colour is supplied at its index', () => {
		const def = parseColorsDef();
		// Only one fill colour supplied; label 1 fill should be unchanged.
		applySmartArtColorTransform(def, { fillColors: ['#FF0000'], lineColors: [] }, localName);
		expect(fillVal(labelAt(def, 1))).toBe('AABBCC');
	});

	it('round-trips through build -> parse preserving structure', () => {
		const def = parseColorsDef();
		applySmartArtColorTransform(
			def,
			{ name: 'RT', fillColors: ['#FF0000', '#00FF00'], lineColors: ['#0000FF', '#FFFF00'] },
			localName,
		);
		const xml = builder.build({ 'dgm:colorsDef': def });
		const reparsed = parser.parse(xml) as XmlObject;
		const rt = reparsed['dgm:colorsDef'] as XmlObject;
		expect(rt['@_title']).toBe('Original');
		expect(fillVal(labelAt(rt, 0))).toBe('FF0000');
		expect(lineVal(labelAt(rt, 1))).toBe('FFFF00');
		expect(rt['dgm:extLst']).toBeDefined();
	});
});
