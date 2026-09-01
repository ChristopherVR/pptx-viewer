import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { readCommonSlideDataName, writeCommonSlideDataName } from './slide-name';

describe('readCommonSlideDataName', () => {
	it('reads and trims p:cSld/@name', () => {
		expect(readCommonSlideDataName({ 'p:sld': { 'p:cSld': { '@_name': ' Closing ' } } })).toBe(
			'Closing',
		);
	});

	it('returns undefined when the attribute is absent, blank, or the tree is malformed', () => {
		expect(readCommonSlideDataName({ 'p:sld': { 'p:cSld': {} } })).toBeUndefined();
		expect(readCommonSlideDataName({ 'p:sld': { 'p:cSld': { '@_name': '' } } })).toBeUndefined();
		expect(readCommonSlideDataName({ 'p:sld': { 'p:cSld': '' } })).toBeUndefined();
		expect(readCommonSlideDataName({ 'p:sld': '' })).toBeUndefined();
		expect(readCommonSlideDataName(undefined)).toBeUndefined();
	});

	it('stringifies a numeric name the parser may have coerced', () => {
		expect(readCommonSlideDataName({ 'p:sld': { 'p:cSld': { '@_name': 2026 } } })).toBe('2026');
	});
});

describe('writeCommonSlideDataName', () => {
	it('sets a trimmed non-empty name', () => {
		const cSld: XmlObject = { 'p:spTree': {} };
		writeCommonSlideDataName(cSld, '  Q3 Numbers ');
		expect(cSld['@_name']).toBe('Q3 Numbers');
	});

	it('deletes the attribute for an empty name', () => {
		const cSld: XmlObject = { '@_name': 'Old', 'p:spTree': {} };
		writeCommonSlideDataName(cSld, '');
		expect('@_name' in cSld).toBeFalsy();
	});

	it('leaves the attribute untouched when the model carries no name', () => {
		const cSld: XmlObject = { '@_name': 'Kept', 'p:spTree': {} };
		writeCommonSlideDataName(cSld, undefined);
		expect(cSld['@_name']).toBe('Kept');
		expect(() => writeCommonSlideDataName(undefined, 'x')).not.toThrow();
	});
});
