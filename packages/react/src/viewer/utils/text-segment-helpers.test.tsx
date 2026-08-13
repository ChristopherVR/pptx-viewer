/**
 * `renderPictureBullet` used to live here: React's own copy of the picture-
 * bullet decision. Shared `buildParagraphs` resolves the marker now
 * (`bulletPicture`, from `resolvePictureBullet`) and React's paragraph renderer
 * emits the `<img>` or the glyph fallback from that descriptor, so the coverage
 * moved with it: shared pins the resolution, `bidi-text.test.tsx` pins React's
 * markup, and the other bindings pin their own.
 */
import { describe, it, expect } from 'vitest';

import { resolveUnderlineDecorationStyle } from './text-segment-helpers';

describe('resolveUnderlineDecorationStyle', () => {
	it('should return double style for double strikethrough', () => {
		const result = resolveUnderlineDecorationStyle(true);
		expect(result).toStrictEqual({ textDecorationStyle: 'double' });
	});

	it('should return undefined when no underline style is provided and no double strike', () => {
		expect(resolveUnderlineDecorationStyle(false)).toBeUndefined();
		expect(resolveUnderlineDecorationStyle(false, undefined)).toBeUndefined();
	});

	it("should return undefined for 'none' underline style", () => {
		expect(resolveUnderlineDecorationStyle(false, 'none')).toBeUndefined();
	});

	it('should return undefined for unknown underline style', () => {
		expect(resolveUnderlineDecorationStyle(false, 'unknownType')).toBeUndefined();
	});

	// ── Single ──
	it('sng → solid, 1px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'sng')).toStrictEqual({
			textDecorationStyle: 'solid',
			textDecorationThickness: '1px',
		});
	});

	// ── Double ──
	it('dbl → double, 1px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dbl')).toStrictEqual({
			textDecorationStyle: 'double',
			textDecorationThickness: '1px',
		});
	});

	// ── Heavy ──
	it('heavy → solid, 3px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'heavy')).toStrictEqual({
			textDecorationStyle: 'solid',
			textDecorationThickness: '3px',
		});
	});

	// ── Dotted ──
	it('dotted → dotted, 1px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dotted')).toStrictEqual({
			textDecorationStyle: 'dotted',
			textDecorationThickness: '1px',
		});
	});

	it('dottedHeavy → dotted, 3px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dottedHeavy')).toStrictEqual({
			textDecorationStyle: 'dotted',
			textDecorationThickness: '3px',
		});
	});

	// ── Dashed ──
	it('dash → dashed, 1px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dash')).toStrictEqual({
			textDecorationStyle: 'dashed',
			textDecorationThickness: '1px',
		});
	});

	it('dashHeavy → dashed, 3px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dashHeavy')).toStrictEqual({
			textDecorationStyle: 'dashed',
			textDecorationThickness: '3px',
		});
	});

	// ── Long dashed ──
	it('dashLong → dashed, 1px, offset 3px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dashLong')).toStrictEqual({
			textDecorationStyle: 'dashed',
			textDecorationThickness: '1px',
			textUnderlineOffset: '3px',
		});
	});

	it('dashLongHeavy → dashed, 3px, offset 3px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dashLongHeavy')).toStrictEqual({
			textDecorationStyle: 'dashed',
			textDecorationThickness: '3px',
			textUnderlineOffset: '3px',
		});
	});

	// ── Dot-dash ──
	it('dotDash → dashed, 1px, offset 2px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dotDash')).toStrictEqual({
			textDecorationStyle: 'dashed',
			textDecorationThickness: '1px',
			textUnderlineOffset: '2px',
		});
	});

	it('dotDashHeavy → dashed, 3px, offset 2px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dotDashHeavy')).toStrictEqual({
			textDecorationStyle: 'dashed',
			textDecorationThickness: '3px',
			textUnderlineOffset: '2px',
		});
	});

	// ── Dot-dot-dash ──
	it('dotDotDash → dotted, 1px, offset 3px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dotDotDash')).toStrictEqual({
			textDecorationStyle: 'dotted',
			textDecorationThickness: '1px',
			textUnderlineOffset: '3px',
		});
	});

	it('dotDotDashHeavy → dotted, 3px, offset 3px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'dotDotDashHeavy')).toStrictEqual({
			textDecorationStyle: 'dotted',
			textDecorationThickness: '3px',
			textUnderlineOffset: '3px',
		});
	});

	// ── Wavy ──
	it('wavy → wavy, 1px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'wavy')).toStrictEqual({
			textDecorationStyle: 'wavy',
			textDecorationThickness: '1px',
		});
	});

	it('wavyHeavy → wavy, 3px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'wavyHeavy')).toStrictEqual({
			textDecorationStyle: 'wavy',
			textDecorationThickness: '3px',
		});
	});

	// ── Wavy double (approximation) ──
	it('wavyDbl → wavy, 2px, offset 1px', () => {
		expect(resolveUnderlineDecorationStyle(false, 'wavyDbl')).toStrictEqual({
			textDecorationStyle: 'wavy',
			textDecorationThickness: '2px',
			textUnderlineOffset: '1px',
		});
	});

	// ── All 16 underline types produce distinct CSS output ──
	it('all 16 underline types produce unique CSS output combinations', () => {
		const types = [
			'sng',
			'dbl',
			'heavy',
			'dotted',
			'dottedHeavy',
			'dash',
			'dashHeavy',
			'dashLong',
			'dashLongHeavy',
			'dotDash',
			'dotDashHeavy',
			'dotDotDash',
			'dotDotDashHeavy',
			'wavy',
			'wavyHeavy',
			'wavyDbl',
		];

		const outputs = types.map((t) => {
			const result = resolveUnderlineDecorationStyle(false, t);
			// Every type must produce a non-undefined result
			expect(result).toBeDefined();
			return JSON.stringify(result);
		});

		// All 16 should be unique
		const unique = new Set(outputs);
		expect(unique.size).toBe(16);
	});
});
