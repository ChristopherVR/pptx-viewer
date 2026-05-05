import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import {
	buildSrgbColorChoice,
	colorsEqual,
	extractColorChoiceXml,
	serializeColorChoice,
} from './color-xml-preservation';

describe('extractColorChoiceXml', () => {
	it('returns undefined when parent is undefined', () => {
		expect(extractColorChoiceXml(undefined)).toBeUndefined();
	});

	it('returns undefined when parent has no colour child', () => {
		expect(extractColorChoiceXml({ '@_other': 'x' } as XmlObject)).toBeUndefined();
	});

	it('extracts a:srgbClr', () => {
		const parent: XmlObject = { 'a:srgbClr': { '@_val': 'FF0000' } };
		expect(extractColorChoiceXml(parent)).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF0000' } });
	});

	it('extracts a:schemeClr with transforms', () => {
		const scheme: XmlObject = {
			'@_val': 'accent1',
			'a:lumMod': { '@_val': '75000' },
			'a:lumOff': { '@_val': '25000' },
		};
		const parent: XmlObject = { 'a:schemeClr': scheme };
		const result = extractColorChoiceXml(parent);
		expect(result).toStrictEqual({ 'a:schemeClr': scheme });
		// reference identity preserved (verbatim re-emit)
		expect(result?.['a:schemeClr']).toBe(scheme);
	});

	it('extracts a:sysClr / a:prstClr / a:scrgbClr / a:hslClr', () => {
		expect(extractColorChoiceXml({ 'a:sysClr': { '@_val': 'windowText' } })).toStrictEqual({
			'a:sysClr': { '@_val': 'windowText' },
		});
		expect(extractColorChoiceXml({ 'a:prstClr': { '@_val': 'red' } })).toStrictEqual({
			'a:prstClr': { '@_val': 'red' },
		});
		expect(
			extractColorChoiceXml({ 'a:scrgbClr': { '@_r': '50000', '@_g': '50000', '@_b': '50000' } }),
		).toStrictEqual({ 'a:scrgbClr': { '@_r': '50000', '@_g': '50000', '@_b': '50000' } });
		expect(
			extractColorChoiceXml({ 'a:hslClr': { '@_hue': '0', '@_sat': '0', '@_lum': '50000' } }),
		).toStrictEqual({ 'a:hslClr': { '@_hue': '0', '@_sat': '0', '@_lum': '50000' } });
	});
});

describe('colorsEqual', () => {
	it('treats equal hex strings as equal', () => {
		expect(colorsEqual('#FF0000', 'FF0000')).toBeTruthy();
		expect(colorsEqual('#ff0000', '#FF0000')).toBeTruthy();
		expect(colorsEqual('FF0000', 'ff0000')).toBeTruthy();
	});

	it('returns false for different hex', () => {
		expect(colorsEqual('#FF0000', '#FE0000')).toBeFalsy();
	});

	it('returns false for undefined inputs', () => {
		expect(colorsEqual(undefined, '#FF0000')).toBeFalsy();
		expect(colorsEqual('#FF0000', undefined)).toBeFalsy();
		expect(colorsEqual(undefined, undefined)).toBeFalsy();
	});

	it('treats equal non-hex strings as equal (literal compare)', () => {
		expect(colorsEqual('transparent', 'transparent')).toBeTruthy();
	});
});

describe('buildSrgbColorChoice', () => {
	it('strips leading # from hex', () => {
		expect(buildSrgbColorChoice('#A1B2C3')).toStrictEqual({
			'a:srgbClr': { '@_val': 'A1B2C3' },
		});
	});

	it('omits alpha when opacity is full or undefined', () => {
		expect(buildSrgbColorChoice('AABBCC', 1)).toStrictEqual({
			'a:srgbClr': { '@_val': 'AABBCC' },
		});
		expect(buildSrgbColorChoice('AABBCC')).toStrictEqual({
			'a:srgbClr': { '@_val': 'AABBCC' },
		});
	});

	it('emits a:alpha when opacity < 1', () => {
		const result = buildSrgbColorChoice('AABBCC', 0.5);
		expect(result).toStrictEqual({
			'a:srgbClr': {
				'@_val': 'AABBCC',
				'a:alpha': { '@_val': '50000' },
			},
		});
	});
});

describe('serializeColorChoice', () => {
	const originalSchemeClr: XmlObject = {
		'a:schemeClr': {
			'@_val': 'accent1',
			'a:lumMod': { '@_val': '75000' },
		},
	};

	it('re-emits original verbatim when resolved hex matches', () => {
		const result = serializeColorChoice(originalSchemeClr, '#0070C0', '#0070C0');
		expect(result).toBe(originalSchemeClr);
	});

	it('falls back to canonical srgb when colours differ', () => {
		const result = serializeColorChoice(originalSchemeClr, '#0070C0', '#FF0000');
		expect(result).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF0000' } });
	});

	it('falls back to canonical srgb when no original is present', () => {
		const result = serializeColorChoice(undefined, undefined, '#112233');
		expect(result).toStrictEqual({ 'a:srgbClr': { '@_val': '112233' } });
	});

	it('falls back to canonical srgb when resolved is undefined', () => {
		const result = serializeColorChoice(originalSchemeClr, undefined, '#0070C0');
		expect(result).toStrictEqual({ 'a:srgbClr': { '@_val': '0070C0' } });
	});

	it('applies alpha on the canonical fallback', () => {
		const result = serializeColorChoice(undefined, undefined, '#112233', 0.25);
		expect(result).toStrictEqual({
			'a:srgbClr': {
				'@_val': '112233',
				'a:alpha': { '@_val': '25000' },
			},
		});
	});

	it('round-trips: parse a:schemeClr → save → re-parse yields same XML', () => {
		// Mock the codec by mapping accent1 to a fixed hex; the tint transform
		// shifts the resolved colour by some amount.
		const schemeClrParent: XmlObject = {
			'a:schemeClr': {
				'@_val': 'accent2',
				'a:tint': { '@_val': '60000' },
				'a:satMod': { '@_val': '100000' },
			},
		};
		const original = extractColorChoiceXml(schemeClrParent);
		expect(original).toBeDefined();

		// Imagine the codec resolves this scheme+transforms to "#A1B2C3"
		const resolvedHex = '#A1B2C3';
		const inMemoryHex = '#A1B2C3'; // user did NOT edit

		const emitted = serializeColorChoice(original, resolvedHex, inMemoryHex);
		// Should re-emit the original schemeClr verbatim — including transforms.
		expect(emitted).toStrictEqual({
			'a:schemeClr': {
				'@_val': 'accent2',
				'a:tint': { '@_val': '60000' },
				'a:satMod': { '@_val': '100000' },
			},
		});

		// Re-parsing the emitted XML should yield the same structure.
		const reparsed = extractColorChoiceXml(emitted);
		expect(reparsed).toStrictEqual(emitted);
	});

	it('round-trips: user edit drops the schemeClr, emits srgb', () => {
		const schemeClrParent: XmlObject = {
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:lumMod': { '@_val': '75000' },
			},
		};
		const original = extractColorChoiceXml(schemeClrParent);
		const resolvedHex = '#0070C0'; // codec resolves accent1 → this hex
		const inMemoryHex = '#FF0000'; // user changed it

		const emitted = serializeColorChoice(original, resolvedHex, inMemoryHex);
		// User edited the colour — preserve the edit, emit canonical srgb.
		expect(emitted).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF0000' } });
	});
});
