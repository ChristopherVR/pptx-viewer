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

	it('produces an exact COM-measured matrix3d for perspectiveFront preset (no separate perspective)', () => {
		// 2026-09 off-axis-camera homography wave: a COM-measured exact
		// `matrix3d(...)` replaces the old `perspective()` + `rotateX/Y` model
		// (see `visual-3d-camera-homography`'s module doc comment); a separate
		// CSS `perspective` would double-apply the projective divide.
		const result = get3dTransformCss({ cameraPreset: 'perspectiveFront' }, undefined);
		expect(result?.transform).toContain('matrix3d(');
		expect(result?.perspective).toBeUndefined();
		expect(result?.transformOrigin).toBe('0 0');
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

	it('folds the off-axis correction into the matrix3d for perspectiveContrastingLeftFacing (no separate perspective-origin)', () => {
		const result = get3dTransformCss(
			{ cameraPreset: 'perspectiveContrastingLeftFacing' },
			undefined,
		);
		expect(result?.transform).toContain('matrix3d(');
		expect(result?.perspectiveOrigin).toBeUndefined();
		expect(result?.transformOrigin).toBe('0 0');
	});

	it('omits perspective-origin for every homography-driven preset', () => {
		const result = get3dTransformCss({ cameraPreset: 'perspectiveLeft' }, undefined);
		expect(result?.perspectiveOrigin).toBeUndefined();
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

	it('appends translateZ for a:sp3d/@z, independent of extrusion depth', () => {
		const result = get3dTransformCss(undefined, { positionZ: 19050 }); // 2px @ 9525 EMU/px
		expect(result?.transform).toBe('translateZ(2px)');
	});

	it('composes z-position and extrusion translateZ together', () => {
		const result = get3dTransformCss(undefined, { positionZ: 19050, extrusionHeight: 95250 });
		expect(result?.transform).toMatch(/translateZ\(2px\).*translateZ\(/);
	});

	it('omits translateZ when a:sp3d/@z is 0 or absent', () => {
		expect(get3dTransformCss(undefined, { positionZ: 0 })?.transform).toBeUndefined();
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

// `a:backdrop` intentionally renders NO synthetic CSS shadow of its own (see
// the module doc comment above `getBevelStyle`'s declaration in `visual-3d.ts`
// for the COM measurement: with no shadow effect on the shape, a backdrop
// produces zero visible difference in real PowerPoint at any `a:norm`, and
// even with a shadow effect a level/near-level backdrop is visually
// indistinguishable from having no backdrop at all - only a strongly tilted
// backdrop changes the shadow, in a way no CSS `box-shadow` can represent).
// `getBackdropShadow` (and its dedicated test suite) were removed with it.

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
		// The homography path never emits a separate CSS `perspective`: the
		// projective divide is already baked into the matrix3d.
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

// ── getCameraTransform (React-compatible alias) ──────────────────────────

describe('getCameraTransform', () => {
	it('returns zeros when scene3d is undefined', () => {
		const result = getCameraTransform(undefined);
		expect(result.perspective).toBeUndefined();
		expect(result.rotateX).toBe(0);
		expect(result.rotateY).toBe(0);
		expect(result.rotateZ).toBe(0);
	});

	it('maps perspectiveAbove to an exact matrix3d, no separate perspective', () => {
		const result = getCameraTransform({ cameraPreset: 'perspectiveAbove' });
		expect(result.perspective).toBeUndefined();
		expect(result.matrix3d).toContain('matrix3d(');
		expect(result.transformOrigin).toBe('0 0');
		// rotateX still carries the legacy table's hand-tuned angle as an
		// extrusion panel-direction HINT only; see `cameraFlatFace`'s doc
		// comment. It must NOT be used to build the actual CSS transform.
		expect(result.rotateX).toBe(20);
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

	it('maps isometricLeftUp and isometricRightDown to non-zero rotation with NO perspective (D1-G1)', () => {
		const leftUp = getCameraTransform({ cameraPreset: 'isometricLeftUp' });
		expect(leftUp.rotateX).not.toBe(0);
		expect(leftUp.rotateY).not.toBe(0);
		// COM-measured (2026-09): real PowerPoint renders isometric presets as a
		// true parallelogram (parallel projection), not a perspective-foreshortened
		// one, so no CSS `perspective` is emitted for this family at all.
		expect(leftUp.perspective).toBeUndefined();

		const rightDown = getCameraTransform({ cameraPreset: 'isometricRightDown' });
		expect(rightDown.rotateX).not.toBe(0);
		expect(rightDown.rotateY).not.toBe(0);
		expect(rightDown.perspective).toBeUndefined();
		// The two presets mirror each other around the isometric cube's diagonal.
		expect(rightDown.rotateX).toBe(leftUp.rotateX);
		expect(rightDown.rotateY).toBe(-leftUp.rotateY);
	});

	it('maps all 18 legacyOblique*/legacyPerspective* presets to a flat (identity) front face (D1-G2)', () => {
		// 2026-09 COM ground truth (see `visual-3d-camera-homography`'s module
		// doc comment): a flat shape's front face renders pixel-identical to
		// orthographicFront under every one of these presets, extruded or not
		// -- only an EXTRUDED shape's side panels pick up any oblique/legacy
		// perspective skew. The old expectation ("every preset must carry a
		// non-flat perspective distance") encoded the pre-fix, COM-disproven
		// behaviour.
		const legacyPresets = [
			'legacyObliqueTopLeft',
			'legacyObliqueTop',
			'legacyObliqueTopRight',
			'legacyObliqueLeft',
			'legacyObliqueFront',
			'legacyObliqueRight',
			'legacyObliqueBottomLeft',
			'legacyObliqueBottom',
			'legacyObliqueBottomRight',
			'legacyPerspectiveTopLeft',
			'legacyPerspectiveTop',
			'legacyPerspectiveTopRight',
			'legacyPerspectiveLeft',
			'legacyPerspectiveFront',
			'legacyPerspectiveRight',
			'legacyPerspectiveBottomLeft',
			'legacyPerspectiveBottom',
			'legacyPerspectiveBottomRight',
		];
		for (const cameraPreset of legacyPresets) {
			const result = getCameraTransform({ cameraPreset });
			// Flat front face: no separate perspective AND no matrix3d (an
			// identity homography is intentionally omitted, see
			// `isIdentityHomography`'s doc comment).
			expect(result.perspective).toBeUndefined();
			expect(result.matrix3d).toBeUndefined();
			expect(result.cameraFlatFace).toBeTruthy();
		}
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

	it('rotates the top bevel highlight to the lightRigDirection COM-measured cardinal edge', () => {
		const shape3d = { bevelTopType: 'circle', bevelTopWidth: 28575, bevelTopHeight: 28575 };
		// dir="t": highlight is a pure vertical offset (dx=0), toward the top
		// (negative Y), per `visual-3d-bevel-light`'s measured mapping.
		const top = get3DBevelShadow(shape3d, 't')!;
		expect(top).toMatch(/inset 0px -\d+px/);
		// dir="r": highlight is a pure horizontal offset (dy=0), toward the
		// right (positive X).
		const right = get3DBevelShadow(shape3d, 'r')!;
		expect(right).toMatch(/inset \d+px 0px/);
		// No direction at all keeps the pre-existing top-left diagonal default.
		const defaultDir = get3DBevelShadow(shape3d)!;
		expect(defaultDir).toMatch(/inset -\d+px -\d+px/);
	});

	// COM-measured 2026-09 (12-profile x 8-direction campaign, see
	// `visual-3d-bevel-light`'s module doc comment): `softRound` lit up the
	// OPPOSITE cardinal edge from every other profile under the same
	// lightRigDirection.
	it('inverts the highlight direction for softRound relative to circle', () => {
		const circle = get3DBevelShadow(
			{ bevelTopType: 'circle', bevelTopWidth: 28575, bevelTopHeight: 28575 },
			't',
		)!;
		const softRound = get3DBevelShadow(
			{ bevelTopType: 'softRound', bevelTopWidth: 28575, bevelTopHeight: 28575 },
			't',
		)!;
		// circle dir="t" highlights (the white rgba layer) toward the top
		// (negative Y offset)...
		expect(circle).toMatch(/inset 0px -\d+px \d+px rgba\(255,255,255,/);
		// ...softRound dir="t" highlights toward the bottom (positive Y offset).
		expect(softRound).toMatch(/inset 0px \d+px \d+px rgba\(255,255,255,/);
		expect(softRound).not.toMatch(/inset 0px -\d+px \d+px rgba\(255,255,255,/);
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

	it('includes an exact matrix3d + willChange for a camera preset', () => {
		const result = get3DTransformStyle({ cameraPreset: 'perspectiveFront' });
		expect(result.perspective).toBeUndefined();
		expect(result.transform).toContain('matrix3d(');
		expect(result.transformOrigin).toBe('0 0');
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

	it('does not synthesize a ground shadow from a bare backdrop (COM-measured: no visible effect)', () => {
		const base: MutableCss = {};
		apply3dEffects(base, { hasBackdrop: true }, undefined);
		expect(base.boxShadow).toBeUndefined();
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
		expect(base.transform).toContain('matrix3d(');
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
		expect(base.perspective).toBeUndefined();
		expect(base.transform).toContain('matrix3d(');
		expect(base.transformOrigin).toBe('0 0');
		expect(base.boxShadow).toContain('#4472C4');
		expect(base.boxShadow).toContain('inset');
		// The bare `hasBackdrop: true` above contributes no shadow of its own
		// (COM-measured: no visible effect without a real shadow present).
		expect(base.filter).toContain('brightness');
		expect(base.backgroundImage).toContain('linear-gradient');
		expect(base.willChange).toBe('transform');
	});
});
