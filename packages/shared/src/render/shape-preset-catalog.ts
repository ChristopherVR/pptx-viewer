/**
 * shape-preset-catalog.ts: the Insert > Shape picker catalogue shared by every
 * binding's toolbar/inspector.
 *
 * Pure data: each entry carries the preset geometry `type` (OOXML `a:prstGeom`
 * value the editor can insert), an English fallback `label`, the shared-i18n
 * `i18nKey`, and a framework-neutral icon descriptor ({@link ShapePresetGlyph}
 * name + optional utility-class modifier for rotation/skew). Each binding maps
 * the glyph name onto its own icon component/SVG.
 *
 * Order matters: bindings surface the first 12 entries as the quick "top
 * shapes" row, so new presets should be appended, not inserted.
 *
 * @module render/shape-preset-catalog
 */

/** Shape preset geometry types offered by the insert picker. */
export type ShapePresetType =
	| 'rect'
	| 'roundRect'
	| 'ellipse'
	| 'cylinder'
	| 'rtArrow'
	| 'leftArrow'
	| 'upArrow'
	| 'downArrow'
	| 'triangle'
	| 'rtTriangle'
	| 'diamond'
	| 'parallelogram'
	| 'trapezoid'
	| 'pentagon'
	| 'hexagon'
	| 'octagon'
	| 'chevron'
	| 'star5'
	| 'star6'
	| 'star8'
	| 'plus'
	| 'heart'
	| 'cloud'
	| 'sun'
	| 'moon'
	| 'pie'
	| 'plaque'
	| 'teardrop'
	| 'line'
	| 'connector';

/** Framework-neutral glyph names each binding maps to its own icon set. */
export type ShapePresetGlyph =
	| 'square'
	| 'circle'
	| 'database'
	| 'diamond'
	| 'minus'
	| 'moveRight'
	| 'plus'
	| 'triangle';

/** One entry of the Insert > Shape picker catalogue. */
export interface ShapePresetDef {
	/** Preset geometry inserted when picked (OOXML `a:prstGeom` value). */
	type: ShapePresetType;
	/** English fallback label (render sites may prefer `t(i18nKey)`). */
	label: string;
	/** Shared-i18n dictionary key for the label. */
	i18nKey: string;
	/** Neutral icon glyph name (see {@link ShapePresetGlyph}). */
	glyph: ShapePresetGlyph;
	/** Extra utility classes for the glyph (rotation/skew); `''` when none. */
	glyphClass: string;
}

/** The Insert > Shape picker catalogue (see module docs for ordering rules). */
export const SHAPE_PRESET_DEFS: readonly ShapePresetDef[] = [
	{
		type: 'rect',
		label: 'Rectangle',
		i18nKey: 'pptx.editorToolbar.shapeRectangle',
		glyph: 'square',
		glyphClass: '',
	},
	{
		type: 'roundRect',
		label: 'Rounded',
		i18nKey: 'pptx.shapePresets.rounded',
		glyph: 'square',
		glyphClass: '',
	},
	{
		type: 'ellipse',
		label: 'Circle',
		i18nKey: 'pptx.shapePresets.circle',
		glyph: 'circle',
		glyphClass: '',
	},
	{
		type: 'cylinder',
		label: 'Cylinder',
		i18nKey: 'pptx.shapePresets.cylinder',
		glyph: 'database',
		glyphClass: '',
	},
	{
		type: 'rtArrow',
		label: 'Right Arrow',
		i18nKey: 'pptx.shapePresets.rightArrow',
		glyph: 'moveRight',
		glyphClass: '',
	},
	{
		type: 'leftArrow',
		label: 'Left Arrow',
		i18nKey: 'pptx.shapePresets.leftArrow',
		glyph: 'moveRight',
		glyphClass: 'rotate-180',
	},
	{
		type: 'upArrow',
		label: 'Up Arrow',
		i18nKey: 'pptx.shapePresets.upArrow',
		glyph: 'moveRight',
		glyphClass: '-rotate-90',
	},
	{
		type: 'downArrow',
		label: 'Down Arrow',
		i18nKey: 'pptx.shapePresets.downArrow',
		glyph: 'moveRight',
		glyphClass: 'rotate-90',
	},
	{
		type: 'triangle',
		label: 'Triangle',
		i18nKey: 'pptx.editorToolbar.shapeTriangle',
		glyph: 'triangle',
		glyphClass: '',
	},
	{
		type: 'rtTriangle',
		label: 'Right Triangle',
		i18nKey: 'pptx.shapePresets.rightTriangle',
		glyph: 'triangle',
		glyphClass: 'rotate-90',
	},
	{
		type: 'diamond',
		label: 'Diamond',
		i18nKey: 'pptx.shapePresets.diamond',
		glyph: 'diamond',
		glyphClass: '',
	},
	{
		type: 'parallelogram',
		label: 'Parallelogram',
		i18nKey: 'pptx.shapePresets.parallelogram',
		glyph: 'square',
		glyphClass: '-skew-x-12',
	},
	{
		type: 'trapezoid',
		label: 'Trapezoid',
		i18nKey: 'pptx.shapePresets.trapezoid',
		glyph: 'square',
		glyphClass: '',
	},
	{
		type: 'pentagon',
		label: 'Pentagon',
		i18nKey: 'pptx.shapePresets.pentagon',
		glyph: 'diamond',
		glyphClass: '',
	},
	{
		type: 'hexagon',
		label: 'Hexagon',
		i18nKey: 'pptx.shapePresets.hexagon',
		glyph: 'diamond',
		glyphClass: '',
	},
	{
		type: 'octagon',
		label: 'Octagon',
		i18nKey: 'pptx.shapePresets.octagon',
		glyph: 'circle',
		glyphClass: '',
	},
	{
		type: 'chevron',
		label: 'Chevron',
		i18nKey: 'pptx.shapePresets.chevron',
		glyph: 'moveRight',
		glyphClass: '',
	},
	{
		type: 'star5',
		label: 'Star',
		i18nKey: 'pptx.shapePresets.star',
		glyph: 'diamond',
		glyphClass: 'rotate-45',
	},
	{
		type: 'star6',
		label: 'Star 6',
		i18nKey: 'pptx.shapePresets.star6',
		glyph: 'diamond',
		glyphClass: '',
	},
	{
		type: 'star8',
		label: 'Star 8',
		i18nKey: 'pptx.shapePresets.star8',
		glyph: 'diamond',
		glyphClass: 'rotate-45',
	},
	{
		type: 'plus',
		label: 'Plus',
		i18nKey: 'pptx.shapePresets.plus',
		glyph: 'plus',
		glyphClass: '',
	},
	{
		type: 'heart',
		label: 'Heart',
		i18nKey: 'pptx.shapePresets.heart',
		glyph: 'circle',
		glyphClass: '',
	},
	{
		type: 'cloud',
		label: 'Cloud',
		i18nKey: 'pptx.shapePresets.cloud',
		glyph: 'circle',
		glyphClass: '',
	},
	{
		type: 'sun',
		label: 'Sun',
		i18nKey: 'pptx.shapePresets.sun',
		glyph: 'circle',
		glyphClass: '',
	},
	{
		type: 'moon',
		label: 'Moon',
		i18nKey: 'pptx.shapePresets.moon',
		glyph: 'circle',
		glyphClass: '',
	},
	{
		type: 'pie',
		label: 'Pie',
		i18nKey: 'pptx.shapePresets.pie',
		glyph: 'circle',
		glyphClass: '',
	},
	{
		type: 'plaque',
		label: 'Plaque',
		i18nKey: 'pptx.shapePresets.plaque',
		glyph: 'square',
		glyphClass: '',
	},
	{
		type: 'teardrop',
		label: 'Teardrop',
		i18nKey: 'pptx.shapePresets.teardrop',
		glyph: 'circle',
		glyphClass: '',
	},
	{
		type: 'line',
		label: 'Line',
		i18nKey: 'pptx.shapePresets.line',
		glyph: 'minus',
		glyphClass: '',
	},
	{
		type: 'connector',
		label: 'Connector',
		i18nKey: 'pptx.elementType.connector',
		glyph: 'moveRight',
		glyphClass: '',
	},
];
