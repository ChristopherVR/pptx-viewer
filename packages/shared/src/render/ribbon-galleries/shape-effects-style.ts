/**
 * Shape Effects picks as `ShapeStyle` edits. Each pick REPLACES exactly one
 * effect family (shadow, reflection, glow, soft edge, bevel, 3-D rotation)
 * and leaves every other family, the fill and the outline as they were,
 * which is what PowerPoint's Shape Effects menu does.
 *
 * Colours are written the way PowerPoint writes them: the black shadow
 * presets as `<a:prstClr val="black">` and the glow as `<a:schemeClr
 * val="accentN">`, by handing the effect writer the colour node as the
 * "original" XML with a matching resolved hex (`mergeEffectNode` re-emits a
 * colour choice verbatim while the resolved colour and opacity still agree).
 *
 * @module render/ribbon-galleries/shape-effects-style
 */
import type { ShapeStyle, XmlObject } from 'pptx-viewer-core';

import type { ReflectionPresetSpec, ShadowPresetSpec } from './shape-effects-catalog';
import { DEFAULT_SCENE_LIGHT_RIG, GLOW_ALPHA, REFLECTION_BLUR_EMU } from './shape-effects-catalog';

export const EMU_PER_PX = 9525;
export const EMU_PER_PT = 12700;

export type ShapeEffectFamily =
	| 'shadow'
	| 'reflection'
	| 'glow'
	| 'softEdge'
	| 'bevel'
	| 'rotation';

const FAMILY_KEYS: Record<'shadow' | 'reflection' | 'glow' | 'softEdge', RegExp> = {
	shadow: /^(shadow|outerShadow|innerShadow|presetShadow)/u,
	reflection: /^reflection/u,
	glow: /^glow/u,
	softEdge: /^softEdge/u,
};

const FAMILY_NODES: Record<'shadow' | 'reflection' | 'glow' | 'softEdge', readonly string[]> = {
	shadow: ['outerShdw', 'innerShdw', 'prstShdw'],
	reflection: ['reflection'],
	glow: ['glow'],
	softEdge: ['softEdge'],
};

function localName(key: string): string {
	return key.split(':').at(-1) ?? key;
}

/**
 * `style` with every key of an `a:effectLst` family removed, and that
 * family's node dropped from the preserved `effectListXml` (which the writer
 * starts from, so a stale node there would survive the pick). The preserved
 * list is kept, possibly empty, so the writer still writes an explicit
 * `a:effectLst`: an empty one is how PowerPoint says "no shadow" over a
 * theme `effectRef`.
 */
function withoutListFamily(
	style: ShapeStyle,
	family: 'shadow' | 'reflection' | 'glow' | 'softEdge',
): ShapeStyle {
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(style)) {
		if (!FAMILY_KEYS[family].test(key) && !(family === 'shadow' && key === 'shadows')) {
			next[key] = value;
		}
	}
	const list: XmlObject = {};
	for (const [key, value] of Object.entries(style.effectListXml ?? {})) {
		if (!FAMILY_NODES[family].includes(localName(key))) {
			list[key] = value;
		}
	}
	next.effectListXml = list;
	return next as ShapeStyle;
}

function prstBlack(alpha: number | undefined): XmlObject {
	return {
		'a:prstClr': {
			'@_val': 'black',
			...(alpha !== undefined && { 'a:alpha': { '@_val': String(alpha) } }),
		},
	};
}

/** Pixel offsets of a shadow `dist`/`dir` pair (for renderers that read offsets). */
export function shadowOffsets(distEmu: number, dir: number): { x: number; y: number } {
	const rad = ((dir / 60000) * Math.PI) / 180;
	const dist = distEmu / EMU_PER_PX;
	return { x: Math.cos(rad) * dist, y: Math.sin(rad) * dist };
}

/** Apply a shadow preset (or `null` for No Shadow). */
export function withShadowPreset(style: ShapeStyle, spec: ShadowPresetSpec | null): ShapeStyle {
	const next = withoutListFamily(style, 'shadow');
	if (!spec) {
		return next;
	}
	const opacity = spec.alpha !== undefined ? spec.alpha / 100000 : 1;
	const { x, y } = shadowOffsets(spec.distEmu, spec.dir);
	const colorXml = prstBlack(spec.alpha);
	if (spec.kind === 'inner') {
		return {
			...next,
			innerShadowColor: '#000000',
			innerShadowOpacity: opacity,
			innerShadowBlur: spec.blurEmu / EMU_PER_PX,
			innerShadowOffsetX: x,
			innerShadowOffsetY: y,
			innerShadowXml: colorXml,
			innerShadowOriginalColor: '#000000',
			innerShadowOriginalOpacity: opacity,
		};
	}
	return {
		...next,
		shadowColor: '#000000',
		shadowOpacity: opacity,
		shadowBlur: spec.blurEmu / EMU_PER_PX,
		shadowAngle: spec.dir / 60000,
		shadowDistance: spec.distEmu / EMU_PER_PX,
		shadowOffsetX: x,
		shadowOffsetY: y,
		...(spec.sx !== undefined && { shadowScaleX: spec.sx }),
		...(spec.sy !== undefined && { shadowScaleY: spec.sy }),
		...(spec.kx !== undefined && { shadowSkewX: spec.kx }),
		...(spec.algn && { shadowAlignment: spec.algn }),
		outerShadowXml: colorXml,
		outerShadowOriginalColor: '#000000',
		outerShadowOriginalOpacity: opacity,
	};
}

/** Apply a reflection preset (or `null` for No Reflection). */
export function withReflectionPreset(
	style: ShapeStyle,
	spec: ReflectionPresetSpec | null,
): ShapeStyle {
	const next = withoutListFamily(style, 'reflection');
	if (!spec) {
		return next;
	}
	return {
		...next,
		reflectionBlurRadius: REFLECTION_BLUR_EMU / EMU_PER_PX,
		reflectionStartOpacity: spec.stA / 100000,
		reflectionEndOpacity: spec.endA / 100000,
		reflectionEndPosition: spec.endPos / 100000,
		...(spec.distEmu > 0 && { reflectionDistance: spec.distEmu / EMU_PER_PX }),
		reflectionDirection: 90,
		reflectionScaleY: -100000,
		reflectionAlignment: 'bl',
		reflectionRotateWithShape: false,
	};
}

/** Apply a glow (`sizePt` x theme accent), or `null` for No Glow. */
export function withGlow(
	style: ShapeStyle,
	glow: { sizePt: number; scheme: string; hex: string } | null,
): ShapeStyle {
	const next = withoutListFamily(style, 'glow');
	if (!glow) {
		return next;
	}
	const opacity = GLOW_ALPHA / 100000;
	return {
		...next,
		glowColor: glow.hex,
		glowRadius: (glow.sizePt * EMU_PER_PT) / EMU_PER_PX,
		glowOpacity: opacity,
		glowXml: {
			'a:schemeClr': { '@_val': glow.scheme, 'a:alpha': { '@_val': String(GLOW_ALPHA) } },
		},
		glowOriginalColor: glow.hex,
		glowOriginalOpacity: opacity,
	};
}

/** Apply a soft edge of `sizePt`, or `null` for No Soft Edges. */
export function withSoftEdge(style: ShapeStyle, sizePt: number | null): ShapeStyle {
	const next = withoutListFamily(style, 'softEdge');
	return sizePt ? { ...next, softEdgeRadius: (sizePt * EMU_PER_PT) / EMU_PER_PX } : next;
}

/** Apply a top bevel preset, or `null` for No Bevel (other 3-D settings survive). */
export function withBevel(style: ShapeStyle, preset: string | null): ShapeStyle {
	const shape3d = { ...style.shape3d };
	delete shape3d.bevelTopType;
	delete shape3d.bevelTopWidth;
	delete shape3d.bevelTopHeight;
	if (preset) {
		shape3d.bevelTopType = preset;
	}
	const next: ShapeStyle = { ...style, shape3d: Object.keys(shape3d).length ? shape3d : undefined };
	if (preset && !style.scene3d?.cameraPreset) {
		next.scene3d = {
			...style.scene3d,
			cameraPreset: 'orthographicFront',
			...DEFAULT_SCENE_LIGHT_RIG,
		};
	}
	return next;
}

/** Apply a camera preset, or `null` for No Rotation. */
export function withRotation(style: ShapeStyle, preset: string | null): ShapeStyle {
	const scene = { ...style.scene3d };
	delete scene.cameraRotX;
	delete scene.cameraRotY;
	delete scene.cameraRotZ;
	if (!preset) {
		// A bevel still needs its (flat) scene; otherwise the rotation goes entirely.
		return style.shape3d?.bevelTopType
			? { ...style, scene3d: { ...scene, cameraPreset: 'orthographicFront' } }
			: { ...style, scene3d: undefined };
	}
	return {
		...style,
		scene3d: {
			...DEFAULT_SCENE_LIGHT_RIG,
			...scene,
			cameraPreset: preset,
		},
	};
}
