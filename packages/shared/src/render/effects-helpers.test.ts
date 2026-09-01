import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	disableGlowPatch,
	disableOuterShadowPatch,
	effectsStateOf,
	enableGlowPatch,
	enableOuterShadowPatch,
	updateOuterShadowPatch,
} from './effects-helpers';

function shape(shapeStyle?: ShapeStyle): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeType: 'rect',
		shapeStyle,
	} as PptxElement;
}

describe('outer shadow: rotateWithShape', () => {
	it('defaults to true when the shape has no shadow', () => {
		expect(effectsStateOf(shape()).outerShadow.rotateWithShape).toBeTruthy();
	});

	it('reads shadowRotateWithShape: false off the shapeStyle', () => {
		const el = shape({ shadowColor: '#000', shadowRotateWithShape: false });
		expect(effectsStateOf(el).outerShadow.rotateWithShape).toBeFalsy();
	});

	it('enableOuterShadowPatch writes rotateWithShape through', () => {
		const state = effectsStateOf(shape());
		const patch = enableOuterShadowPatch(shape(), { ...state.outerShadow, rotateWithShape: false });
		expect((patch.shapeStyle as ShapeStyle).shadowRotateWithShape).toBeFalsy();
	});

	it('updateOuterShadowPatch preserves rotateWithShape when not in the change set', () => {
		const el = shape({ shadowColor: '#000', shadowRotateWithShape: false });
		const patch = updateOuterShadowPatch(el, { blur: 10 });
		expect((patch.shapeStyle as ShapeStyle).shadowRotateWithShape).toBeFalsy();
	});

	it('updateOuterShadowPatch can flip rotateWithShape on its own', () => {
		const el = shape({ shadowColor: '#000', shadowRotateWithShape: true });
		const patch = updateOuterShadowPatch(el, { rotateWithShape: false });
		expect((patch.shapeStyle as ShapeStyle).shadowRotateWithShape).toBeFalsy();
	});
});

describe('glow enable/disable', () => {
	it('enables glow with the given state', () => {
		const patch = enableGlowPatch(shape(), {
			enabled: true,
			color: '#ff0000',
			radius: 8,
			opacity: 0.5,
		});
		expect(patch.shapeStyle).toMatchObject({
			glowColor: '#ff0000',
			glowRadius: 8,
			glowOpacity: 0.5,
		});
	});

	it('disables glow back to transparent/zero', () => {
		const el = shape({ glowColor: '#ff0000', glowRadius: 8, glowOpacity: 0.5 });
		const patch = disableGlowPatch(el);
		expect(patch.shapeStyle).toMatchObject({ glowColor: 'transparent', glowRadius: 0 });
	});
});

describe('disableOuterShadowPatch', () => {
	it('sets shadowColor to transparent without touching other fields', () => {
		const el = shape({ shadowColor: '#000', shadowBlur: 10 });
		const patch = disableOuterShadowPatch(el);
		expect((patch.shapeStyle as ShapeStyle).shadowColor).toBe('transparent');
		expect((patch.shapeStyle as ShapeStyle).shadowBlur).toBe(10);
	});
});
