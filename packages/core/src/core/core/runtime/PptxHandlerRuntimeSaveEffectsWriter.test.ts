import { describe, it, expect } from 'vitest';

import { clampUnitInterval } from '../../color/color-primitives';
import type { XmlObject, ShapeStyle } from '../../types';
import { PptxShapeEffectXmlBuilder } from '../builders/PptxShapeEffectXmlBuilder';
import { PptxShapeStyleExtractor } from '../builders/PptxShapeStyleExtractor';
import type { PptxShapeStyleExtractorContext } from '../builders/PptxShapeStyleExtractor';
import { applyScene3dStyle, applyShape3dStyle } from '../builders/shape-style-3d-helpers';
import { writeShapeEffects } from './save-shape-effects';

/**
 * `writeShapeEffects` exercised directly (the real production function - see
 * `save-shape-effects.ts`), driven through the REAL `PptxShapeStyleExtractor`
 * and `PptxShapeEffectXmlBuilder` so both the effect-list assembly AND the
 * inheritance gate (`effectIsPurelyStyleMatrix`) are pinned by production
 * code, not a reimplementation.
 *
 * This suite used to keep its own copy of `applyEffectsAndThreeD` ("its
 * mixin chain crashes on load"), which is why the theme-effectRef
 * inheritance-flattening bug (a shape painted only by `<a:effectRef>` got a
 * literal `spPr/a:effectLst` baked in on the very next save, permanently
 * outranking the reference) went unnoticed: the writer was never actually
 * imported. `writeShapeEffects` is a free function specifically so this
 * suite - and the runtime mixin - both call the same code.
 */

const EMU_PER_PX = 9525;

const effectBuilder = new PptxShapeEffectXmlBuilder({ emuPerPx: EMU_PER_PX, clampUnitInterval });

/** Resolved shadow our stub theme hands back for `a:effectRef idx="2"`. */
const THEME_SHADOW_COLOR = '#404040';

const parseColor = (node: XmlObject | undefined): string | undefined => {
	const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
	return srgb?.['@_val'] ? `#${String(srgb['@_val'])}` : undefined;
};

/**
 * Stand-in for `PptxHandlerRuntimeThemeRefResolution.resolveThemeEffectRef`:
 * writes the same fields (guarded the same way, `if (... && !style.x)`) the
 * real resolver writes, which is all the baseline capture in
 * `PptxShapeStyleExtractor` depends on.
 */
function createExtractor(): PptxShapeStyleExtractor {
	const context = {
		emuPerPx: EMU_PER_PX,
		parseColor,
		extractColorOpacity: () => undefined,
		extractGradientFillColor: () => undefined,
		extractGradientOpacity: () => undefined,
		extractGradientFillCss: () => undefined,
		extractGradientStops: () => [],
		extractGradientAngle: () => 0,
		extractGradientType: () => 'linear' as const,
		extractGradientPathType: () => undefined,
		extractGradientFocalPoint: () => undefined,
		extractGradientFillToRect: () => undefined,
		extractGradientFlip: () => undefined,
		extractGradientRotWithShape: () => undefined,
		extractGradientScaled: () => undefined,
		normalizeStrokeDashType: () => undefined,
		normalizeConnectorArrowType: () => undefined,
		ensureArray: (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]),
		resolveThemeFillRef: () => {},
		resolveThemeLineRef: () => {},
		resolveThemeEffectRef: (_refNode: XmlObject, style: ShapeStyle) => {
			style.effectRefIdx = 2;
			if (!style.shadowColor) {
				style.shadowColor = THEME_SHADOW_COLOR;
				style.shadowBlur = 4;
				style.shadowOffsetX = 2;
				style.shadowOffsetY = 2;
				style.shadowOpacity = 0.4;
			}
		},
		extractShadowStyle: () => ({}),
		extractInnerShadowStyle: () => ({}),
		extractGlowStyle: () => ({}),
		extractSoftEdgeStyle: () => ({}),
		extractReflectionStyle: () => ({}),
		extractBlurStyle: () => ({}),
		extractEffectDagStyle: () => ({}),
		extractFillOverlayStyle: () => ({}),
	} as unknown as PptxShapeStyleExtractorContext;
	return new PptxShapeStyleExtractor(context);
}

/** The `<p:style>` PowerPoint writes on an ordinary themed shape with a shadow. */
const STYLE_NODE: XmlObject = {
	'a:effectRef': { '@_idx': '2', 'a:schemeClr': { '@_val': 'accent1' } },
};

/** Build the effect XML the runtime would (via `PptxShapeEffectXmlBuilder`) and write it onto `spPr`. */
function writeEffects(spPr: XmlObject, style: ShapeStyle): XmlObject {
	const presetShadowXml = style.presetShadowName
		? effectBuilder.buildPresetShadowXml(style)
		: undefined;
	writeShapeEffects(spPr, style, {
		outerShadowXml: presetShadowXml ? undefined : effectBuilder.buildOuterShadowXml(style),
		presetShadowXml,
		innerShadowXml: effectBuilder.buildInnerShadowXml(style),
		glowXml: effectBuilder.buildGlowXml(style),
		softEdgeXml: effectBuilder.buildSoftEdgeXml(style),
		reflectionXml: effectBuilder.buildReflectionXml(style),
		blurXml: effectBuilder.buildBlurXml(style),
	});
	return spPr;
}

/** Load `spPr` + `p:style`, then save the (optionally edited) effects back onto it. */
function roundTrip(spPr: XmlObject, edit: (style: ShapeStyle) => void = () => {}): XmlObject {
	const style = createExtractor().extractShapeStyle(spPr, STYLE_NODE);
	edit(style);
	return writeEffects(spPr, style);
}

// ---------------------------------------------------------------------------
// The inheritance-flattening regression: a shape painted only by
// `<a:effectRef>` must not gain a literal `spPr/a:effectLst`.
// ---------------------------------------------------------------------------
describe('effect style-matrix references survive a save', () => {
	it('leaves spPr effect-less when a:effectRef alone paints the shape', () => {
		const style = createExtractor().extractShapeStyle(
			{ 'a:prstGeom': { '@_prst': 'rect' } },
			STYLE_NODE,
		);
		// Sanity: the theme really did resolve a shadow into the flat style -
		// the renderer needs this even though it must not be saved back.
		expect(style.shadowColor).toBe(THEME_SHADOW_COLOR);
		expect(style.inheritedEffectStyle).toBeDefined();

		const spPr = writeEffects({ 'a:prstGeom': { '@_prst': 'rect' } }, style);
		expect(spPr['a:effectLst']).toBeUndefined();
		expect(spPr['a:scene3d']).toBeUndefined();
		expect(spPr['a:sp3d']).toBeUndefined();
	});

	it('still writes the effectRef idx itself (unaffected by the effectLst gate)', () => {
		const style = createExtractor().extractShapeStyle(
			{ 'a:prstGeom': { '@_prst': 'rect' } },
			STYLE_NODE,
		);
		expect(style.effectRefIdx).toBe(2);
	});

	it('writes a literal effectLst once the inherited shadow is edited', () => {
		const spPr = roundTrip({ 'a:prstGeom': { '@_prst': 'rect' } }, (style) => {
			style.shadowColor = '#FF00FF';
		});
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst).toBeDefined();
		const outer = effectLst['a:outerShdw'] as XmlObject;
		expect((outer['a:srgbClr'] as XmlObject)['@_val']).toBe('FF00FF');
	});

	it('bakes the full resolved effect set once a NEW effect is added on top', () => {
		// Adding a glow the theme never granted is a real edit: PowerPoint
		// itself bakes the whole effectLst (including the inherited shadow) the
		// moment any part of it is touched, because `a:effectLst` is a single
		// element, not independently-overridable attributes.
		const spPr = roundTrip({ 'a:prstGeom': { '@_prst': 'rect' } }, (style) => {
			style.glowColor = '#00FF00';
			style.glowRadius = 5;
			style.glowOpacity = 1;
		});
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:glow']).toBeDefined();
		expect(effectLst['a:outerShdw']).toBeDefined();
	});

	it('writes an explicit "no effects" when every inherited effect is cleared', () => {
		const spPr = roundTrip({ 'a:prstGeom': { '@_prst': 'rect' } }, (style) => {
			style.shadowColor = undefined;
		});
		expect(spPr['a:effectLst']).toBeUndefined();
	});

	it('still writes the effects of a shape that authored its own (no baseline recorded)', () => {
		// No `<p:style>` at all: the extractor never consults `a:effectRef`, so
		// no baseline is recorded and the writer behaves exactly as before.
		const style = createExtractor().extractShapeStyle({});
		style.shadowColor = '#123456';
		style.shadowBlur = 8;
		const spPr = writeEffects({}, style);
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect((effectLst['a:outerShdw'] as XmlObject)['a:srgbClr']).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// The empty-effectLst guard (PptxShapeStyleExtractor) must still work
// alongside the new gate: an authored `<a:effectLst/>` means "no effects",
// not "theme, please decide" and not "bake the theme shadow in".
// ---------------------------------------------------------------------------
describe('authored empty effectLst ("no effects") survives the new gate', () => {
	it('does not resolve the theme shadow onto the flat style', () => {
		const style = createExtractor().extractShapeStyle({ 'a:effectLst': {} }, STYLE_NODE);
		expect(style.shadowColor).toBeUndefined();
		// Nothing was inherited (it was explicitly suppressed), so there is no
		// style-matrix baseline to compare future edits against.
		expect(style.inheritedEffectStyle).toBeUndefined();
		// The reference itself still round-trips.
		expect(style.effectRefIdx).toBe(2);
	});

	it('round-trips back to no effectLst at all', () => {
		const spPr = roundTrip({ 'a:effectLst': {} });
		expect(spPr['a:effectLst']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Tests: effect list assembly (unchanged behaviour for shapes with no
// style-matrix baseline - i.e. every shape built by the SDK or authoring its
// own effects directly).
// ---------------------------------------------------------------------------
describe('writeShapeEffects - effect list assembly', () => {
	it('should create effectLst with outer shadow', () => {
		const spPr: XmlObject = {};
		const shadow: XmlObject = { '@_blurRad': '38100' };
		writeShapeEffects(spPr, {}, { outerShadowXml: shadow });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:outerShdw']).toBe(shadow);
	});

	it('should create effectLst with multiple effects', () => {
		const spPr: XmlObject = {};
		const shadow: XmlObject = { '@_blurRad': '38100' };
		const glow: XmlObject = { '@_rad': '50800' };
		const blur: XmlObject = { '@_rad': '25400' };
		writeShapeEffects(spPr, {}, { outerShadowXml: shadow, glowXml: glow, blurXml: blur });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:outerShdw']).toBe(shadow);
		expect(effectLst['a:glow']).toBe(glow);
		expect(effectLst['a:blur']).toBe(blur);
	});

	it('should merge into existing effectLst', () => {
		const existing: XmlObject = { 'a:outerShdw': { '@_blurRad': '10000' } };
		const spPr: XmlObject = { 'a:effectLst': existing };
		const glow: XmlObject = { '@_rad': '50800' };
		writeShapeEffects(spPr, {}, { glowXml: glow });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		// Existing outer shadow stays, glow is added
		expect(effectLst['a:outerShdw']).toStrictEqual({ '@_blurRad': '10000' });
		expect(effectLst['a:glow']).toBe(glow);
	});

	it('should remove outer shadow from effectLst when shadowColor is set but builder returns undefined', () => {
		const spPr: XmlObject = {
			'a:effectLst': {
				'a:outerShdw': { '@_blurRad': '38100' },
				'a:glow': { '@_rad': '1000' },
			},
		};
		writeShapeEffects(spPr, { shadowColor: '#000000' }, {});
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:outerShdw']).toBeUndefined();
		expect(effectLst['a:glow']).toBeDefined();
	});

	it('should remove inner shadow from effectLst when innerShadowColor is set but builder returns undefined', () => {
		const spPr: XmlObject = {
			'a:effectLst': {
				'a:innerShdw': { '@_blurRad': '38100' },
				'a:glow': { '@_rad': '5000' },
			},
		};
		writeShapeEffects(spPr, { innerShadowColor: '#FF0000' }, {});
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:innerShdw']).toBeUndefined();
		expect(effectLst['a:glow']).toBeDefined();
	});

	it('should delete effectLst entirely when it becomes empty', () => {
		const spPr: XmlObject = {
			'a:effectLst': { 'a:outerShdw': {} },
		};
		writeShapeEffects(spPr, { shadowColor: '#000' }, {});
		expect(spPr['a:effectLst']).toBeUndefined();
	});

	it('should set effectDag from shapeStyle', () => {
		const spPr: XmlObject = {};
		const dag: XmlObject = { 'a:grayscl': {} };
		writeShapeEffects(spPr, { effectDagXml: dag }, {});
		expect(spPr['a:effectDag']).toBe(dag);
	});

	// D1-G3: direct a:effectLst/a:fillOverlay (distinct from effectDag's form)
	it('should create effectLst with a direct fillOverlay', () => {
		const spPr: XmlObject = {};
		const fillOverlay: XmlObject = { '@_blend': 'mult' };
		writeShapeEffects(spPr, {}, { fillOverlayXml: fillOverlay });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:fillOverlay']).toBe(fillOverlay);
	});

	it('should remove fillOverlay from effectLst when shapeFillOverlayColor is set but builder returns undefined', () => {
		const spPr: XmlObject = {
			'a:effectLst': {
				'a:fillOverlay': { '@_blend': 'mult' },
				'a:glow': { '@_rad': '1000' },
			},
		};
		writeShapeEffects(spPr, { shapeFillOverlayColor: '#FF0000' }, {});
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:fillOverlay']).toBeUndefined();
		expect(effectLst['a:glow']).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Tests: 3D Scene serialization
// ---------------------------------------------------------------------------
describe('writeShapeEffects - 3D Scene', () => {
	it('should write scene3d with camera preset and light rig', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(
			spPr,
			{
				scene3d: {
					cameraPreset: 'orthographicFront',
					lightRigType: 'threePt',
					lightRigDirection: 't',
				},
			},
			{},
		);
		const scene = spPr['a:scene3d'] as XmlObject;
		expect(scene).toBeDefined();
		expect((scene['a:camera'] as XmlObject)['@_prst']).toBe('orthographicFront');
		const lightRig = scene['a:lightRig'] as XmlObject;
		expect(lightRig['@_rig']).toBe('threePt');
		expect(lightRig['@_dir']).toBe('t');
	});

	it('should include camera rotation when set', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(
			spPr,
			{
				scene3d: {
					cameraPreset: 'perspectiveFront',
					cameraRotX: 1000000,
					cameraRotY: 2000000,
					cameraRotZ: 3000000,
				},
			},
			{},
		);
		const camera = (spPr['a:scene3d'] as XmlObject)['a:camera'] as XmlObject;
		const rot = camera['a:rot'] as XmlObject;
		expect(rot['@_lat']).toBe('1000000');
		expect(rot['@_lon']).toBe('2000000');
		expect(rot['@_rev']).toBe('3000000');
	});

	it('should emit a valid backdrop (anchor + norm + up) when vectors are present', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(
			spPr,
			{
				scene3d: {
					cameraPreset: 'orthographicFront',
					hasBackdrop: true,
					backdropAnchorX: 100,
					backdropAnchorY: 200,
					backdropAnchorZ: 300,
					backdropNormalX: 0,
					backdropNormalY: 0,
					backdropNormalZ: 1,
					backdropUpX: 0,
					backdropUpY: 1,
					backdropUpZ: 0,
				},
			},
			{},
		);
		const scene = spPr['a:scene3d'] as XmlObject;
		const backdrop = scene['a:backdrop'] as XmlObject;
		expect(backdrop).toBeDefined();
		const anchor = backdrop['a:anchor'] as XmlObject;
		expect(anchor['@_x']).toBe('100');
		expect(anchor['@_z']).toBe('300');
		expect(backdrop['a:norm']).toStrictEqual({ '@_dx': '0', '@_dy': '0', '@_dz': '1' });
		expect(backdrop['a:up']).toStrictEqual({ '@_dx': '0', '@_dy': '1', '@_dz': '0' });
	});

	it('scales a fractional backdrop norm/up to integer ST_Coordinate values instead of writing invalid decimal attributes', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(
			spPr,
			{
				scene3d: {
					cameraPreset: 'orthographicFront',
					hasBackdrop: true,
					backdropAnchorX: 1.6,
					backdropAnchorY: 2.4,
					backdropAnchorZ: 0,
					// A normalised unit vector, as a caller constructing a
					// `ShapeStyle` directly (rather than round-tripping a
					// parsed file, which only ever produces integers) might
					// naturally write.
					backdropNormalX: 0.7071,
					backdropNormalY: 0.7071,
					backdropNormalZ: 0,
					backdropUpX: 0,
					backdropUpY: 1,
					backdropUpZ: 0,
				},
			},
			{},
		);
		const scene = spPr['a:scene3d'] as XmlObject;
		const backdrop = scene['a:backdrop'] as XmlObject;
		const anchor = backdrop['a:anchor'] as XmlObject;
		// Anchor (a position) rounds each component independently.
		expect(anchor['@_x']).toBe('2');
		expect(anchor['@_y']).toBe('2');
		const norm = backdrop['a:norm'] as XmlObject;
		for (const attr of ['@_dx', '@_dy', '@_dz']) {
			expect(Number.isInteger(Number(norm[attr]))).toBeTruthy();
		}
		// The ratio between dx and dy is preserved (both components equal).
		expect(norm['@_dx']).toBe(norm['@_dy']);
		expect(norm['@_dz']).toBe('0');
	});

	it('should omit a partial backdrop missing norm/up (schema-invalid)', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(
			spPr,
			{
				scene3d: {
					cameraPreset: 'orthographicFront',
					hasBackdrop: true,
					backdropAnchorX: 100,
					backdropAnchorY: 200,
					backdropAnchorZ: 300,
				},
			},
			{},
		);
		const scene = spPr['a:scene3d'] as XmlObject;
		expect(scene['a:backdrop']).toBeUndefined();
	});

	it('should delete scene3d when scene3d has no data', () => {
		const spPr: XmlObject = { 'a:scene3d': { 'a:camera': {} } };
		writeShapeEffects(spPr, { scene3d: {} }, {});
		expect(spPr['a:scene3d']).toBeUndefined();
	});

	it('should delete scene3d when scene3d is undefined on shapeStyle', () => {
		const spPr: XmlObject = { 'a:scene3d': { 'a:camera': {} } };
		writeShapeEffects(spPr, {}, {});
		expect(spPr['a:scene3d']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Tests: 3D Shape serialization
// ---------------------------------------------------------------------------
describe('writeShapeEffects - 3D Shape', () => {
	it('should write sp3d with extrusion height and material', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(
			spPr,
			{
				shape3d: {
					extrusionHeight: 76200,
					presetMaterial: 'metal',
				},
			},
			{},
		);
		const sp3d = spPr['a:sp3d'] as XmlObject;
		expect(sp3d['@_extrusionH']).toBe('76200');
		expect(sp3d['@_prstMaterial']).toBe('metal');
	});

	it('should write top and bottom bevels', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(
			spPr,
			{
				shape3d: {
					bevelTopType: 'circle',
					bevelTopWidth: 12700,
					bevelTopHeight: 25400,
					bevelBottomType: 'relaxedInset',
					bevelBottomWidth: 6350,
					bevelBottomHeight: 6350,
				},
			},
			{},
		);
		const sp3d = spPr['a:sp3d'] as XmlObject;
		const bevelT = sp3d['a:bevelT'] as XmlObject;
		expect(bevelT['@_prst']).toBe('circle');
		expect(bevelT['@_w']).toBe('12700');
		expect(bevelT['@_h']).toBe('25400');
		const bevelB = sp3d['a:bevelB'] as XmlObject;
		expect(bevelB['@_prst']).toBe('relaxedInset');
	});

	it('should write contour and extrusion colours', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(
			spPr,
			{
				shape3d: {
					extrusionColor: '4F81BD',
					contourColor: 'FF0000',
					contourWidth: 12700,
				},
			},
			{},
		);
		const sp3d = spPr['a:sp3d'] as XmlObject;
		expect(sp3d['a:extrusionClr']).toStrictEqual({
			'a:srgbClr': { '@_val': '4F81BD' },
		});
		expect(sp3d['a:contourClr']).toStrictEqual({
			'a:srgbClr': { '@_val': 'FF0000' },
		});
		expect(sp3d['@_contourW']).toBe('12700');
	});

	it('should write z position', () => {
		const spPr: XmlObject = {};
		writeShapeEffects(spPr, { shape3d: { positionZ: 50000 } }, {});
		const sp3d = spPr['a:sp3d'] as XmlObject;
		expect(sp3d['@_z']).toBe('50000');
	});

	it('should delete sp3d when shape3d has no data', () => {
		const spPr: XmlObject = { 'a:sp3d': { '@_extrusionH': '0' } };
		writeShapeEffects(spPr, { shape3d: {} }, {});
		expect(spPr['a:sp3d']).toBeUndefined();
	});

	it('should delete sp3d when shape3d is undefined on shapeStyle', () => {
		const spPr: XmlObject = { 'a:sp3d': {} };
		writeShapeEffects(spPr, {}, {});
		expect(spPr['a:sp3d']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Regression: sp3d extrusion colour + scene3d fov/zoom round-trip (issues 67/86)
// ---------------------------------------------------------------------------
describe('3D round-trip: parse -> save', () => {
	it('writes a valid #-free srgbClr val for extrusion/contour colour', () => {
		const source: XmlObject = {
			'a:sp3d': {
				'@_extrusionH': '76200',
				'a:extrusionClr': { 'a:srgbClr': { '@_val': '4F81BD' } },
				'a:contourClr': { 'a:srgbClr': { '@_val': 'FF0000' } },
			},
		};
		const style: ShapeStyle = {} as ShapeStyle;
		applyShape3dStyle(source, style, { parseColor });
		// The parsed model carries a leading '#'.
		expect(style.shape3d?.extrusionColor).toBe('#4F81BD');

		const spPr: XmlObject = {};
		writeShapeEffects(spPr, style, {});
		const sp3d = spPr['a:sp3d'] as XmlObject;
		const extVal = (sp3d['a:extrusionClr'] as XmlObject)['a:srgbClr'] as XmlObject;
		const conVal = (sp3d['a:contourClr'] as XmlObject)['a:srgbClr'] as XmlObject;
		expect(extVal['@_val']).toBe('4F81BD');
		expect(conVal['@_val']).toBe('FF0000');
		expect(String(extVal['@_val'])).not.toContain('#');
		expect(String(conVal['@_val'])).not.toContain('#');
	});

	it('preserves sp3d/@z (position) across the round-trip', () => {
		const source: XmlObject = {
			'a:sp3d': { '@_z': '25400', '@_extrusionH': '76200' },
		};
		const style: ShapeStyle = {} as ShapeStyle;
		applyShape3dStyle(source, style, { parseColor });
		expect(style.shape3d?.positionZ).toBe(25400);

		const spPr: XmlObject = {};
		writeShapeEffects(spPr, style, {});
		const sp3d = spPr['a:sp3d'] as XmlObject;
		expect(sp3d['@_z']).toBe('25400');
	});

	it('preserves camera fov/zoom and light-rig rotation across the round-trip', () => {
		const source: XmlObject = {
			'a:scene3d': {
				'a:camera': {
					'@_prst': 'perspectiveFront',
					'@_fov': '600000',
					'@_zoom': '150000',
					'a:rot': { '@_lat': '1000', '@_lon': '2000', '@_rev': '3000' },
				},
				'a:lightRig': {
					'@_rig': 'threePt',
					'@_dir': 't',
					'a:rot': { '@_lat': '10', '@_lon': '20', '@_rev': '30' },
				},
			},
		};
		const style: ShapeStyle = {} as ShapeStyle;
		applyScene3dStyle(source, style);
		expect(style.scene3d?.cameraFieldOfView).toBe(600000);
		expect(style.scene3d?.cameraZoom).toBe(150000);
		expect(style.scene3d?.lightRigRotX).toBe(10);

		const spPr: XmlObject = { 'a:scene3d': source['a:scene3d'] };
		writeShapeEffects(spPr, style, {});
		const scene = spPr['a:scene3d'] as XmlObject;
		const camera = scene['a:camera'] as XmlObject;
		expect(camera['@_fov']).toBe('600000');
		expect(camera['@_zoom']).toBe('150000');
		const lightRig = scene['a:lightRig'] as XmlObject;
		const lrRot = lightRig['a:rot'] as XmlObject;
		expect(lrRot['@_lat']).toBe('10');
		expect(lrRot['@_rev']).toBe('30');
	});

	it('round-trips a valid backdrop (anchor + norm + up)', () => {
		const source: XmlObject = {
			'a:scene3d': {
				'a:camera': { '@_prst': 'orthographicFront' },
				'a:backdrop': {
					'a:anchor': { '@_x': '1', '@_y': '2', '@_z': '3' },
					'a:norm': { '@_dx': '0', '@_dy': '0', '@_dz': '1' },
					'a:up': { '@_dx': '0', '@_dy': '1', '@_dz': '0' },
				},
			},
		};
		const style: ShapeStyle = {} as ShapeStyle;
		applyScene3dStyle(source, style);
		expect(style.scene3d?.backdropNormalZ).toBe(1);
		expect(style.scene3d?.backdropUpY).toBe(1);

		const spPr: XmlObject = { 'a:scene3d': source['a:scene3d'] };
		writeShapeEffects(spPr, style, {});
		const backdrop = (spPr['a:scene3d'] as XmlObject)['a:backdrop'] as XmlObject;
		expect(backdrop['a:anchor']).toBeDefined();
		expect(backdrop['a:norm']).toStrictEqual({ '@_dx': '0', '@_dy': '0', '@_dz': '1' });
		expect(backdrop['a:up']).toStrictEqual({ '@_dx': '0', '@_dy': '1', '@_dz': '0' });
	});
});
