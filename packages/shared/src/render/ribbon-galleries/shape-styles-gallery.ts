/**
 * Shape Format > Shape Styles (and Home > Drawing > Quick Styles).
 *
 * Theme Styles apply a bare `<p:style>` resolved through the handler's
 * `resolveStyleMatrixReferences` (the load path's own resolver), so the shape
 * renders from the deck's theme and saves exactly as PowerPoint writes it: an
 * empty `spPr` plus the references. Presets author their fill and outline in
 * theme-colour terms (`fillColorRef` / stop `colorRef`), which the writer
 * emits as `a:schemeClr` with the same transforms PowerPoint uses.
 *
 * @module render/ribbon-galleries/shape-styles-gallery
 */
import type {
	PptxElement,
	PptxThemeColorRef,
	PptxThemeColorSchemeName,
	ResolvedStyleMatrix,
	ShapeStyle,
	XmlObject,
} from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { parseDrawingColorChoice } from '../drawing-color';
import { recolorInheritedText, shapeStyleWithoutFormatting } from './gallery-element-patch';
import { shapeTileSvg, tileSpecFromShapeStyle } from './gallery-preview-svg';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryDescriptor,
	RibbonGalleryItem,
} from './gallery-types';
import {
	SHAPE_PRESET_ROWS,
	SHAPE_PRESET_STYLE_ROWS,
	SHAPE_STYLE_COLUMNS,
	SHAPE_THEME_STYLE_ROWS,
	themeShapeStyleXml,
} from './shape-style-catalog';
import type { ShapePresetStyleSpec, ShapeStyleColumn } from './shape-style-catalog';
import { fallbackResolveStyleMatrix } from './style-matrix-fallback';

const TILE = { width: 44, height: 32 };
const COLUMN_LABELS: Record<ShapeStyleColumn, string> = {
	dk1: 'Dark 1',
	accent1: 'Accent 1',
	accent2: 'Accent 2',
	accent3: 'Accent 3',
	accent4: 'Accent 4',
	accent5: 'Accent 5',
	accent6: 'Accent 6',
};

/** Gallery item id -> (block, row, column). `theme-<row>-<col>` / `preset-<row>-<col>`. */
function parseItemId(
	id: string,
): { block: 'theme' | 'preset'; row: number; column: ShapeStyleColumn } | null {
	const match = /^(theme|preset)-(\d)-(\d)$/u.exec(id);
	if (!match) {
		return null;
	}
	const block = match[1] as 'theme' | 'preset';
	const row = Number(match[2]);
	const column = SHAPE_STYLE_COLUMNS[Number(match[3])];
	const rows = block === 'theme' ? SHAPE_THEME_STYLE_ROWS.length : SHAPE_PRESET_ROWS.length;
	return column && row < rows ? { block, row, column } : null;
}

function resolveTheme(xml: XmlObject, ctx: RibbonGalleryContext): ResolvedStyleMatrix {
	return ctx.resolveStyleMatrix?.(xml) ?? fallbackResolveStyleMatrix(xml, ctx.themeColorMap);
}

function schemeHex(ref: PptxThemeColorRef, ctx: RibbonGalleryContext): string {
	const transforms: XmlObject = { '@_val': ref.scheme };
	for (const key of ['lumMod', 'lumOff', 'shade', 'tint'] as const) {
		if (ref[key] !== undefined) {
			// `PptxThemeColorRef` stores fractions (0.2 = `val="20000"`).
			transforms[`a:${key}`] = { '@_val': String(Math.round((ref[key] ?? 0) * 100000)) };
		}
	}
	const overrides = { ...ctx.themeColorMap } as Record<string, string | undefined>;
	return parseDrawingColorChoice({ 'a:schemeClr': transforms }, overrides) ?? '#000000';
}

/** The flat style a Presets row authors for `column`. */
function presetStyle(
	spec: ShapePresetStyleSpec,
	column: ShapeStyleColumn,
	ctx: RibbonGalleryContext,
): ShapeStyle {
	const scheme = column as PptxThemeColorSchemeName;
	const style: ShapeStyle = {};
	if (spec.fill.kind === 'none') {
		Object.assign(style, { fillMode: 'none', fillColor: 'transparent', fillOpacity: 0 });
	} else if (spec.fill.kind === 'solid') {
		const ref: PptxThemeColorRef = {
			scheme,
			...(spec.fill.alpha && { alpha: spec.fill.alpha / 100000 }),
		};
		Object.assign(style, {
			fillMode: 'solid',
			fillColor: schemeHex(ref, ctx),
			fillColorRef: ref,
			fillOpacity: spec.fill.alpha ? spec.fill.alpha / 100000 : 1,
		});
	} else {
		const stops = spec.fill.stops.map((stop) => {
			const ref: PptxThemeColorRef = {
				scheme,
				lumMod: stop.lumMod / 100000,
				...(stop.lumOff && { lumOff: stop.lumOff / 100000 }),
			};
			return { color: schemeHex(ref, ctx), position: stop.position / 1000, colorRef: ref };
		});
		Object.assign(style, {
			fillMode: 'gradient',
			fillColor: stops[0].color,
			fillGradientStops: stops,
			fillGradientAngle: spec.fill.angle / 60000,
			fillGradientType: 'linear',
		});
	}
	if (spec.lineWidthEmu > 0) {
		Object.assign(style, {
			strokeColor: schemeHex({ scheme }, ctx),
			strokeColorRef: { scheme },
			strokeWidth: spec.lineWidthEmu / 9525,
		});
	} else {
		Object.assign(style, { strokeColor: 'transparent', strokeWidth: 0 });
	}
	return style;
}

/**
 * The all-zero references PowerPoint writes beside a preset's own `spPr`
 * (`<a:lnRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef>` and so on).
 */
const ZERO_SCRGB: XmlObject = { 'a:scrgbClr': { '@_r': '0', '@_g': '0', '@_b': '0' } };
const PRESET_ZERO_REFS: ShapeStyle = {
	lnRefIdx: 0,
	lnRefColorXml: ZERO_SCRGB,
	fillRefIdx: 0,
	fillRefColorXml: ZERO_SCRGB,
	effectRefIdx: 0,
	effectRefColorXml: ZERO_SCRGB,
};

interface ResolvedItem {
	shapeStyle: ShapeStyle;
	fontColor?: string;
}

function resolveItem(id: string, ctx: RibbonGalleryContext): ResolvedItem | null {
	const parsed = parseItemId(id);
	if (!parsed) {
		return null;
	}
	if (parsed.block === 'theme') {
		return resolveTheme(themeShapeStyleXml(parsed.row, parsed.column), ctx);
	}
	const spec = SHAPE_PRESET_ROWS[parsed.row];
	const fontScheme = spec.font === 'col' ? parsed.column : 'lt1';
	return {
		shapeStyle: {
			...presetStyle(spec, parsed.column, ctx),
			...PRESET_ZERO_REFS,
			fontRefIdx: 'minor',
			fontRefColorXml: { 'a:schemeClr': { '@_val': fontScheme } },
			styleMatrixReset: true,
		},
		fontColor: schemeHex({ scheme: fontScheme as PptxThemeColorSchemeName }, ctx),
	};
}

function styleMatches(element: PptxElement | null, style: ShapeStyle): boolean {
	if (!element || !hasShapeProperties(element) || !element.shapeStyle) {
		return false;
	}
	const current = element.shapeStyle;
	if ((style.fillRefIdx ?? 0) > 0 || (style.lnRefIdx ?? 0) > 0) {
		return (
			current.fillRefIdx === style.fillRefIdx &&
			current.lnRefIdx === style.lnRefIdx &&
			current.effectRefIdx === style.effectRefIdx &&
			current.fillColor?.toLowerCase() === style.fillColor?.toLowerCase() &&
			current.strokeColor?.toLowerCase() === style.strokeColor?.toLowerCase()
		);
	}
	return (
		current.fillMode === style.fillMode &&
		current.fillColor?.toLowerCase() === style.fillColor?.toLowerCase() &&
		(current.strokeWidth ?? 0) === (style.strokeWidth ?? 0)
	);
}

function item(
	block: 'theme' | 'preset',
	row: { key: string; label: string },
	rowIndex: number,
	col: number,
	ctx: RibbonGalleryContext,
): RibbonGalleryItem {
	const id = `${block}-${rowIndex}-${col}`;
	const column = SHAPE_STYLE_COLUMNS[col];
	const resolved = resolveItem(id, ctx);
	const style = resolved?.shapeStyle ?? {};
	return {
		id,
		labelKey: `pptx.gallery.shapeStyles.${row.key}`,
		labelParams: { color: COLUMN_LABELS[column] },
		label: `${row.label} - ${COLUMN_LABELS[column]}`,
		previewSvg: shapeTileSvg(tileSpecFromShapeStyle(`gss-${id}`, style, TILE, resolved?.fontColor)),
		applied: styleMatches(ctx.element, style),
	};
}

export function buildShapeStylesGallery(ctx: RibbonGalleryContext): RibbonGalleryDescriptor {
	const block = (kind: 'theme' | 'preset', rows: ReadonlyArray<{ key: string; label: string }>) =>
		rows.flatMap((row, r) => SHAPE_STYLE_COLUMNS.map((_, c) => item(kind, row, r, c, ctx)));
	return {
		id: 'shapeStyles',
		labelKey: 'pptx.gallery.shapeStyles.title',
		label: 'Shape Styles',
		disabled: !ctx.element || !hasShapeProperties(ctx.element),
		sections: [
			{
				id: 'theme',
				titleKey: 'pptx.gallery.shapeStyles.themeStyles',
				title: 'Theme Styles',
				columns: 7,
				tileWidth: TILE.width,
				tileHeight: TILE.height,
				items: block('theme', SHAPE_THEME_STYLE_ROWS),
			},
			{
				id: 'presets',
				titleKey: 'pptx.gallery.shapeStyles.presets',
				title: 'Presets',
				columns: 7,
				tileWidth: TILE.width,
				tileHeight: TILE.height,
				items: block('preset', SHAPE_PRESET_STYLE_ROWS),
			},
		],
	};
}

export function applyShapeStylesItem(
	itemId: string,
	ctx: RibbonGalleryContext,
): RibbonGalleryApplyResult | null {
	const element = ctx.element;
	if (!element || !hasShapeProperties(element)) {
		return null;
	}
	const resolved = resolveItem(itemId, ctx);
	if (!resolved) {
		return null;
	}
	const shapeStyle: ShapeStyle = {
		...shapeStyleWithoutFormatting(element),
		...resolved.shapeStyle,
	};
	return {
		kind: 'element',
		elementId: element.id,
		patch: {
			shapeStyle,
			...recolorInheritedText(element, resolved.fontColor),
		} as Partial<PptxElement>,
	};
}
