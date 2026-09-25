/**
 * The Shape Effects menu's sections, in PowerPoint's order: each family's
 * "No ..." entry, then its variations.
 *
 * @module render/ribbon-galleries/shape-effects-sections
 */
import type { ShapeStyle } from 'pptx-viewer-core';

import { bevelTileSvg, rotationTileSvg } from './effect-tile-svg';
import type { RibbonGalleryContext } from './gallery-types';
import {
	BEVEL_PRESETS,
	GLOW_ACCENTS,
	GLOW_SIZES_PT,
	REFLECTION_PRESETS,
	ROTATION_GROUPS,
	SHADOW_INNER_PRESETS,
	SHADOW_OUTER_PRESETS,
	SHADOW_PERSPECTIVE_PRESETS,
	SOFT_EDGE_SIZES_PT,
} from './shape-effects-catalog';
import {
	accentHex,
	EFFECT_TILE,
	hasColor,
	hasReflection,
	KEY,
	near,
	noneEntry,
	reflectionEntry,
	shadowEntries,
	tile,
} from './shape-effects-entries';
import type { ShapeEffectEntry, ShapeEffectSectionSpec } from './shape-effects-entries';
import {
	EMU_PER_PT,
	EMU_PER_PX,
	withBevel,
	withGlow,
	withReflectionPreset,
	withRotation,
	withShadowPreset,
	withSoftEdge,
} from './shape-effects-style';

function glowEntries(ctx: RibbonGalleryContext, base: string): ShapeEffectEntry[] {
	return GLOW_SIZES_PT.flatMap((sizePt) =>
		GLOW_ACCENTS.map((scheme, index): ShapeEffectEntry => {
			const hex = accentHex(scheme, ctx);
			const radius = (sizePt * EMU_PER_PT) / EMU_PER_PX;
			const id = `glow-${sizePt}-${index + 1}`;
			return {
				id,
				labelKey: `${KEY}.glowVariation`,
				labelParams: { size: sizePt, color: `Accent ${index + 1}` },
				label: `Glow: ${sizePt} pt; Accent ${index + 1}`,
				edit: (style) => withGlow(style, { sizePt, scheme, hex }),
				matches: (style) =>
					near(style.glowRadius, radius, 0.1) &&
					style.glowColor?.toLowerCase() === hex.toLowerCase(),
				preview: () =>
					tile(id, base, { glow: { color: hex, opacity: 0.6, radius: Math.min(5, sizePt / 3) } }),
			};
		}),
	);
}

function softEdgeEntries(base: string): ShapeEffectEntry[] {
	return SOFT_EDGE_SIZES_PT.map((sizePt): ShapeEffectEntry => {
		const id = `softEdge-${String(sizePt).replace('.', '_')}`;
		return {
			id,
			labelKey: `${KEY}.softEdgePoints`,
			labelParams: { size: sizePt },
			label: `${sizePt} Point`,
			edit: (style) => withSoftEdge(style, sizePt),
			matches: (style) => near(style.softEdgeRadius, (sizePt * EMU_PER_PT) / EMU_PER_PX, 0.1),
			preview: () => tile(id, base, { softEdge: Math.min(6, 1 + sizePt / 6) }),
		};
	});
}

function bevelEntries(base: string): ShapeEffectEntry[] {
	return BEVEL_PRESETS.map(({ preset, label }): ShapeEffectEntry => {
		const id = `bevel-${preset}`;
		return {
			id,
			labelKey: `${KEY}.bevel.${preset}`,
			label,
			edit: (style) => withBevel(style, preset),
			matches: (style) => (style.shape3d?.bevelTopType ?? '') === preset,
			preview: () => bevelTileSvg(`gse-${id}`, preset, base, EFFECT_TILE),
		};
	});
}

function rotationSections(base: string): ShapeEffectSectionSpec[] {
	return ROTATION_GROUPS.map((group) => ({
		id: `rotation-${group.key}`,
		title: group.label,
		columns: 4,
		entries: group.cameras.map(({ preset, label }): ShapeEffectEntry => ({
			id: `rotation-${preset}`,
			labelKey: `${KEY}.camera.${preset}`,
			label,
			edit: (style) => withRotation(style, preset),
			matches: (style) => style.scene3d?.cameraPreset === preset,
			preview: () => rotationTileSvg(preset, base, EFFECT_TILE),
		})),
	}));
}

type Edit = (style: ShapeStyle) => ShapeStyle;
type Match = (style: ShapeStyle) => boolean;

/** Each family's "No ..." entry: [section id, title, columns, i18n key, label, edit, applied]. */
const NONE_ENTRIES: ReadonlyArray<[string, string, number, string, string, Edit, Match]> = [
	[
		'shadow',
		'Shadow',
		3,
		'noShadow',
		'No Shadow',
		(s) => withShadowPreset(s, null),
		(s) => !hasColor(s.shadowColor) && !hasColor(s.innerShadowColor) && !s.presetShadowName,
	],
	[
		'reflection',
		'Reflection',
		3,
		'noReflection',
		'No Reflection',
		(s) => withReflectionPreset(s, null),
		(s) => !hasReflection(s),
	],
	[
		'glow',
		'Glow',
		6,
		'noGlow',
		'No Glow',
		(s) => withGlow(s, null),
		(s) => !hasColor(s.glowColor) || !s.glowRadius,
	],
	[
		'softEdge',
		'Soft Edges',
		3,
		'noSoftEdges',
		'No Soft Edges',
		(s) => withSoftEdge(s, null),
		(s) => !s.softEdgeRadius,
	],
	[
		'bevel',
		'Bevel',
		4,
		'noBevel',
		'No Bevel',
		(s) => withBevel(s, null),
		(s) => !s.shape3d?.bevelTopType,
	],
	[
		'rotation',
		'3-D Rotation',
		4,
		'noRotation',
		'No Rotation',
		(s) => withRotation(s, null),
		(s) => !s.scene3d?.cameraPreset || s.scene3d.cameraPreset === 'orthographicFront',
	],
];

/** Every section of the menu, resolved against the deck's theme. */
export function shapeEffectSections(ctx: RibbonGalleryContext): ShapeEffectSectionSpec[] {
	const base = accentHex('accent1', ctx);
	const none = new Map(
		NONE_ENTRIES.map(([id, title, columns, key, label, edit, matches]) => [
			id,
			{ id, title, columns, entries: [noneEntry(`${id}-none`, key, label, base, edit, matches)] },
		]),
	);
	const section = (id: string, title: string, columns: number, entries: ShapeEffectEntry[]) => ({
		id,
		title,
		columns,
		entries,
	});
	const noneSection = (id: string): ShapeEffectSectionSpec =>
		none.get(id) as ShapeEffectSectionSpec;
	return [
		noneSection('shadow'),
		section('shadow-outer', 'Outer', 3, shadowEntries('outer', SHADOW_OUTER_PRESETS, base)),
		section('shadow-inner', 'Inner', 3, shadowEntries('inner', SHADOW_INNER_PRESETS, base)),
		section(
			'shadow-perspective',
			'Perspective',
			3,
			shadowEntries('perspective', SHADOW_PERSPECTIVE_PRESETS, base),
		),
		noneSection('reflection'),
		section(
			'reflection-variations',
			'Reflection Variations',
			3,
			REFLECTION_PRESETS.map((spec) => reflectionEntry(spec, base)),
		),
		noneSection('glow'),
		section('glow-variations', 'Glow Variations', 6, glowEntries(ctx, base)),
		noneSection('softEdge'),
		section('softEdge-variations', 'Soft Edge Variations', 3, softEdgeEntries(base)),
		noneSection('bevel'),
		section('bevel-variations', 'Bevel Variations', 4, bevelEntries(base)),
		noneSection('rotation'),
		...rotationSections(base),
	];
}
