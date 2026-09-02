import {
	COMPOUND_LINE_OPTIONS as SHARED_COMPOUND_LINE_OPTIONS,
	LINE_CAP_OPTIONS as SHARED_LINE_CAP_OPTIONS,
	LINE_JOIN_OPTIONS as SHARED_LINE_JOIN_OPTIONS,
	PATTERN_PRESET_OPTIONS as SHARED_PATTERN_PRESET_OPTIONS,
} from 'pptx-viewer-shared';
import type React from 'react';

// ---------------------------------------------------------------------------
// Option arrays for fill / stroke properties
//
// NOTE: `label` keeps the English fallback text (existing consumers still
// render `option.label` directly). Each option also carries an `i18nKey`
// pointing at the shared i18n dictionary, matching the `{ value, i18nKey }`
// convention already used elsewhere in this codebase, so a render site can
// switch to `t(option.i18nKey)` without a data-shape change.
//
// COMPOUND_LINE_OPTIONS / LINE_JOIN_OPTIONS / LINE_CAP_OPTIONS /
// PATTERN_PRESET_OPTIONS used to be private, byte-identical retypes of the
// shared `render/stroke-line-style-options.ts` and
// `render/fill-pattern-label-keys.ts` catalogues; they are the one shared
// copy now.
// ---------------------------------------------------------------------------

export const COMPOUND_LINE_OPTIONS = SHARED_COMPOUND_LINE_OPTIONS;
export const LINE_JOIN_OPTIONS = SHARED_LINE_JOIN_OPTIONS;
export const LINE_CAP_OPTIONS = SHARED_LINE_CAP_OPTIONS;
/** Shape is `{ value, labelKey }` (no English `label`); render via `t(opt.labelKey)`. */
export const PATTERN_PRESET_OPTIONS = SHARED_PATTERN_PRESET_OPTIONS;

export const FILL_MODE_OPTIONS = [
	{ value: 'solid', label: 'Solid', i18nKey: 'pptx.fill.solid' },
	{ value: 'gradient', label: 'Gradient', i18nKey: 'pptx.fill.gradient' },
	{ value: 'pattern', label: 'Pattern', i18nKey: 'pptx.table.fillPattern' },
	{ value: 'image', label: 'Image', i18nKey: 'pptx.inspector.image' },
	{ value: 'none', label: 'None', i18nKey: 'pptx.fill.none' },
];

export const GRADIENT_TYPE_OPTIONS = [
	{ value: 'linear', label: 'Linear', i18nKey: 'pptx.gradient.linear' },
	{ value: 'radial', label: 'Radial', i18nKey: 'pptx.gradient.radial' },
];

export const IMAGE_MODE_OPTIONS = [
	{ value: 'stretch', label: 'Stretch', i18nKey: 'pptx.image.stretch' },
	{ value: 'tile', label: 'Tile', i18nKey: 'pptx.image.tile' },
];

/**
 * Generate preview style for compound line types.
 * Shows a horizontal line with the appropriate visual appearance.
 */
export function getCompoundLinePreviewStyle(type: string): React.CSSProperties {
	const baseColor = '#6b7280'; // gray-500

	switch (type) {
		case 'sng':
			return {
				borderTop: `2px solid ${baseColor}`,
				width: '100%',
			};

		case 'dbl': {
			const lineWidth = 2;
			const gap = 2;
			return {
				position: 'relative' as const,
				height: `${lineWidth * 2 + gap}px`,
				width: '100%',
				boxShadow: `inset 0 ${lineWidth + gap}px 0 ${-lineWidth}px ${baseColor}, inset 0 ${-(lineWidth + gap)}px 0 ${-lineWidth}px ${baseColor}`,
			};
		}

		case 'thickThin': {
			const thickWidth = 3;
			const thinWidth = 1;
			const gap = 1;
			return {
				position: 'relative' as const,
				height: `${thickWidth + thinWidth + gap}px`,
				width: '100%',
				boxShadow: `inset 0 ${thickWidth / 2 + gap}px 0 ${-thickWidth}px ${baseColor}, inset 0 ${-(thickWidth / 2 + gap + thinWidth)}px 0 ${-thinWidth}px ${baseColor}`,
			};
		}

		case 'thinThick': {
			const thinWidth = 1;
			const thickWidth = 3;
			const gap = 1;
			return {
				position: 'relative' as const,
				height: `${thinWidth + thickWidth + gap}px`,
				width: '100%',
				boxShadow: `inset 0 ${thickWidth / 2 + gap}px 0 ${-thinWidth}px ${baseColor}, inset 0 ${-(thickWidth / 2 + gap + thinWidth)}px 0 ${-thickWidth}px ${baseColor}`,
			};
		}

		case 'tri': {
			const lineWidth = 1;
			const gap = 1;
			const offset1 = lineWidth + gap;
			const offset2 = (lineWidth + gap) * 2;
			return {
				position: 'relative' as const,
				height: `${lineWidth * 3 + gap * 2}px`,
				width: '100%',
				boxShadow: `inset 0 0 0 ${-lineWidth}px ${baseColor}, inset 0 ${offset1}px 0 ${-lineWidth}px ${baseColor}, inset 0 ${-offset2}px 0 ${-lineWidth}px ${baseColor}`,
			};
		}

		default:
			return {};
	}
}
