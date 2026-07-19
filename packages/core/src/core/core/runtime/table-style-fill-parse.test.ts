import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { parseTableStyleSectionFill, parseTableStyleSectionText } from './table-style-fill-parse';

function section(fill: XmlObject): XmlObject {
	return { 'a:tcStyle': { 'a:fill': fill } } as XmlObject;
}

describe('parseTableStyleSectionFill', () => {
	it('returns undefined for a missing section', () => {
		expect(parseTableStyleSectionFill(undefined)).toBeUndefined();
	});

	it('parses a scheme-colour solid fill', () => {
		const fill = parseTableStyleSectionFill(
			section({ 'a:solidFill': { 'a:schemeClr': { '@_val': 'accent1' } } }),
		);
		expect(fill?.schemeColor).toBe('accent1');
		expect(fill?.color).toBeUndefined();
	});

	it('parses an explicit sRGB solid fill (issue #95)', () => {
		const fill = parseTableStyleSectionFill(
			section({ 'a:solidFill': { 'a:srgbClr': { '@_val': 'FF8800' } } }),
		);
		expect(fill?.schemeColor).toBe('');
		expect(fill?.color).toBe('#FF8800');
	});

	it('parses a gradient fill with stops and a linear angle (issue #95)', () => {
		const fill = parseTableStyleSectionFill(
			section({
				'a:gradFill': {
					'a:gsLst': {
						'a:gs': [
							{ '@_pos': '0', 'a:schemeClr': { '@_val': 'accent1' } },
							{ '@_pos': '100000', 'a:srgbClr': { '@_val': '000000' } },
						],
					},
					'a:lin': { '@_ang': '5400000' },
				},
			}),
		);
		expect(fill?.gradient?.type).toBe('linear');
		expect(fill?.gradient?.angle).toBe(90);
		expect(fill?.gradient?.stops.length).toBe(2);
		expect(fill?.gradient?.stops[0].fill.schemeColor).toBe('accent1');
		expect(fill?.gradient?.stops[0].position).toBe(0);
		expect(fill?.gradient?.stops[1].fill.color).toBe('#000000');
		expect(fill?.gradient?.stops[1].position).toBe(100);
	});

	it('parses a radial (path) gradient fill', () => {
		const fill = parseTableStyleSectionFill(
			section({
				'a:gradFill': {
					'a:gsLst': { 'a:gs': { '@_pos': '0', 'a:srgbClr': { '@_val': 'FFFFFF' } } },
					'a:path': { '@_path': 'circle' },
				},
			}),
		);
		expect(fill?.gradient?.type).toBe('radial');
	});

	it('parses a preset pattern fill with foreground/background (issue #95)', () => {
		const fill = parseTableStyleSectionFill(
			section({
				'a:pattFill': {
					'@_prst': 'ltDnDiag',
					'a:fgClr': { 'a:srgbClr': { '@_val': '112233' } },
					'a:bgClr': { 'a:schemeClr': { '@_val': 'bg1' } },
				},
			}),
		);
		expect(fill?.pattern?.preset).toBe('ltDnDiag');
		expect(fill?.pattern?.foreground?.color).toBe('#112233');
		expect(fill?.pattern?.background?.schemeColor).toBe('bg1');
	});

	it('parses a:noFill (issue #95)', () => {
		const fill = parseTableStyleSectionFill(section({ 'a:noFill': {} }));
		expect(fill?.noFill).toBeTruthy();
		expect(fill?.schemeColor).toBe('');
	});

	it('returns undefined for an unresolved a:fillRef style-matrix reference', () => {
		const s = { 'a:tcStyle': { 'a:fillRef': { '@_idx': '1' } } } as XmlObject;
		expect(parseTableStyleSectionFill(s)).toBeUndefined();
	});
});

describe('parseTableStyleSectionText', () => {
	it('returns undefined when no tcTxStyle is present', () => {
		expect(parseTableStyleSectionText({} as XmlObject)).toBeUndefined();
	});

	it('captures underline, typeface, fontRef idx, and sRGB colour (issue #95)', () => {
		const text = parseTableStyleSectionText({
			'a:tcTxStyle': {
				'@_b': 'on',
				'@_u': 'sng',
				'a:font': { '@_typeface': 'Calibri' },
				'a:fontRef': { '@_idx': 'minor', 'a:srgbClr': { '@_val': 'FF0000' } },
			},
		} as XmlObject);
		expect(text?.bold).toBeTruthy();
		expect(text?.underline).toBeTruthy();
		expect(text?.fontFace).toBe('Calibri');
		expect(text?.fontRefIdx).toBe('minor');
		expect(text?.fontColor).toBe('#FF0000');
	});

	it('still resolves a scheme font colour with tint', () => {
		const text = parseTableStyleSectionText({
			'a:tcTxStyle': {
				'@_i': 'on',
				'a:schemeClr': { '@_val': 'accent2', 'a:tint': { '@_val': '40000' } },
			},
		} as XmlObject);
		expect(text?.italic).toBeTruthy();
		expect(text?.fontSchemeColor).toBe('accent2');
		expect(text?.fontTint).toBe(40000);
		expect(text?.fontColor).toBeUndefined();
	});

	it('ignores u="none"', () => {
		const text = parseTableStyleSectionText({
			'a:tcTxStyle': { '@_b': 'on', '@_u': 'none' },
		} as XmlObject);
		expect(text?.underline).toBeUndefined();
	});
});
