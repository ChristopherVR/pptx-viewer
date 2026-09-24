import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildTextBlurFilter,
	buildTextGlowFilter,
	buildTextHslFilter,
	buildTextInnerShadowCss,
	buildTextShadowCss,
	buildTextSoftEdgeFilter,
	getTextAlphaOpacity,
} from './text-effects';
import { buildTextBody3DSceneStyle } from './text-effects-3d';
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

	it('builds an inset box-shadow, never an outer drop-shadow', () => {
		// Regression: `filter: drop-shadow(...)` can only paint OUTSIDE an
		// element's alpha silhouette, so an inner shadow rendered as a diffuse
		// halo bleeding past the glyphs instead of shading inside them
		// (COM-verified against `audit-text` slide 14's "INNERSHDW" run).
		// `inset` is the fix: it is CSS's own inside-the-box primitive.
		const out = buildTextInnerShadowCss({
			textInnerShadowColor: '#ff0000',
			textInnerShadowBlur: 3,
		} as TextStyle);
		expect(out).toContain('inset ');
		expect(out).not.toContain('drop-shadow');
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

	it('builds a layered glow (tight halo), not one wide blur pass', () => {
		// Regression: a single `drop-shadow(0 0 <radius>px ...)` is one Gaussian
		// blur, which spreads out far more diffusely than PowerPoint's own glow
		// (COM-verified against `audit-text` slide 14's "GLOW" run). Three
		// stacked layers at increasing radius / decreasing opacity build a
		// denser near-glyph core, matching a shape's `getGlowBoxShadowCss`.
		const out = buildTextGlowFilter({ textGlowColor: '#ffff00', textGlowRadius: 6 } as TextStyle);
		expect(out).toContain('drop-shadow(0 0 2px');
		expect(out).toContain('drop-shadow(0 0 4px');
		expect(out).toContain('drop-shadow(0 0 6px');
		expect(out?.match(/drop-shadow\(/gu)?.length).toBe(3);
	});

	it('builds a soft-edge blur filter only for a positive radius', () => {
		expect(buildTextSoftEdgeFilter({ textSoftEdgeRadius: 5 } as TextStyle)).toBe('blur(5px)');
		expect(buildTextSoftEdgeFilter({ textSoftEdgeRadius: 0 } as TextStyle)).toBeUndefined();
		expect(buildTextSoftEdgeFilter({} as TextStyle)).toBeUndefined();
	});
});

describe('3d text effects', () => {
	it('builds a scene style from explicit rotation', () => {
		const out = buildTextBody3DSceneStyle({
			textBodyScene3d: { cameraRotY: 600000 },
		} as TextStyle);
		// An explicit `a:camera/a:rot` override resolves to a COM-measured exact
		// `matrix3d(...)` homography (see `visual-3d-camera-override.ts`), not the
		// legacy `perspective()` + `rotateY()` approximation: no `perspective` is
		// emitted, and the rotation is baked into the matrix rather than a
		// separate `rotateY(10deg)` transform function.
		expect(out).toMatchObject({ transformOrigin: '0 0', transformStyle: 'preserve-3d' });
		expect(out).not.toHaveProperty('perspective');
		expect(String(out!.transform)).toMatch(/^matrix3d\(/);
	});

	it('returns undefined without a scene', () => {
		expect(buildTextBody3DSceneStyle({} as TextStyle)).toBeUndefined();
	});

	it('short-circuits the scene/camera transform when a:flatTx is set (flatText)', () => {
		expect(
			buildTextBody3DSceneStyle({
				textBodyScene3d: { cameraRotY: 600000 },
				flatText: true,
			} as TextStyle),
		).toBeUndefined();
	});
});
