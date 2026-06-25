import { describe, expect, it } from 'vitest';

import { resolveUnderlineDecorationStyle } from './text-decoration';

describe('resolveUnderlineDecorationStyle', () => {
	it('double strike wins over the underline style', () => {
		expect(resolveUnderlineDecorationStyle(true, 'wavy')).toStrictEqual({
			textDecorationStyle: 'double',
		});
	});

	it('returns undefined for none / empty underline', () => {
		expect(resolveUnderlineDecorationStyle(false, undefined)).toBeUndefined();
		expect(resolveUnderlineDecorationStyle(false, 'none')).toBeUndefined();
		expect(resolveUnderlineDecorationStyle(false, 'notARealStyle')).toBeUndefined();
	});

	it('maps single and double underlines', () => {
		expect(resolveUnderlineDecorationStyle(false, 'sng')).toStrictEqual({
			textDecorationStyle: 'solid',
			textDecorationThickness: '1px',
		});
		expect(resolveUnderlineDecorationStyle(false, 'dbl')).toStrictEqual({
			textDecorationStyle: 'double',
			textDecorationThickness: '1px',
		});
	});

	it('uses thickness for heavy variants', () => {
		expect(resolveUnderlineDecorationStyle(false, 'heavy')!.textDecorationThickness).toBe('3px');
		expect(resolveUnderlineDecorationStyle(false, 'dottedHeavy')!.textDecorationThickness).toBe(
			'3px',
		);
	});

	it('uses underline offset for compound dash / dot patterns', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dotDash')!.textUnderlineOffset).toBe('2px');
		expect(resolveUnderlineDecorationStyle(false, 'dotDotDash')!.textUnderlineOffset).toBe('3px');
		expect(resolveUnderlineDecorationStyle(false, 'wavyDbl')).toStrictEqual({
			textDecorationStyle: 'wavy',
			textDecorationThickness: '2px',
			textUnderlineOffset: '1px',
		});
	});
});
