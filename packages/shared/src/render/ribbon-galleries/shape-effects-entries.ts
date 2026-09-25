/**
 * The Shape Effects gallery's tiles: one entry per menu item, each knowing
 * how to edit a `ShapeStyle`, whether a style already carries it, and how
 * its preview looks.
 *
 * @module render/ribbon-galleries/shape-effects-entries
 */
import type { ShapeStyle } from 'pptx-viewer-core';

import { parseDrawingColorChoice } from '../drawing-color';
import { shapeTileSvg } from './gallery-preview-svg';
import type { TileEffects } from './gallery-preview-svg';
import type { RibbonGalleryContext } from './gallery-types';
import type { ReflectionPresetSpec, ShadowPresetSpec } from './shape-effects-catalog';
import {
	EMU_PER_PT,
	EMU_PER_PX,
	shadowOffsets,
	withReflectionPreset,
	withShadowPreset,
} from './shape-effects-style';

export const EFFECT_TILE = { width: 48, height: 40 };

export interface ShapeEffectEntry {
	id: string;
	labelKey: string;
	label: string;
	labelParams?: Readonly<Record<string, string | number>>;
	edit: (style: ShapeStyle) => ShapeStyle;
	matches: (style: ShapeStyle) => boolean;
	preview: () => string;
}

export interface ShapeEffectSectionSpec {
	id: string;
	title: string;
	columns: number;
	entries: ShapeEffectEntry[];
}

export const KEY = 'pptx.gallery.shapeEffects';

export function near(a: number | undefined, b: number, tolerance = 0.05): boolean {
	return a !== undefined && Math.abs(a - b) <= tolerance;
}

function sameAngle(a: number | undefined, b: number): boolean {
	return a !== undefined && Math.abs(((((a - b) % 360) + 540) % 360) - 180) < 0.5;
}

export function hasColor(value: string | undefined): boolean {
	return Boolean(value) && value !== 'transparent';
}

export function accentHex(scheme: string, ctx: RibbonGalleryContext): string {
	const overrides = { ...ctx.themeColorMap } as Record<string, string | undefined>;
	return parseDrawingColorChoice({ 'a:schemeClr': { '@_val': scheme } }, overrides) ?? '#4472C4';
}

function shadowMatches(style: ShapeStyle, spec: ShadowPresetSpec): boolean {
	const dist = spec.distEmu / EMU_PER_PX;
	const blur = spec.blurEmu / EMU_PER_PX;
	const angle = spec.dir / 60000;
	if (spec.kind === 'inner') {
		const x = style.innerShadowOffsetX ?? 0;
		const y = style.innerShadowOffsetY ?? 0;
		return (
			hasColor(style.innerShadowColor) &&
			near(style.innerShadowBlur, blur) &&
			near(Math.hypot(x, y), dist) &&
			(dist === 0 || sameAngle((Math.atan2(y, x) * 180) / Math.PI, angle))
		);
	}
	const sx = style.shadowOffsetX ?? 0;
	const sy = style.shadowOffsetY ?? 0;
	const d = style.shadowDistance ?? Math.hypot(sx, sy);
	const a = style.shadowAngle ?? (Math.atan2(sy, sx) * 180) / Math.PI;
	return (
		hasColor(style.shadowColor) &&
		!style.presetShadowName &&
		near(style.shadowBlur, blur) &&
		near(d, dist) &&
		(dist === 0 || sameAngle(a, angle)) &&
		(style.shadowScaleX ?? 100000) === (spec.sx ?? 100000) &&
		(style.shadowScaleY ?? 100000) === (spec.sy ?? 100000) &&
		(style.shadowSkewX ?? 0) === (spec.kx ?? 0)
	);
}

function tileEffects(spec: ShadowPresetSpec): TileEffects {
	const { x, y } = shadowOffsets(spec.distEmu, spec.dir);
	const clamp = (v: number) => Math.max(-4, Math.min(4, v * 0.6));
	return {
		shadow: {
			color: '#000000',
			opacity: Math.min(0.8, (spec.alpha ?? 100000) / 100000 + 0.25),
			blur: Math.min(6, spec.blurEmu / EMU_PER_PX / 1.5),
			dx: clamp(x),
			dy: clamp(y) + (spec.sy !== undefined && spec.sy < 0 ? 3 : 0),
			inner: spec.kind === 'inner',
		},
	};
}

export function tile(id: string, color: string, effects?: TileEffects, fill = true): string {
	return shapeTileSvg({
		id: `gse-${id}`,
		...EFFECT_TILE,
		inset: 9,
		fill: fill ? { color } : undefined,
		stroke: fill ? undefined : { color, width: 1 },
		effects,
	});
}

export function noneEntry(
	id: string,
	key: string,
	label: string,
	color: string,
	edit: ShapeEffectEntry['edit'],
	matches: ShapeEffectEntry['matches'],
): ShapeEffectEntry {
	return { id, labelKey: `${KEY}.${key}`, label, edit, matches, preview: () => tile(id, color) };
}

export function shadowEntries(
	group: string,
	specs: readonly ShadowPresetSpec[],
	color: string,
): ShapeEffectEntry[] {
	return specs.map((spec) => {
		const id = `shadow-${group}-${spec.key}`;
		return {
			id,
			labelKey: `${KEY}.${spec.key}`,
			label: spec.label,
			edit: (style) => withShadowPreset(style, spec),
			matches: (style) => shadowMatches(style, spec),
			preview: () => tile(id, color, tileEffects(spec)),
		};
	});
}

export function reflectionEntry(spec: ReflectionPresetSpec, color: string): ShapeEffectEntry {
	const id = `reflection-${spec.key}`;
	return {
		id,
		labelKey: `${KEY}.${spec.key}`,
		label: spec.label,
		edit: (style) => withReflectionPreset(style, spec),
		matches: (style) =>
			near(style.reflectionStartOpacity, spec.stA / 100000, 0.005) &&
			near(style.reflectionEndPosition, spec.endPos / 100000, 0.005) &&
			near(style.reflectionDistance ?? 0, spec.distEmu / EMU_PER_PX),
		preview: () =>
			tile(id, color, {
				reflection: {
					startOpacity: spec.stA / 100000,
					endPosition: spec.endPos / 100000,
					distance: spec.distEmu / EMU_PER_PT / 2,
				},
			}),
	};
}

export function hasReflection(style: ShapeStyle): boolean {
	return [style.reflectionBlurRadius, style.reflectionStartOpacity, style.reflectionDistance].some(
		(value) => typeof value === 'number' && value > 0,
	);
}
