import type { PptxElement, Pptx3DScene, Pptx3DShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import type { CSSProperties } from 'vue';

import {
	get3dTransformCss,
	getExtrusionBoxShadow,
	getContourBoxShadow,
	getBevelStyle,
	getMaterialFilter,
	getComputed3dStyle,
	merge3dStyle,
} from './visual-3d';

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

	it('produces an exact COM-measured matrix3d for perspectiveFront preset (no separate perspective)', () => {
		// 2026-09 off-axis-camera homography wave: see shared
		// `visual-3d-camera-homography`'s module doc comment.
		const result = get3dTransformCss({ cameraPreset: 'perspectiveFront' }, undefined);
		expect(result?.transform).toContain('matrix3d(');
		expect(result?.perspective).toBeUndefined();
	});

	it('produces an exact matrix3d for a scene3d rotation (perspectiveAbove)', () => {
		const result = get3dTransformCss({ cameraPreset: 'perspectiveAbove' }, undefined);
		expect(result?.transform).toContain('matrix3d(');
		expect(result?.perspective).toBeUndefined();
	});

	it('produces an exact matrix3d for perspectiveLeft preset', () => {
		const result = get3dTransformCss({ cameraPreset: 'perspectiveLeft' }, undefined);
		expect(result?.transform).toContain('matrix3d(');
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

	it('emits scene3d rotation as an exact matrix3d transform', () => {
		const el = shape3dEl({ cameraPreset: 'perspectiveAbove' });
		const result = getComputed3dStyle(el);
		expect(result?.transform).toContain('matrix3d(');
		expect(result?.perspective).toBeUndefined();
		expect(result?.transformOrigin).toBe('0 0');
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

	it('does not synthesize a ground shadow from a bare backdrop (COM-measured: no visible effect)', () => {
		const el = shape3dEl({ hasBackdrop: true });
		const result = getComputed3dStyle(el);
		expect(result?.boxShadow).toBeUndefined();
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
		expect(result?.perspective).toBeUndefined();
		expect(result?.transform).toContain('matrix3d(');
		expect(result?.extrusionBoxShadow).toContain('#4472C4');
		expect(result?.boxShadow).toContain('inset');
		expect(result?.filter).toBeDefined();
		expect(result?.backgroundImage).toContain('linear-gradient');
	});
});

// ── merge3dStyle ─────────────────────────────────────────────────────────

describe('merge3dStyle', () => {
	it('is a no-op when computed is undefined', () => {
		const base: CSSProperties = { boxShadow: '0 1px 2px #000' };
		merge3dStyle(base, undefined);
		expect(base.boxShadow).toBe('0 1px 2px #000');
	});

	it('comma-joins extrusion + folded shadows with an existing effect shadow', () => {
		const base: CSSProperties = { boxShadow: '2px 2px 4px rgba(0,0,0,0.3)' };
		const el = shape3dEl(undefined, {
			extrusionHeight: 47625,
			extrusionColor: '#4472C4',
			bevelTopType: 'circle',
		});
		merge3dStyle(base, getComputed3dStyle(el));
		const shadow = String(base.boxShadow);
		// Original effect shadow preserved, plus extrusion, plus bevel inset.
		expect(shadow).toContain('2px 2px 4px rgba(0,0,0,0.3)');
		expect(shadow).toContain('#4472C4');
		expect(shadow).toContain('inset');
	});

	it('appends 3D transform after an existing transform', () => {
		const base: CSSProperties = { transform: 'rotate(45deg)' };
		const el = shape3dEl({ cameraPreset: 'perspectiveAbove' });
		merge3dStyle(base, getComputed3dStyle(el));
		expect(String(base.transform)).toContain('rotate(45deg)');
		expect(String(base.transform)).toContain('matrix3d(');
	});

	it('carries the COM-measured off-axis skew through for corrected presets (transformOrigin 0 0, no perspective-origin)', () => {
		const base: CSSProperties = {};
		const el = shape3dEl({ cameraPreset: 'perspectiveContrastingLeftFacing' });
		merge3dStyle(base, getComputed3dStyle(el));
		expect(base.perspectiveOrigin).toBeUndefined();
		expect(base.transformOrigin).toBe('0 0');
		expect(String(base.transform)).toContain('matrix3d(');
	});

	it('leaves perspective-origin unset for presets with no off-axis correction', () => {
		const base: CSSProperties = {};
		const el = shape3dEl({ cameraPreset: 'perspectiveAbove' });
		merge3dStyle(base, getComputed3dStyle(el));
		expect(base.perspectiveOrigin).toBeUndefined();
	});
});
