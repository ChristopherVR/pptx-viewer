/**
 * Regression tests for the `a:bodyPr` text-body features that used to render in
 * React ONLY (multi-column bodies, tab stops, `@rot`) or in no binding at all
 * (`@anchorCtr`, `@vertOverflow`, the geometry text rectangle `a:rect`).
 *
 * They assert through this binding's own adapter, not through shared, because
 * the defect they cover was exactly that shared had no branch for any of them
 * and this adapter is all the binding contributes.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getTextBlockStyle } from './text-style';

function textShape(overrides: Record<string, unknown>): PptxElement {
	return {
		id: 't1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: 'hello',
		textStyle: {},
		...overrides,
	} as unknown as PptxElement;
}

describe('svelte text-body features', () => {
	it('lays a `numCol` body out in columns instead of one flex column', () => {
		const style = getTextBlockStyle(
			textShape({ textStyle: { columnCount: 2, columnSpacing: 16 } }),
		);
		expect(style['display']).toBe('block');
		expect(style['columnCount']).toBe(2);
		expect(style['columnGap']).toBe('16px');
	});

	it('advances a tab by `defTabSz` rather than the browser default', () => {
		expect(getTextBlockStyle(textShape({ textStyle: { defaultTabSize: 48 } }))['tabSize']).toBe(
			'48px',
		);
	});

	it('centres the text bounding box for `anchorCtr`', () => {
		expect(getTextBlockStyle(textShape({ textStyle: { anchorCenter: true } }))['alignItems']).toBe(
			'center',
		);
	});

	it('clips a `vertOverflow="clip"` body instead of letting it spill', () => {
		expect(getTextBlockStyle(textShape({ textStyle: { vertOverflow: 'clip' } }))['overflow']).toBe(
			'hidden',
		);
	});

	it('rotates the body for `a:bodyPr/@rot`', () => {
		expect(getTextBlockStyle(textShape({ textStyle: { textBodyRotation: 45 } }))['transform']).toBe(
			'rotate(45deg)',
		);
	});

	it('counter-rotates for `a:bodyPr/@upright` on a rotated shape, keeping text screen-upright', () => {
		expect(
			getTextBlockStyle(textShape({ rotation: 30, textStyle: { upright: true } }))['transform'],
		).toBe('rotate(-30deg)');
	});

	it('clamps `vertOverflow="ellipsis"` to a multi-line "…" truncation, not a plain clip', () => {
		const style = getTextBlockStyle(
			textShape({ height: 100, textStyle: { fontSize: 24, vertOverflow: 'ellipsis' } }),
		);
		expect(style['display']).toBe('-webkit-box');
		expect(style['overflow']).toBe('hidden');
		expect(style['textOverflow']).toBe('ellipsis');
		expect(style['WebkitLineClamp']).toBeTypeOf('number');
	});

	// A chevron's `a:rect` at the default adjustment is `l = dx`, `r = w - dx`
	// with `dx = min(w,h) * 50000 / 100000` = 50px on a 200x100 box, so the text
	// sits between the two arrow points instead of over them.
	it('insets text into the geometry text rectangle of a chevron', () => {
		const chevron = getTextBlockStyle(textShape({ shapeType: 'chevron' }));
		const plain = getTextBlockStyle(textShape({ shapeType: 'rect' }));
		expect(Number.parseFloat(String(plain['paddingLeft']))).toBeCloseTo(9.6, 1);
		expect(Number.parseFloat(String(chevron['paddingLeft']))).toBeCloseTo(59.6, 1);
		expect(Number.parseFloat(String(chevron['paddingRight']))).toBeCloseTo(59.6, 1);
	});

	// WordArt-style 3D text (`a:bodyPr/a:scene3d`) used to render flat here:
	// React, Vue and Angular all wired `buildTextBody3DSceneStyle` at the text
	// body container, but Svelte never did. This asserts the shared camera
	// preset maps through to `perspective` + `transform`.
	it('applies the body 3D scene camera preset as perspective + rotate', () => {
		const style = getTextBlockStyle(
			textShape({ textStyle: { textBodyScene3d: { cameraPreset: 'perspectiveAbove' } } }),
		);
		expect(style['perspective']).toBe('800px');
		expect(style['transform']).toBe('rotateX(-12deg)');
		expect(style['transformStyle']).toBe('preserve-3d');
	});

	// The scene transform must COMPOSE with the body's own `@rot`, not clobber
	// it: PowerPoint applies both the plane rotation and the 3D camera.
	it('composes the 3D scene transform with the body rotation transform', () => {
		const style = getTextBlockStyle(
			textShape({
				textStyle: {
					textBodyRotation: 45,
					textBodyScene3d: { cameraPreset: 'perspectiveAbove' },
				},
			}),
		);
		expect(style['transform']).toBe('rotate(45deg) rotateX(-12deg)');
	});

	// `a:flatTx` is the explicit "render flat" override and must block the
	// scene/camera transform too, matching `buildTextBody3DSceneStyle`'s guard.
	it('does not apply the 3D scene when `a:flatTx` is set', () => {
		const style = getTextBlockStyle(
			textShape({
				textStyle: {
					flatText: true,
					textBodyScene3d: { cameraPreset: 'perspectiveAbove' },
				},
			}),
		);
		expect(style['perspective']).toBeUndefined();
		expect(style['transformStyle']).toBeUndefined();
	});
});
