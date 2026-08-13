import { describe, it, expect } from 'vitest';

import { findGroupXmlOffset } from './group-child-order';

/** Minimal, schema-shaped slide part with two sibling groups and a nested one. */
const SLIDE_XML = [
	'<p:sld><p:cSld><p:spTree>',
	'<p:nvGrpSpPr><p:cNvPr id="1" name="Shape Tree"/></p:nvGrpSpPr>',
	'<p:sp><p:nvSpPr><p:cNvPr id="2" name="Rect A"/></p:nvSpPr></p:sp>',
	'<p:grpSp><p:nvGrpSpPr><p:cNvPr id="3" name="Outer"/></p:nvGrpSpPr>',
	'<p:sp><p:nvSpPr><p:cNvPr id="4" name="Inner Rect"/></p:nvSpPr></p:sp>',
	'<p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Nested"/></p:nvGrpSpPr>',
	'<p:sp><p:nvSpPr><p:cNvPr id="6" name="Deep Rect"/></p:nvSpPr></p:sp>',
	'</p:grpSp>',
	'</p:grpSp>',
	'<p:grpSp><p:nvGrpSpPr><p:cNvPr id="7" name="Sibling"/></p:nvGrpSpPr>',
	'<p:sp><p:nvSpPr><p:cNvPr id="8" name="Other Rect"/></p:nvSpPr></p:sp>',
	'</p:grpSp>',
	'</p:spTree></p:cSld></p:sld>',
].join('');

/** Read the `name` of the group starting at `offset`, as a readable assertion. */
function nameAt(xml: string, offset: number | undefined): string | undefined {
	if (offset === undefined) {
		return undefined;
	}
	return /<p:cNvPr[^>]*name="([^"]*)"/.exec(xml.slice(offset))?.[1];
}

describe('findGroupXmlOffset', () => {
	it('finds the first group by its own cNvPr id', () => {
		expect(nameAt(SLIDE_XML, findGroupXmlOffset(SLIDE_XML, '3'))).toBe('Outer');
	});

	it('finds a group that is NOT the first occurrence', () => {
		// The whole point: `scanDirectChildElements` only ever starts at the
		// first `p:grpSp`, which is why group parsing could not use it.
		expect(nameAt(SLIDE_XML, findGroupXmlOffset(SLIDE_XML, '7'))).toBe('Sibling');
	});

	it('finds a NESTED group', () => {
		expect(nameAt(SLIDE_XML, findGroupXmlOffset(SLIDE_XML, '5'))).toBe('Nested');
	});

	it('returns an offset that points at the group open tag', () => {
		const offset = findGroupXmlOffset(SLIDE_XML, '5');
		expect(SLIDE_XML.slice(offset)).toMatch(/^<p:grpSp[\s>]/);
	});

	it('returns undefined for an id that is not a group', () => {
		// id 4 is a `p:sp`, not a `p:grpSp`.
		expect(findGroupXmlOffset(SLIDE_XML, '4')).toBeUndefined();
		expect(findGroupXmlOffset(SLIDE_XML, '999')).toBeUndefined();
	});

	it('returns undefined for an empty id rather than matching the first group', () => {
		expect(findGroupXmlOffset(SLIDE_XML, '')).toBeUndefined();
	});

	it('does not match the shape-tree cNvPr id', () => {
		// `p:spTree` also opens with `p:nvGrpSpPr`, but it is not a `p:grpSp`.
		expect(findGroupXmlOffset(SLIDE_XML, '1')).toBeUndefined();
	});

	it('tolerates a self-closing group and attributes on the open tag', () => {
		const xml =
			'<p:grpSp bwMode="auto"><p:nvGrpSpPr><p:cNvPr id="9" name="Attr"/></p:nvGrpSpPr></p:grpSp>';
		expect(nameAt(xml, findGroupXmlOffset(xml, '9'))).toBe('Attr');
	});
});
