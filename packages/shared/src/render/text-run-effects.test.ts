import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildRunEffectStyle, buildTextRunFilterChain } from './text-run-effects';

describe('buildTextRunFilterChain', () => {
	it('returns undefined for a plain run', () => {
		expect(buildTextRunFilterChain({} as TextStyle)).toBeUndefined();
	});

	it('joins glow, inner-shadow, blur, and hsl in order', () => {
		const out = buildTextRunFilterChain({
			textGlowColor: '#ff0000',
			textGlowRadius: 6,
			textGlowOpacity: 0.6,
			textInnerShadowColor: '#000000',
			textInnerShadowBlur: 3,
			textInnerShadowOpacity: 0.5,
			textBlurRadius: 2,
			textHslHue: 30,
		} as TextStyle);
		expect(out).toBe(
			'drop-shadow(0 0 6px rgba(255,0,0,0.6)) drop-shadow(0px 0px 3px rgba(0,0,0,0.5)) blur(2px) hue-rotate(30deg)',
		);
	});
});

describe('buildRunEffectStyle', () => {
	it('returns an empty record for a plain run (no-op for normal text)', () => {
		expect(buildRunEffectStyle({} as TextStyle)).toStrictEqual({});
	});

	it('spreads a gradient fill record', () => {
		const css = buildRunEffectStyle({
			textFillGradient: 'linear-gradient(red, blue)',
		} as TextStyle);
		expect(css).toMatchObject({
			background: 'linear-gradient(red, blue)',
			backgroundClip: 'text',
			WebkitBackgroundClip: 'text',
			WebkitTextFillColor: 'transparent',
		});
	});

	it('sets textShadow from outer shadow props', () => {
		const css = buildRunEffectStyle({
			textShadowColor: '#000000',
			textShadowBlur: 4,
			textShadowOffsetX: 2,
			textShadowOffsetY: 3,
			textShadowOpacity: 0.5,
		} as TextStyle);
		expect(css.textShadow).toBe('2px 3px 4px rgba(0,0,0,0.5)');
	});

	it('folds glow + blur into the filter chain', () => {
		const css = buildRunEffectStyle({
			textGlowColor: '#ffff00',
			textGlowRadius: 5,
			textBlurRadius: 1,
		} as TextStyle);
		expect(css.filter).toContain('drop-shadow(0 0 5px');
		expect(css.filter).toContain('blur(1px)');
	});

	it('maps alpha modulation to opacity', () => {
		const css = buildRunEffectStyle({ textAlphaMod: 40 } as TextStyle);
		expect(css.opacity).toBe(0.4);
	});

	it('sets WebkitBoxReflect from reflection props', () => {
		const css = buildRunEffectStyle({
			textReflection: true,
			textReflectionOffset: 4,
			textReflectionStartOpacity: 0.5,
			textReflectionEndOpacity: 0,
		} as TextStyle);
		expect(css.WebkitBoxReflect).toBe('below 4px linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0))');
	});

	it('combines multiple effects in one record', () => {
		const css = buildRunEffectStyle({
			textFillGradient: 'linear-gradient(red, blue)',
			textShadowColor: '#000000',
			textBlurRadius: 2,
			textAlphaMod: 80,
		} as TextStyle);
		expect(css.background).toBe('linear-gradient(red, blue)');
		expect(css.textShadow).toBeTruthy();
		expect(css.filter).toContain('blur(2px)');
		expect(css.opacity).toBe(0.8);
	});
});
