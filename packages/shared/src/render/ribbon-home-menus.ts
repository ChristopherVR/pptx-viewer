import { MERGE_SHAPES_MENU_ITEMS } from './merge-shapes/merge-shapes-menu';
import { CROP_ASPECT_GROUP_LABEL_KEYS, CROP_ASPECT_PRESETS } from './picture-crop/crop-aspect';
import { CROP_FILL_LABEL_KEY, CROP_FIT_LABEL_KEY } from './picture-crop/crop-session';
import type { RibbonHomeItem } from './ribbon-home-spec';
import { SHAPE_PRESET_DEFS } from './shape-preset-catalog';
import {
	CHANGE_CASE_OPTIONS,
	CHARACTER_SPACING_OPTIONS,
	COMMON_FONT_SIZES,
	LINE_SPACING_OPTIONS,
} from './text-format-presets';

const item = (
	value: string,
	labelKey: string,
	fallback: string,
	extra: Partial<RibbonHomeItem> = {},
): RibbonHomeItem => ({ value, labelKey, fallback, ...extra });

/** Character Spacing presets; the value is the OOXML `spc` amount in 1/100 pt. */
export const HOME_CHARACTER_SPACING_ITEMS: readonly RibbonHomeItem[] =
	CHARACTER_SPACING_OPTIONS.map((option) =>
		item(String(option.value), option.i18nKey, option.label),
	);

const CASE_FALLBACKS: Record<string, string> = {
	sentence: 'Sentence case.',
	lower: 'lowercase',
	upper: 'UPPERCASE',
	capitalize: 'Capitalize Each Word',
	toggle: 'tOGGLE cASE',
};
/** Change Case modes in PowerPoint's order; the value is the `ChangeCaseMode`. */
export const HOME_CHANGE_CASE_ITEMS: readonly RibbonHomeItem[] = CHANGE_CASE_OPTIONS.map((option) =>
	item(option.value, option.i18nKey, CASE_FALLBACKS[option.value]),
);

/** Line spacing multipliers; the value is the multiplier as text (`1.15`). */
export const HOME_LINE_SPACING_ITEMS: readonly RibbonHomeItem[] = LINE_SPACING_OPTIONS.map(
	(option) => ({ value: String(option.value), label: option.label }),
);

export const HOME_TEXT_DIRECTION_ITEMS: readonly RibbonHomeItem[] = [
	item('horizontal', 'pptx.slideInspector.horizontal', 'Horizontal'),
	item('vertical', 'pptx.ribbon.textDirectionRotate90', 'Rotate 90\u00B0'),
	item('vertical270', 'pptx.ribbon.textDirectionRotate270', 'Rotate 270\u00B0'),
	item('wordArtVert', 'pptx.ribbon.textDirectionStacked', 'Stacked'),
];

export const HOME_COLUMN_ITEMS: readonly RibbonHomeItem[] = [
	item('1', 'pptx.ribbon.columns1', '1 Column'),
	item('2', 'pptx.ribbon.columns2', '2 Columns'),
	item('3', 'pptx.ribbon.columns3', '3 Columns'),
];

export const HOME_SELECT_ITEMS: readonly RibbonHomeItem[] = [
	item('selectAll', 'pptx.editing.selectAll', 'Select All'),
];

/** Drawing > Arrange menu: the four z-order commands. */
export const HOME_DRAWING_ARRANGE_ITEMS: readonly RibbonHomeItem[] = [
	item('forward', 'pptx.contextMenu.bringForward', 'Bring Forward'),
	item('backward', 'pptx.contextMenu.sendBackward', 'Send Backward'),
	item('front', 'pptx.contextMenu.bringToFront', 'Bring to Front'),
	item('back', 'pptx.contextMenu.sendToBack', 'Send to Back'),
];

/** Drawing > Shapes: the first dozen presets of the shared catalogue. */
export const HOME_SHAPE_ITEMS: readonly RibbonHomeItem[] = SHAPE_PRESET_DEFS.slice(0, 12).map(
	(preset) =>
		item(preset.type, preset.i18nKey, preset.label, {
			icon: `shape:${preset.glyph}|${preset.glyphClass}`,
		}),
);

/** Merge Shapes operations; keeps the `data-pptx-merge-op` automation hook. */
export const HOME_MERGE_ITEMS: readonly RibbonHomeItem[] = MERGE_SHAPES_MENU_ITEMS.map((entry) =>
	item(entry.operation, entry.labelKey, entry.operation, {
		attrs: { 'data-pptx-merge-op': entry.operation },
	}),
);

/**
 * Crop menu: aspect-ratio presets by group, then Fill and Fit. A preset's value
 * is `aspect:<w>:<h>`; Fill and Fit are `fill` and `fit`.
 */
export const HOME_CROP_ITEMS: readonly RibbonHomeItem[] = [
	...CROP_ASPECT_PRESETS.map((preset) =>
		item(`aspect:${preset.ratioWidth}:${preset.ratioHeight}`, '', preset.id, {
			label: preset.id,
			groupKey: CROP_ASPECT_GROUP_LABEL_KEYS[preset.group],
			group: preset.group,
			attrs: { 'data-pptx-crop-aspect': preset.id },
		}),
	),
	item('fill', CROP_FILL_LABEL_KEY, 'Fill', {
		separator: true,
		attrs: { 'data-pptx-crop-action': 'fill' },
	}),
	item('fit', CROP_FIT_LABEL_KEY, 'Fit', { attrs: { 'data-pptx-crop-action': 'fit' } }),
];

/** Decode a crop menu value. */
export function parseCropValue(
	value: string | number | undefined,
): { kind: 'aspect'; width: number; height: number } | { kind: 'fill' | 'fit' } | undefined {
	if (value === 'fill' || value === 'fit') {
		return { kind: value };
	}
	const match = /^aspect:(\d+):(\d+)$/u.exec(String(value));
	return match ? { kind: 'aspect', width: Number(match[1]), height: Number(match[2]) } : undefined;
}

/** Font size choices in points. */
export const HOME_FONT_SIZE_ITEMS: readonly RibbonHomeItem[] = COMMON_FONT_SIZES.map((size) => ({
	value: String(size),
	label: String(size),
}));

/** Text highlight swatches. */
export const HOME_HIGHLIGHT_PRESETS: readonly string[] = [
	'#ffff00',
	'#00ff00',
	'#00ffff',
	'#ff00ff',
	'#0000ff',
	'#ff0000',
	'#000080',
	'#008080',
	'#008000',
	'#800080',
];
