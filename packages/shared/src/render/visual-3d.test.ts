import type { PptxElement, Pptx3DScene, Pptx3DShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	get3dTransformCss,
	getExtrusionBoxShadow,
	getContourBoxShadow,
	getBevelStyle,
	getMaterialFilter,
	getComputed3dStyle,
	apply3dEffects,
	getCameraTransform,
	get3DBevelShadow,
	get3DMaterialFilter,
	get3DTransformStyle,
	getLightRigCss,
} from './visual-3d';
import type { MutableCss } from './visual-3d';

function shape3dEl(scene3d?: Pptx3DScene, shape3d?: Pptx3DShape): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeStyle: { scene3d, shape3d },
	} as PptxElement;
}

// ── get3dTransformCss ────────────────────────────────────────────────────

describe('get3dTransformCss', () => {
	it('returns undefined when no scene3d and no shape3d', () => {
		expect(get3dTransformCss(undefined, undefined)).toBeUndefined();
	});

	it('produces perspective for perspectiveFront preset', () => {
		const result = get3dTransformCss({ cameraPreset: 'perspectiveFront' }, undefined);
		expect(result?.perspective).toBe('1000px');
	});

	it('produces rotateX for a scene3d rotation (perspectiveAbove)', () => {
		const result = get3dTransformCss({ cameraPreset: 'perspectiveAbove' }, undefined);
		expect(result?.transform).toContain('rotateX(-20deg)');
		expect(result?.perspective).toBe('1000px');
	});

	it('produces rotateY for perspectiveLeft preset', () => {
		const result = get3dTransformCss({ cameraPreset: 'perspectiveLeft' }, undefined);
		expect(result?.transform).toContain('rotateY(20deg)');
	});

	it('honours explicit camera rotation overrides (1/60000 deg)', () => {
		// 1800000 / 60000 = 30; X is negated, Y kept positive
		const result = get3dTransformCss(
			{ cameraPreset: 'perspectiveFront', cameraRotX: 1800000, cameraRotY: 2700000 },
			undefined,
		);
		expect(result?.transform).toContain('rotateX(-30deg)');
		expect(result?.transform).toContain('rotateY(45deg)');
	});

	it('appends translateZ when extrusion present', () => {
		const result = get3dTransformCss(undefined, { extrusionHeight: 95250 }); // ~10px
		expect(result?.transform).toContain('translateZ(');
		expect(result?.transformStyle).toBe('preserve-3d');
	});

	it('returns no transform for orthographicFront (no perspective/rotation)', () => {
		const result = get3dTransformCss({ cameraPreset: 'orthographicFront' }, undefined);
		expect(result?.transform).toBeUndefined();
		expect(result?.perspective).toBeUndefined();
	});
});

// ── getExtrusionBoxShadow ────────────────────────────────────────────────

describe('getExtrusionBoxShadow', () => {
	it('returns undefined when no extrusion', () => {
		expect(getExtrusionBoxShadow(undefined)).toBeUndefined();
		expect(getExtrusionBoxShadow({ extrusionHeight: 0 })).toBeUndefined();
	});

	it('produces layered box-shadow for positive depth', () => {
		const result = getExtrusionBoxShadow({ extrusionHeight: 95250, extrusionColor: '#4472C4' });
		expect(result).toBeDefined();
		expect(result).toContain('#4472C4');
		const layers = (result ?? '').split(', ');
		expect(layers.length).toBeGreaterThan(3);
	});

	it('includes a final soft shadow for depth perception', () => {
		const result = getExtrusionBoxShadow({ extrusionHeight: 76200, extrusionColor: '#888888' });
		expect(result).toContain('rgba(0,0,0,0.2)');
	});

	it('defaults the extrusion colour when none provided', () => {
		const result = getExtrusionBoxShadow({ extrusionHeight: 47625 });
		expect(result).toContain('#888888');
	});
});

// ── getContourBoxShadow ──────────────────────────────────────────────────

describe('getContourBoxShadow', () => {
	it('returns undefined when no contour', () => {
		expect(getContourBoxShadow(undefined)).toBeUndefined();
		expect(getContourBoxShadow({ contourWidth: 0 })).toBeUndefined();
	});

	it('produces an outline ring shadow', () => {
		const result = getContourBoxShadow({ contourWidth: 19050, contourColor: '#FF0000' });
		expect(result).toContain('#FF0000');
		expect(result).toMatch(/^0 0 0 \d+px/u);
	});
});

// ── getBevelStyle ────────────────────────────────────────────────────────

describe('getBevelStyle', () => {
	it('returns undefined when no bevel', () => {
		expect(getBevelStyle(undefined)).toBeUndefined();
		expect(getBevelStyle({ bevelTopType: 'none' })).toBeUndefined();
	});

	it('produces inset shadows for a circle bevel', () => {
		const result = getBevelStyle({
			bevelTopType: 'circle',
			bevelTopWidth: 28575,
			bevelTopHeight: 28575,
		});
		expect(result?.boxShadow).toContain('inset');
		expect(result?.background).toBeUndefined();
	});

	it('hardEdge bevel produces zero-blur shadows', () => {
		const result = getBevelStyle({
			bevelTopType: 'hardEdge',
			bevelTopWidth: 19050,
			bevelTopHeight: 19050,
		});
		expect(result?.boxShadow).toContain(' 0 rgba(');
	});

	it('convex bevel includes a background gradient', () => {
		const result = getBevelStyle({ bevelTopType: 'convex', bevelTopWidth: 28575 });
		expect(result?.background).toContain('radial-gradient');
	});

	it('combines top and bottom bevels', () => {
		const result = getBevelStyle({
			bevelTopType: 'circle',
			bevelBottomType: 'angle',
		});
		expect(result?.boxShadow).toContain('inset');
	});
});

// ── getMaterialFilter ────────────────────────────────────────────────────

describe('getMaterialFilter', () => {
	it('returns undefined when no material', () => {
		expect(getMaterialFilter(undefined)).toBeUndefined();
		expect(getMaterialFilter({})).toBeUndefined();
	});

	it('returns a filter chain for metal', () => {
		const result = getMaterialFilter({ presetMaterial: 'metal' });
		expect(result).toContain('brightness(1.1)');
		expect(result).toContain('contrast(1.15)');
		expect(result).toContain('saturate(1.2)');
	});

	it('returns undefined for flat (no filter)', () => {
		expect(getMaterialFilter({ presetMaterial: 'flat' })).toBeUndefined();
	});
});

// ── getComputed3dStyle ───────────────────────────────────────────────────

describe('getComputed3dStyle', () => {
	it('returns undefined for an element without 3D data', () => {
		const el = shape3dEl(undefined, undefined);
		expect(getComputed3dStyle(el)).toBeUndefined();
	});

	it('returns undefined for non-shape elements', () => {
		const el = { type: 'image', id: 'i1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(getComputed3dStyle(el)).toBeUndefined();
	});

	it('emits scene3d rotation as a rotateX transform', () => {
		const el = shape3dEl({ cameraPreset: 'perspectiveAbove' });
		const result = getComputed3dStyle(el);
		expect(result?.transform).toContain('rotateX(-20deg)');
		expect(result?.perspective).toBe('1000px');
		expect(result?.willChange).toBe('transform');
	});

	it('emits extrusion as a SEPARATE extrusionBoxShadow (not boxShadow)', () => {
		const el = shape3dEl(undefined, { extrusionHeight: 95250, extrusionColor: '#4472C4' });
		const result = getComputed3dStyle(el);
		expect(result?.extrusionBoxShadow).toBeDefined();
		expect(result?.extrusionBoxShadow).toContain('#4472C4');
		// The stacked extrusion must NOT bleed into the folded boxShadow slot.
		expect(result?.boxShadow ?? '').not.toContain('#4472C4');
	});

	it('folds bevel inset shadow into boxShadow', () => {
		const el = shape3dEl(undefined, {
			bevelTopType: 'circle',
			bevelTopWidth: 28575,
			bevelTopHeight: 28575,
		});
		const result = getComputed3dStyle(el);
		expect(result?.boxShadow).toContain('inset');
	});

	it('folds backdrop ground shadow into boxShadow', () => {
		const el = shape3dEl({ hasBackdrop: true });
		const result = getComputed3dStyle(el);
		expect(result?.boxShadow).toContain('rgba(0,0,0,0.25)');
	});

	it('emits material filter and light-rig overlay', () => {
		const el = shape3dEl({ lightRigType: 'harsh' }, { presetMaterial: 'metal' });
		const result = getComputed3dStyle(el);
		expect(result?.filter).toContain('brightness');
		expect(result?.backgroundImage).toContain('linear-gradient');
	});

	it('combines extrusion + bevel + material + camera', () => {
		const el = shape3dEl(
			{ cameraPreset: 'perspectiveAbove', lightRigType: 'threePt' },
			{
				extrusionHeight: 47625,
				extrusionColor: '#4472C4',
				bevelTopType: 'circle',
				bevelTopWidth: 19050,
				bevelTopHeight: 19050,
				presetMaterial: 'plastic',
			},
		);
		const result = getComputed3dStyle(el);
		expect(result?.perspective).toBe('1000px');
		expect(result?.transform).toContain('rotateX(-20deg)');
		expect(result?.extrusionBoxShadow).toContain('#4472C4');
		expect(result?.boxShadow).toContain('inset');
		expect(result?.filter).toBeDefined();
		expect(result?.backgroundImage).toContain('linear-gradient');
	});
});

// ── getCameraTransform (React-compatible alias) ──────────────────────────

describe('getCameraTransform', () => {
	it('returns zeros when scene3d is undefined', () => {
		const result = getCameraTransform(undefined);
		expect(result.perspective).toBeUndefined();
		expect(result.rotateX).toBe(0);
		expect(result.rotateY).toBe(0);
		expect(result.rotateZ).toBe(0);
	});

	it('maps perspectiveAbove to rotateX -20deg with 1000px perspective', () => {
		const result = getCameraTransform({ cameraPreset: 'perspectiveAbove' });
		expect(result.perspective).toBe('1000px');
		expect(result.rotateX).toBe(-20);
	});

	it('explicit rotation angles override preset defaults', () => {
		const result = getCameraTransform({
			cameraPreset: 'perspectiveFront',
			cameraRotX: 1800000,
			cameraRotY: 2700000,
		});
		expect(result.rotateX).toBe(-30);
		expect(result.rotateY).toBe(45);
	});

	it('applies default 800px perspective for explicit rotations without preset', () => {
		const result = getCameraTransform({ cameraRotX: 600000 });
		expect(result.perspective).toBe('800px');
		expect(result.rotateX).toBe(-10);
	});
});

// ── get3DBevelShadow (React-compatible string-only bevel) ────────────────

describe('get3DBevelShadow', () => {
	it('returns undefined when no shape3d or no bevel', () => {
		expect(get3DBevelShadow(undefined)).toBeUndefined();
		expect(get3DBevelShadow({})).toBeUndefined();
		expect(get3DBevelShadow({ bevelTopType: 'none' })).toBeUndefined();
	});

	it('generates inset shadow for circle bevel', () => {
		const result = get3DBevelShadow({
			bevelTopType: 'circle',
			bevelTopWidth: 28575,
			bevelTopHeight: 28575,
		});
		expect(result).toContain('inset');
		expect(result).toContain('rgba(255,255,255,');
	});

	it('handles both top and bottom bevel simultaneously', () => {
		const result = get3DBevelShadow({
			bevelTopType: 'circle',
			bevelBottomType: 'hardEdge',
		});
		const layers = (result ?? '').split(', inset');
		expect(layers.length).toBeGreaterThanOrEqual(3);
	});
});

// ── get3DMaterialFilter (React-compatible alias) ─────────────────────────

describe('get3DMaterialFilter', () => {
	it('returns undefined when no material', () => {
		expect(get3DMaterialFilter(undefined)).toBeUndefined();
		expect(get3DMaterialFilter({})).toBeUndefined();
	});

	it('returns combined filters for metal', () => {
		const result = get3DMaterialFilter({ presetMaterial: 'metal' });
		expect(result).toContain('brightness');
		expect(result).toContain('saturate');
	});

	it('returns undefined for flat', () => {
		expect(get3DMaterialFilter({ presetMaterial: 'flat' })).toBeUndefined();
	});
});

// ── get3DTransformStyle (React-compatible plain-object) ──────────────────

describe('get3DTransformStyle', () => {
	it('returns empty object when no params', () => {
		expect(Object.keys(get3DTransformStyle(undefined))).toHaveLength(0);
	});

	it('includes perspective + willChange for a camera preset', () => {
		const result = get3DTransformStyle({ cameraPreset: 'perspectiveFront' });
		expect(result.perspective).toBe('1000px');
		expect(result.willChange).toBe('transform');
	});

	it('sets willChange when shape3d exists', () => {
		expect(get3DTransformStyle(undefined, { presetMaterial: 'metal' }).willChange).toBe(
			'transform',
		);
	});
});

// ── getLightRigCss ───────────────────────────────────────────────────────

describe('getLightRigCss', () => {
	it('returns empty for undefined rig type', () => {
		const result = getLightRigCss(undefined, undefined);
		expect(result.backgroundImage).toBeUndefined();
		expect(result.filter).toBeUndefined();
	});

	it('returns a multi-layer gradient for threePt', () => {
		const result = getLightRigCss('threePt', undefined);
		expect(result.backgroundImage).toContain('linear-gradient');
		const layers = (result.backgroundImage ?? '').split('linear-gradient');
		expect(layers.length).toBeGreaterThanOrEqual(3);
	});

	it('rotates gradient angles for an explicit direction', () => {
		const resultRight = getLightRigCss('threePt', 'r');
		expect(resultRight.backgroundImage).toContain('270deg');
		expect(resultRight.backgroundImage).toContain('90deg');
	});

	it('returns empty for an unknown rig', () => {
		expect(getLightRigCss('unknownRig', undefined).backgroundImage).toBeUndefined();
	});
});

// ── apply3dEffects (mutator integration) ─────────────────────────────────

describe('apply3dEffects', () => {
	it('does not modify base when no 3D params provided', () => {
		const base: MutableCss = {};
		apply3dEffects(base, undefined, undefined);
		expect(base.transform).toBeUndefined();
		expect(base.perspective).toBeUndefined();
	});

	it('applies perspective + rotateX for a camera X rotation', () => {
		const base: MutableCss = {};
		apply3dEffects(base, { cameraRotX: 1800000 }, undefined);
		expect(base.perspective).toBe('800px');
		expect(base.transform).toContain('rotateX(-30deg)');
	});

	it('adds extrusion depth as stacked box-shadows', () => {
		const base: MutableCss = {};
		apply3dEffects(base, undefined, { extrusionHeight: 95250, extrusionColor: '#888888' });
		expect(base.boxShadow).toContain('#888888');
	});

	it('adds backdrop ground-plane shadow', () => {
		const base: MutableCss = {};
		apply3dEffects(base, { hasBackdrop: true }, undefined);
		expect(base.boxShadow).toContain('rgba(0,0,0,0.25)');
	});

	it('applies material opacity for clear material', () => {
		const base: MutableCss = {};
		apply3dEffects(base, undefined, { presetMaterial: 'clear' });
		expect(base.opacity).toBe(0.7);
	});

	it('composes with existing transform and preserves existing boxShadow', () => {
		const base: MutableCss = { transform: 'scaleX(-1)', boxShadow: '2px 2px 4px rgba(0,0,0,0.5)' };
		apply3dEffects(
			base,
			{ cameraPreset: 'perspectiveAbove' },
			{
				extrusionHeight: 28575,
				extrusionColor: '#000',
			},
		);
		expect(base.transform).toContain('scaleX(-1)');
		expect(base.transform).toContain('rotateX(-20deg)');
		expect(base.boxShadow).toContain('2px 2px 4px rgba(0,0,0,0.5)');
		expect(base.boxShadow).toContain('#000');
	});

	it('combines all 3D effects without conflicts', () => {
		const base: MutableCss = {};
		apply3dEffects(
			base,
			{ cameraPreset: 'perspectiveAbove', lightRigType: 'threePt', hasBackdrop: true },
			{
				extrusionHeight: 47625,
				extrusionColor: '#4472C4',
				bevelTopType: 'circle',
				bevelTopWidth: 19050,
				bevelTopHeight: 19050,
				presetMaterial: 'plastic',
			},
		);
		expect(base.perspective).toBe('1000px');
		expect(base.transform).toContain('rotateX(-20deg)');
		expect(base.boxShadow).toContain('#4472C4');
		expect(base.boxShadow).toContain('inset');
		expect(base.boxShadow).toContain('rgba(0,0,0,0.25)');
		expect(base.filter).toContain('brightness');
		expect(base.backgroundImage).toContain('linear-gradient');
		expect(base.willChange).toBe('transform');
	});
});
