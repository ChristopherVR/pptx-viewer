/**
 * A WordArt style as `TextStyle` fields: the run formatting (fill, outline,
 * effects, bold, spacing, caps) and the body 3-D (bevel, material, scene),
 * resolved against the deck theme exactly as the load path resolves the
 * captured XML, with the colour nodes kept so the writer re-emits
 * `a:schemeClr` + transforms where `TextStyle` can carry them (run fill,
 * inner shadow, glow).
 *
 * Known writer limits (the style still renders and saves, but these parts
 * are written as flat sRGB or dropped): the outline colour and outer shadow
 * colour are written as `a:srgbClr`, a gradient outline as its first stop's
 * colour, the double (`cmpd="dbl"`) outline as single, and the bevel contour
 * colour/width are not modelled by `Text3DStyle`.
 *
 * @module render/ribbon-galleries/wordart-run-style
 */
import type { BevelPresetType, MaterialPresetType, TextStyle } from 'pptx-viewer-core';
import { ooxmlGradientAngleToCssDegrees } from 'pptx-viewer-core';

import { resolveColorSpec } from './gallery-color-spec';
import type { WordArtPaint, WordArtShadow, WordArtStyleSpec } from './wordart-style-spec';

const EMU_PER_PX = 9525;
type ColorMap = Readonly<Record<string, string>> | undefined;

/** Every run field a WordArt pick owns: cleared first, then set from the style. */
export const WORDART_RUN_KEYS: ReadonlyArray<keyof TextStyle> = [
	'textFillNone',
	'color',
	'colorXml',
	'colorRef',
	'textFillGradient',
	'textFillGradientStops',
	'textFillGradientAngle',
	'textFillGradientType',
	'textFillPattern',
	'textFillPatternForeground',
	'textFillPatternBackground',
	'textFillBlipXml',
	'textFillBlipUrl',
	'textFillBlipMode',
	'textOutlineWidth',
	'textOutlineColor',
	'textOutlineDash',
	'textShadowColor',
	'textShadowBlur',
	'textShadowOffsetX',
	'textShadowOffsetY',
	'textShadowOpacity',
	'textInnerShadowColor',
	'textInnerShadowOpacity',
	'textInnerShadowBlur',
	'textInnerShadowOffsetX',
	'textInnerShadowOffsetY',
	'textInnerShadowColorXml',
	'textInnerShadowColorRef',
	'textPresetShadowName',
	'textPresetShadowColor',
	'textPresetShadowOpacity',
	'textPresetShadowDistance',
	'textPresetShadowDirection',
	'textGlowColor',
	'textGlowRadius',
	'textGlowOpacity',
	'textGlowColorXml',
	'textGlowColorRef',
	'textReflection',
	'textReflectionBlur',
	'textReflectionStartOpacity',
	'textReflectionEndOpacity',
	'textReflectionEndPosition',
	'textReflectionOffset',
	'textReflectionDirection',
	'textReflectionFadeDirection',
	'textReflectionScaleX',
	'textReflectionScaleY',
	'textReflectionSkewX',
	'textReflectionSkewY',
	'textReflectionRotation',
	'textReflectionAlignment',
	'textEffectsExplicitNone',
	'characterSpacing',
	'textCaps',
	'textCapsExplicitNone',
];

function firstColor(paint: WordArtPaint): string {
	return typeof paint === 'string' ? paint : (paint.stops[0]?.[1] ?? '#000000');
}

function fillFields(paint: WordArtPaint | 'none', colors: ColorMap): Partial<TextStyle> {
	if (paint === 'none') {
		return { textFillNone: true };
	}
	if (typeof paint === 'string') {
		const c = resolveColorSpec(paint, colors);
		return {
			textFillNone: false,
			color: c.hex,
			colorXml: c.xml,
			...(c.ref && { colorRef: c.ref }),
		};
	}
	const stops = paint.stops.map(([pos, spec]) => {
		const c = resolveColorSpec(spec, colors);
		return {
			color: c.hex,
			position: pos / 1000,
			...(c.opacity !== undefined && { opacity: c.opacity }),
		};
	});
	const angle = paint.ang / 60000;
	return {
		textFillNone: false,
		textFillGradient: `linear-gradient(${ooxmlGradientAngleToCssDegrees(angle)}deg, ${stops
			.map((s) => `${s.color} ${s.position}%`)
			.join(', ')})`,
		textFillGradientStops: stops,
		textFillGradientAngle: angle,
		textFillGradientType: 'linear',
	};
}

function offsets([, dist, dir]: WordArtShadow): { x: number; y: number } {
	const rad = ((dir / 60000) * Math.PI) / 180;
	return { x: (Math.cos(rad) * dist) / EMU_PER_PX, y: (Math.sin(rad) * dist) / EMU_PER_PX };
}

function effectFields(spec: WordArtStyleSpec, colors: ColorMap): Partial<TextStyle> {
	const out: Partial<TextStyle> = {};
	if (spec.outer) {
		const c = resolveColorSpec(spec.outer[3], colors);
		const { x, y } = offsets(spec.outer);
		Object.assign(out, {
			textShadowColor: c.hex,
			textShadowBlur: spec.outer[0] / EMU_PER_PX,
			textShadowOffsetX: x,
			textShadowOffsetY: y,
			...(c.opacity !== undefined && { textShadowOpacity: c.opacity }),
		});
	}
	if (spec.inner) {
		const c = resolveColorSpec(spec.inner[3], colors);
		const { x, y } = offsets(spec.inner);
		Object.assign(out, {
			textInnerShadowColor: c.hex,
			textInnerShadowBlur: spec.inner[0] / EMU_PER_PX,
			textInnerShadowOffsetX: x,
			textInnerShadowOffsetY: y,
			textInnerShadowColorXml: c.xml,
			...(c.ref && { textInnerShadowColorRef: c.ref }),
			...(c.opacity !== undefined && { textInnerShadowOpacity: c.opacity }),
		});
	}
	if (spec.glow) {
		const c = resolveColorSpec(spec.glow[1], colors);
		Object.assign(out, {
			textGlowColor: c.hex,
			textGlowRadius: spec.glow[0] / EMU_PER_PX,
			textGlowColorXml: c.xml,
			...(c.ref && { textGlowColorRef: c.ref }),
			...(c.opacity !== undefined && { textGlowOpacity: c.opacity }),
		});
	}
	if (spec.reflection) {
		const r = spec.reflection;
		Object.assign(out, {
			textReflection: true,
			textReflectionBlur: r.blur / EMU_PER_PX,
			textReflectionStartOpacity: r.stA / 100000,
			textReflectionEndPosition: r.endPos / 100000,
			textReflectionOffset: r.dist / EMU_PER_PX,
			textReflectionDirection: 90,
			textReflectionScaleY: -100000,
			...(r.algn && { textReflectionAlignment: r.algn }),
		});
	}
	return out;
}

/** The run fields style `spec` writes (every owned key present, cleared ones as undefined). */
export function wordArtRunStyle(spec: WordArtStyleSpec, colors: ColorMap): Partial<TextStyle> {
	const run: Partial<TextStyle> = Object.fromEntries(
		WORDART_RUN_KEYS.map((key) => [key, undefined]),
	);
	Object.assign(run, fillFields(spec.fill, colors), effectFields(spec, colors));
	if (spec.ln?.w !== undefined) {
		run.textOutlineWidth = spec.ln.w / EMU_PER_PX;
	}
	if (spec.ln?.fill) {
		run.textOutlineColor = resolveColorSpec(firstColor(spec.ln.fill), colors).hex;
	}
	if (spec.b) {
		run.bold = true;
	}
	if (spec.spc) {
		run.characterSpacing = spec.spc;
	}
	if (spec.caps) {
		run.textCaps = 'all';
	}
	return run;
}

/** The body 3-D fields (`text3d` + `textBodyScene3d`), cleared for a flat style. */
export function wordArtBodyStyle(
	spec: WordArtStyleSpec,
): Pick<TextStyle, 'text3d' | 'textBodyScene3d'> {
	const body = spec.body3d;
	if (!body) {
		return { text3d: undefined, textBodyScene3d: undefined };
	}
	return {
		text3d: {
			...(body.extrusionH !== undefined && { extrusionHeight: body.extrusionH }),
			...(body.material && { presetMaterial: body.material as MaterialPresetType }),
			bevelTopType: (body.bevel.prst ?? 'circle') as BevelPresetType,
			bevelTopWidth: body.bevel.w,
			bevelTopHeight: body.bevel.h,
		},
		textBodyScene3d: {
			cameraPreset: 'orthographicFront',
			lightRigType: body.rig,
			lightRigDirection: body.rigDir,
			...(body.rev !== undefined && { lightRigRotX: 0, lightRigRotY: 0, lightRigRotZ: body.rev }),
		},
	};
}
