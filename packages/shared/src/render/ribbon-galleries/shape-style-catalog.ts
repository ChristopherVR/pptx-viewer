/**
 * PowerPoint's Shape Styles gallery, as PowerPoint itself writes it.
 *
 * Ground truth: `scripts/capture-gallery-writes-com.ps1` sets
 * `Shape.ShapeStyle = 1..77` (msoShapeStylePreset1..77) on a fresh deck and
 * saves it. Presets 1-42 ("Theme Styles", 6 rows x 7 colours) are a bare
 * `<p:style>` with an empty `spPr`; presets 43-77 ("Presets") author the fill
 * and outline in `spPr` and carry an all-zero `<p:style>` whose `fontRef`
 * picks the text colour. The tables below are that capture, verbatim.
 *
 * @module render/ribbon-galleries/shape-style-catalog
 */
import type { XmlObject } from 'pptx-viewer-core';

/** The seven colour columns: Dark 1, then Accent 1-6. */
export const SHAPE_STYLE_COLUMNS = [
	'dk1',
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
] as const;
export type ShapeStyleColumn = (typeof SHAPE_STYLE_COLUMNS)[number];

/** Row captions of the Theme Styles block (PowerPoint's tooltips). */
export const SHAPE_THEME_STYLE_ROWS = [
	{ key: 'coloredOutline', label: 'Colored Outline' },
	{ key: 'coloredFill', label: 'Colored Fill' },
	{ key: 'light1OutlineColoredFill', label: 'Light 1 Outline, Colored Fill' },
	{ key: 'subtleEffect', label: 'Subtle Effect' },
	{ key: 'moderateEffect', label: 'Moderate Effect' },
	{ key: 'intenseEffect', label: 'Intense Effect' },
] as const;

/** Row captions of the Presets block. */
export const SHAPE_PRESET_STYLE_ROWS = [
	{ key: 'transparentText', label: 'Transparent, Colored Text' },
	{ key: 'transparentOutline', label: 'Transparent, Colored Outline' },
	{ key: 'semitransparentFill', label: 'Semitransparent Fill' },
	{ key: 'solidFill', label: 'Solid Fill' },
	{ key: 'gradientFill', label: 'Gradient Fill' },
] as const;

type RefColor = ShapeStyleColumn | 'lt1' | { scheme: ShapeStyleColumn; shade: number };
interface ThemeRow {
	ln: [number, RefColor | 'col'];
	fill: [number, 'col' | 'lt1'];
	effect: number;
	font: 'dk1' | 'lt1';
}

const THEME_ROWS: readonly ThemeRow[] = [
	{ ln: [2, 'col'], fill: [1, 'lt1'], effect: 0, font: 'dk1' },
	{ ln: [2, { scheme: 'dk1', shade: 15000 }], fill: [1, 'col'], effect: 0, font: 'lt1' },
	{ ln: [3, 'lt1'], fill: [1, 'col'], effect: 1, font: 'lt1' },
	{ ln: [1, 'col'], fill: [2, 'col'], effect: 1, font: 'dk1' },
	{ ln: [1, 'col'], fill: [3, 'col'], effect: 2, font: 'lt1' },
	{ ln: [0, 'col'], fill: [3, 'col'], effect: 3, font: 'lt1' },
];

function schemeNode(val: string, transforms: Record<string, number> = {}): XmlObject {
	const node: XmlObject = { '@_val': val };
	for (const [name, value] of Object.entries(transforms)) {
		node[`a:${name}`] = { '@_val': String(value) };
	}
	return { 'a:schemeClr': node };
}

function refNode(idx: number | string, color: XmlObject): XmlObject {
	return { '@_idx': String(idx), ...color };
}

function refColor(color: RefColor | 'col', column: ShapeStyleColumn): XmlObject {
	if (color === 'col') {
		return schemeNode(column);
	}
	if (typeof color === 'string') {
		return schemeNode(color);
	}
	// Row 2's outline is the COLUMN colour shaded, not dk1 (dk1 is only the
	// type's placeholder); PowerPoint writes `<schemeClr val="accentN"><shade val="15000"/>`.
	return schemeNode(column, { shade: color.shade });
}

/** The `<p:style>` node of Theme Styles preset `row`/`column` (1-based index = row*7+col+1). */
export function themeShapeStyleXml(row: number, column: ShapeStyleColumn): XmlObject {
	const spec = THEME_ROWS[row];
	return {
		'a:lnRef': refNode(spec.ln[0], refColor(spec.ln[1], column)),
		'a:fillRef': refNode(spec.fill[0], refColor(spec.fill[1], column)),
		'a:effectRef': refNode(spec.effect, schemeNode(column)),
		'a:fontRef': refNode('minor', schemeNode(spec.font)),
	};
}

/** What a Presets entry authors in `spPr`, in theme-colour terms. */
export interface ShapePresetStyleSpec {
	fill:
		| { kind: 'none' }
		| { kind: 'solid'; alpha?: number }
		| {
				kind: 'gradient';
				stops: ReadonlyArray<{ position: number; lumMod: number; lumOff?: number }>;
				angle: number;
		  };
	/** Outline width in EMU, or 0 for `<a:ln><a:noFill/></a:ln>`. */
	lineWidthEmu: number;
	/** `fontRef` colour: the column colour or Light 1. */
	font: 'col' | 'lt1';
}

export const SHAPE_PRESET_ROWS: readonly ShapePresetStyleSpec[] = [
	{ fill: { kind: 'none' }, lineWidthEmu: 0, font: 'col' },
	{ fill: { kind: 'none' }, lineWidthEmu: 9525, font: 'col' },
	{ fill: { kind: 'solid', alpha: 50000 }, lineWidthEmu: 0, font: 'lt1' },
	{ fill: { kind: 'solid' }, lineWidthEmu: 0, font: 'lt1' },
	{
		fill: {
			kind: 'gradient',
			stops: [
				{ position: 0, lumMod: 67000 },
				{ position: 48000, lumMod: 97000, lumOff: 3000 },
				{ position: 100000, lumMod: 60000, lumOff: 40000 },
			],
			angle: 16200000,
		},
		lineWidthEmu: 0,
		font: 'lt1',
	},
];
