import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildTextBlurFilter,
	buildTextGlowFilter,
	buildTextHslFilter,
	buildTextInnerShadowCss,
	buildTextReflectionCss,
	buildTextShadowCss,
	getTextAlphaOpacity,
} from './text-effects';
import { buildTextBody3DSceneStyle, buildText3DShadowCss } from './text-effects-3d';
import { buildTextFillCss } from './text-fill';

describe('buildTextFillCss', () => {
	it('clips a gradient to the glyphs', () => {
		const css = buildTextFillCss({ textFillGradient: 'linear-gradient(red, blue)' } as TextStyle);
		expect(css).toMatchObject({
			background: 'linear-gradient(red, blue)',
			backgroundClip: 'text',
			WebkitTextFillColor: 'transparent',
		});
	});

	it('returns undefined when no fill is configured', () => {
		expect(buildTextFillCss({} as TextStyle)).toBeUndefined();
	});
});

describe('text effect css builders', () => {
	it('builds an outer text-shadow', () => {
		const out = buildTextShadowCss({
			textShadowColor: '#000000',
			textShadowBlur: 4,
			textShadowOffsetX: 2,
			textShadowOffsetY: 3,
			textShadowOpacity: 0.5,
		} as TextStyle);
		expect(out).toBe('2px 3px 4px rgba(0,0,0,0.5)');
	});

	it('builds an inner shadow drop-shadow filter', () => {
		const out = buildTextInnerShadowCss({
			textInnerShadowColor: '#ff0000',
			textInnerShadowBlur: 3,
		} as TextStyle);
		expect(out).toContain('drop-shadow(');
		expect(out).toContain('rgba(255,0,0');
	});

	it('builds a blur filter only for a positive radius', () => {
		expect(buildTextBlurFilter({ textBlurRadius: 5 } as TextStyle)).toBe('blur(5px)');
		expect(buildTextBlurFilter({ textBlurRadius: 0 } as TextStyle)).toBeUndefined();
	});

	it('builds an HSL filter chain', () => {
		const out = buildTextHslFilter({
			textHslHue: 90,
			textHslSaturation: 50,
			textHslLuminance: 20,
		} as TextStyle);
		expect(out).toBe('hue-rotate(90deg) saturate(0.5) brightness(1.2)');
	});

	it('clamps alpha opacity', () => {
		expect(getTextAlphaOpacity({ textAlphaModFix: 50 } as TextStyle)).toBe(0.5);
		expect(getTextAlphaOpacity({} as TextStyle)).toBeUndefined();
	});

	it('builds a glow drop-shadow', () => {
		const out = buildTextGlowFilter({ textGlowColor: '#ffff00', textGlowRadius: 6 } as TextStyle);
		expect(out).toContain('drop-shadow(0 0 6px');
	});

	it('builds a webkit box reflect', () => {
		const out = buildTextReflectionCss({ textReflection: true } as TextStyle);
		expect(out).toContain('below 0px linear-gradient(');
	});
});

describe('3d text effects', () => {
	it('builds layered extrusion shadows', () => {
		const out = buildText3DShadowCss({
			color: '#336699',
			text3d: { extrusionHeight: 95250 },
		} as TextStyle);
		expect(out).toBeDefined();
		expect(out!.split(', ').length).toBeGreaterThan(1);
	});

	it('returns undefined without any 3d settings', () => {
		expect(buildText3DShadowCss({ text3d: {} } as TextStyle)).toBeUndefined();
		expect(buildText3DShadowCss({} as TextStyle)).toBeUndefined();
	});

	it('builds a scene style from explicit rotation', () => {
		const out = buildTextBody3DSceneStyle({
			textBodyScene3d: { cameraRotY: 600000 },
		} as TextStyle);
		expect(out).toMatchObject({ perspective: '800px', transformStyle: 'preserve-3d' });
		expect(String(out!.transform)).toContain('rotateY(10deg)');
	});

	it('returns undefined without a scene', () => {
		expect(buildTextBody3DSceneStyle({} as TextStyle)).toBeUndefined();
	});
});
