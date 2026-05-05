import { describe, it, expect } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { extractColorChoiceXml, serializeColorChoice } from '../../utils/color-xml-preservation';
import { PptxColorTransformCodec } from '../builders/PptxColorTransformCodec';

/**
 * Round-trip preservation tests for solid fills.
 *
 * Strategy: parse a colour choice XML through the *real* color codec, then
 * call the same {@link serializeColorChoice} helper used by all four save
 * paths (shape solidFill, stroke, run rPr, table cell). Re-parse the
 * resulting XML and verify the structure round-trips byte-for-byte.
 */
describe('color XML round-trip preservation', () => {
	function makeCodec(themeMap: Record<string, string>): PptxColorTransformCodec {
		return new PptxColorTransformCodec({
			resolveThemeColor: (key) => themeMap[key.toLowerCase()],
		});
	}

	it('round-trips a:schemeClr with lumMod/lumOff transforms', () => {
		const themeMap: Record<string, string> = {
			accent1: '#0070C0',
		};
		const codec = makeCodec(themeMap);

		// Original XML node as it would appear inside <a:solidFill>
		const originalSolidFill: XmlObject = {
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:lumMod': { '@_val': '75000' },
				'a:lumOff': { '@_val': '25000' },
			},
		};

		// Parser stash phase
		const fillColorXml = extractColorChoiceXml(originalSolidFill);
		expect(fillColorXml).toBeDefined();
		const resolvedHex = codec.parseColor(originalSolidFill);
		expect(resolvedHex).toBeTruthy();

		// Save phase: user did NOT edit the colour, so in-memory hex matches.
		const reEmitted = serializeColorChoice(fillColorXml, resolvedHex, resolvedHex || '#000000');

		// Re-parsing the emitted node back through the codec must produce the
		// same hex (theme map unchanged).
		const reResolved = codec.parseColor(reEmitted);
		expect(reResolved).toBe(resolvedHex);

		// And the XML structure should round-trip byte-for-byte (verbatim re-emit).
		expect(reEmitted).toStrictEqual({
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:lumMod': { '@_val': '75000' },
				'a:lumOff': { '@_val': '25000' },
			},
		});
	});

	it('preserves a:sysClr identity when unchanged', () => {
		const codec = makeCodec({});
		const originalSolidFill: XmlObject = {
			'a:sysClr': { '@_val': 'windowText', '@_lastClr': '000000' },
		};

		const fillColorXml = extractColorChoiceXml(originalSolidFill);
		const resolvedHex = codec.parseColor(originalSolidFill);
		expect(resolvedHex).toBe('#000000');

		const reEmitted = serializeColorChoice(fillColorXml, resolvedHex, resolvedHex || '#000000');
		expect(reEmitted).toStrictEqual({
			'a:sysClr': { '@_val': 'windowText', '@_lastClr': '000000' },
		});
	});

	it('preserves a:prstClr identity when unchanged', () => {
		const codec = makeCodec({});
		const originalSolidFill: XmlObject = {
			'a:prstClr': { '@_val': 'red' },
		};

		const fillColorXml = extractColorChoiceXml(originalSolidFill);
		const resolvedHex = codec.parseColor(originalSolidFill);
		expect(resolvedHex).toBeTruthy();

		const reEmitted = serializeColorChoice(fillColorXml, resolvedHex, resolvedHex || '#000000');
		expect(reEmitted).toStrictEqual({ 'a:prstClr': { '@_val': 'red' } });
	});

	it('drops scheme identity and emits canonical srgb when user edits the colour', () => {
		const codec = makeCodec({ accent1: '#0070C0' });
		const originalSolidFill: XmlObject = {
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:lumMod': { '@_val': '75000' },
			},
		};

		const fillColorXml = extractColorChoiceXml(originalSolidFill);
		const resolvedOriginalHex = codec.parseColor(originalSolidFill);
		expect(resolvedOriginalHex).toBeTruthy();

		// User picked a brand-new hex from the picker.
		const userEditedHex = '#FF6600';

		const reEmitted = serializeColorChoice(fillColorXml, resolvedOriginalHex, userEditedHex);

		// Should emit canonical srgb — the user's edit takes precedence.
		expect(reEmitted).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF6600' } });

		// And re-parsing yields the user's hex.
		expect(codec.parseColor(reEmitted)).toBe('#FF6600');
	});

	it('round-trip via ShapeStyle: stash → save → re-parse', () => {
		const codec = makeCodec({ accent2: '#ED7D31' });

		// Phase 1 — parse: stash the original XML on the in-memory style.
		const originalSpPrSolidFill: XmlObject = {
			'a:schemeClr': {
				'@_val': 'accent2',
				'a:tint': { '@_val': '60000' },
			},
		};
		const fillColorXml = extractColorChoiceXml(originalSpPrSolidFill);
		const fillColor = codec.parseColor(originalSpPrSolidFill);
		const style: ShapeStyle = {
			fillMode: 'solid',
			fillColor,
			fillColorXml,
		};

		// Phase 2 — save: the writer uses the helper.
		expect(style.fillColor).toBeTruthy();
		const resolvedOriginal = style.fillColorXml ? codec.parseColor(style.fillColorXml) : undefined;
		const emitted = serializeColorChoice(
			style.fillColorXml,
			resolvedOriginal,
			style.fillColor as string,
		);

		// Phase 3 — re-parse the emitted XML and confirm structural equality.
		expect(emitted).toStrictEqual({
			'a:schemeClr': {
				'@_val': 'accent2',
				'a:tint': { '@_val': '60000' },
			},
		});
		expect(codec.parseColor(emitted)).toBe(fillColor);
	});
});
