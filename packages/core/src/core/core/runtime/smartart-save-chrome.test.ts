import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { applySmartArtChrome } from './smartart-save-chrome';

/** Strip namespace prefix from an XML key (e.g. `dgm:bg` -> `bg`). */
function localName(key: string): string {
	const idx = key.indexOf(':');
	return idx >= 0 ? key.slice(idx + 1) : key;
}

describe('applySmartArtChrome', () => {
	it('is a no-op when chrome is undefined', () => {
		const dm: XmlObject = {};
		applySmartArtChrome(dm, undefined, localName);
		expect(dm).toStrictEqual({});
	});

	it('is a no-op when chrome has no fields', () => {
		const dm: XmlObject = {};
		applySmartArtChrome(dm, {}, localName);
		expect(dm).toStrictEqual({});
	});

	it('writes background fill as dgm:bg/a:solidFill/a:srgbClr', () => {
		const dm: XmlObject = {};
		applySmartArtChrome(dm, { backgroundColor: '#F0F0F0' }, localName);
		const bg = dm['dgm:bg'] as XmlObject;
		const fill = bg['a:solidFill'] as XmlObject;
		const clr = fill['a:srgbClr'] as XmlObject;
		expect(clr['@_val']).toBe('F0F0F0');
	});

	it('writes outline colour and width onto dgm:whole/a:ln', () => {
		const dm: XmlObject = {};
		applySmartArtChrome(dm, { outlineColor: '#333333', outlineWidth: 1 }, localName);
		const whole = dm['dgm:whole'] as XmlObject;
		const ln = whole['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe('12700'); // 1pt -> 12700 EMU
		const fill = ln['a:solidFill'] as XmlObject;
		const clr = fill['a:srgbClr'] as XmlObject;
		expect(clr['@_val']).toBe('333333');
	});

	it('preserves existing children on an existing dgm:bg node', () => {
		const dm: XmlObject = {
			'dgm:bg': { 'a:effectLst': { marker: true } },
		};
		applySmartArtChrome(dm, { backgroundColor: '#FFFFFF' }, localName);
		const bg = dm['dgm:bg'] as XmlObject;
		expect(bg['a:effectLst']).toStrictEqual({ marker: true });
		expect((bg['a:solidFill'] as XmlObject)['a:srgbClr']).toStrictEqual({ '@_val': 'FFFFFF' });
	});

	it('reuses existing prefixed keys rather than duplicating', () => {
		const dm: XmlObject = {
			'dgm:whole': { 'a:ln': { '@_cap': 'flat' } },
		};
		applySmartArtChrome(dm, { outlineWidth: 2 }, localName);
		const ln = (dm['dgm:whole'] as XmlObject)['a:ln'] as XmlObject;
		expect(ln['@_cap']).toBe('flat'); // preserved
		expect(ln['@_w']).toBe('25400'); // 2pt
	});

	// G10: a gradient/pattern `dgm:bg` must round-trip verbatim, not get
	// flattened to the parse-side approximated solid colour on every save.
	describe('backgroundFillXml (gradient/pattern round-trip)', () => {
		it('re-emits a preserved gradient fill verbatim instead of writing solidFill', () => {
			const dm: XmlObject = {};
			const gradFillXml: XmlObject = {
				'a:gsLst': {
					'a:gs': [
						{ '@_pos': '0', 'a:srgbClr': { '@_val': 'FF0000' } },
						{ '@_pos': '100000', 'a:srgbClr': { '@_val': '0000FF' } },
					],
				},
			};
			applySmartArtChrome(
				dm,
				{
					backgroundColor: '#800080', // the parse-side approximation
					backgroundFillXml: { localName: 'gradFill', xml: gradFillXml },
				},
				localName,
			);
			const bg = dm['dgm:bg'] as XmlObject;
			// The ORIGINAL gradient is written back, not a:solidFill built from
			// the approximated backgroundColor.
			expect(bg['a:solidFill']).toBeUndefined();
			expect(bg['a:gradFill']).toStrictEqual(gradFillXml);
		});

		it('re-emits a preserved pattern fill verbatim under a:pattFill', () => {
			const dm: XmlObject = {};
			const pattFillXml: XmlObject = { '@_prst': 'pct50', 'a:fgClr': {}, 'a:bgClr': {} };
			applySmartArtChrome(
				dm,
				{
					backgroundColor: '#123456',
					backgroundFillXml: { localName: 'pattFill', xml: pattFillXml },
				},
				localName,
			);
			const bg = dm['dgm:bg'] as XmlObject;
			expect(bg['a:solidFill']).toBeUndefined();
			expect(bg['a:pattFill']).toStrictEqual(pattFillXml);
		});

		it('reuses an existing prefixed gradFill key rather than duplicating', () => {
			const dm: XmlObject = { 'dgm:bg': { 'x:gradFill': { marker: true } } };
			const newGrad: XmlObject = { updated: true };
			applySmartArtChrome(
				dm,
				{ backgroundColor: '#000000', backgroundFillXml: { localName: 'gradFill', xml: newGrad } },
				localName,
			);
			const bg = dm['dgm:bg'] as XmlObject;
			expect(bg['x:gradFill']).toStrictEqual(newGrad);
			expect(bg['a:gradFill']).toBeUndefined();
		});
	});
});
