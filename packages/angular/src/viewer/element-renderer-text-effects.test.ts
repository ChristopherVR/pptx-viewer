/**
 * Unit tests for the per-run text-effect wiring in `ElementRendererComponent`.
 *
 * The Angular compiler / TestBed needs `@analogjs/vite-plugin-angular` (a
 * follow-up), so the component is not instantiated here.
 * Instead, like the other `*.component.test.ts` files, this exercises the pure
 * shared builders the renderer's `runStyleFromSegment` / `scene3dStyle` consume
 * from `../internal/shared`, asserting they produce a neutral CSS record that
 * Angular's `[ngStyle]` (a `Record<string, string | number>` StyleMap) applies
 * directly, and that ordinary text stays a strict no-op.
 */
import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildRunEffectStyle, buildTextBody3DSceneStyle } from '../internal/shared';
import type { StyleMap } from './element-style';

describe('elementRenderer per-run text effects (shared builder wiring)', () => {
	it('returns an empty record for a plain run (no-op for normal text)', () => {
		const style: StyleMap = { color: '#111111' };
		Object.assign(style, buildRunEffectStyle({} as TextStyle));
		expect(style).toStrictEqual({ color: '#111111' });
	});

	it('folds a gradient fill, shadow, filter, and opacity into one run style; reflection never rides WebkitBoxReflect', () => {
		// Reflection is deliberately excluded from `buildRunEffectStyle`'s CSS
		// record: it renders as a mirrored-sibling wrapper instead (`run.reflection`
		// on `paragraph-view.ts`'s `TextRun`, resolved by shared's
		// `getTextReflectionWrapperStyle`), the same mechanism a shape/picture's
		// `ReflectionOverlay` uses. See `paragraph-view.test.ts` for that wiring.
		const style: StyleMap = {};
		Object.assign(
			style,
			buildRunEffectStyle({
				textFillGradient: 'linear-gradient(red, blue)',
				textShadowColor: '#000000',
				textGlowColor: '#ffff00',
				textGlowRadius: 6,
				textBlurRadius: 2,
				textAlphaMod: 80,
				textReflection: true,
			} as TextStyle),
		);
		expect(style.background).toBe('linear-gradient(red, blue)');
		expect(style.backgroundClip).toBe('text');
		expect(style.textShadow).toBeTruthy();
		expect(String(style.filter)).toContain('drop-shadow');
		expect(String(style.filter)).toContain('blur(2px)');
		expect(style.opacity).toBe(0.8);
		expect(style).not.toHaveProperty('WebkitBoxReflect');
		expect(JSON.stringify(style)).not.toContain('box-reflect');
	});

	it('builds a text-body 3D scene style (perspective + rotate) from scene3d', () => {
		const scene = buildTextBody3DSceneStyle({
			textBodyScene3d: { cameraPreset: 'perspectiveAbove' },
		} as TextStyle) as StyleMap | undefined;
		expect(scene).toBeTruthy();
		expect(scene?.perspective).toBeTruthy();
		expect(String(scene?.transform)).toContain('rotateX');
		expect(scene?.transformStyle).toBe('preserve-3d');
	});

	it('returns no scene style when the text body carries no scene3d', () => {
		expect(buildTextBody3DSceneStyle({} as TextStyle)).toBeUndefined();
	});
});
