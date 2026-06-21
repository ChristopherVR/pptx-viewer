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
});
