/**
 * `slide-transition-options` - the pure option catalogues backing every
 * binding's slide-transition inspector section.
 *
 * WHY this lives in shared: the transition type list, the set of types that
 * pick an orientation instead of a direction, and the arrow glyph/grid tables
 * used by the direction picker are all plain data with no framework in them.
 * They previously sat inside `packages/react`, which meant a binding porting
 * the section had to retype 24 transition values and 12 arrow glyphs by hand,
 * and any new OOXML transition type silently reached one binding only. React
 * now re-exports these from here so there is exactly one list to update.
 *
 * NOTE: each option keeps both a plain-ASCII `label` (English fallback for
 * non-i18n consumers) and an `i18nKey` resolvable through each binding's
 * translator, matching the `{ value, i18nKey }` convention used elsewhere.
 *
 * @module render/slide-transition-options
 */
import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

/** A selectable slide-transition type with its English label and i18n key. */
export interface SlideTransitionOptionEntry {
	value: NonNullable<PptxSlideTransition['type']>;
	label: string;
	i18nKey: string;
}

/** Every transition type offered by the inspector's Type select. */
export const SLIDE_TRANSITION_OPTIONS: readonly SlideTransitionOptionEntry[] = [
	{ value: 'none', label: 'None', i18nKey: 'pptx.transition.none' },
	{ value: 'cut', label: 'Cut', i18nKey: 'pptx.ribbon.transition.cut' },
	{ value: 'fade', label: 'Fade', i18nKey: 'pptx.ribbon.transition.fade' },
	{ value: 'push', label: 'Push', i18nKey: 'pptx.ribbon.transition.push' },
	{ value: 'wipe', label: 'Wipe', i18nKey: 'pptx.ribbon.transition.wipe' },
	{ value: 'split', label: 'Split', i18nKey: 'pptx.ribbon.transition.split' },
	{ value: 'randomBar', label: 'Random Bars', i18nKey: 'pptx.transitionPresets.randomBars' },
	{ value: 'blinds', label: 'Blinds', i18nKey: 'pptx.transitionPresets.blinds' },
	{ value: 'checker', label: 'Checker', i18nKey: 'pptx.transitionPresets.checker' },
	{ value: 'circle', label: 'Circle', i18nKey: 'pptx.transitionPresets.circle' },
	{ value: 'comb', label: 'Comb', i18nKey: 'pptx.transitionPresets.comb' },
	{ value: 'cover', label: 'Cover', i18nKey: 'pptx.ribbon.transition.cover' },
	{ value: 'diamond', label: 'Diamond', i18nKey: 'pptx.transitionPresets.diamond' },
	{ value: 'dissolve', label: 'Dissolve', i18nKey: 'pptx.transitionPresets.dissolve' },
	{ value: 'plus', label: 'Plus', i18nKey: 'pptx.transitionPresets.plus' },
	{ value: 'pull', label: 'Pull', i18nKey: 'pptx.transitionPresets.pull' },
	{ value: 'random', label: 'Random', i18nKey: 'pptx.transitionPresets.random' },
	{ value: 'strips', label: 'Strips', i18nKey: 'pptx.transitionPresets.strips' },
	{ value: 'uncover', label: 'Uncover', i18nKey: 'pptx.ribbon.transition.uncover' },
	{ value: 'wedge', label: 'Wedge', i18nKey: 'pptx.transitionPresets.wedge' },
	{ value: 'wheel', label: 'Wheel', i18nKey: 'pptx.transitionPresets.wheel' },
	{ value: 'zoom', label: 'Zoom', i18nKey: 'pptx.transitionPresets.zoom' },
	{ value: 'newsflash', label: 'Newsflash', i18nKey: 'pptx.transitionPresets.newsflash' },
	{ value: 'morph', label: 'Morph', i18nKey: 'pptx.transitionPresets.morph' },
];

/**
 * Transition types whose OOXML attribute is `dir="horz|vert"` (an orientation)
 * rather than one of the cardinal/diagonal direction tokens, so the inspector
 * must show a two-button orientation toggle instead of the arrow grid.
 */
export const TRANSITION_ORIENTATION_TYPES: ReadonlySet<PptxTransitionType> =
	new Set<PptxTransitionType>(['blinds', 'checker', 'comb', 'randomBar']);

/** Arrow glyph shown on a direction button, keyed by OOXML direction token. */
export const TRANSITION_DIR_ARROWS: Readonly<Record<string, string>> = {
	l: '←',
	r: '→',
	u: '↑',
	d: '↓',
	lu: '↖',
	ld: '↙',
	ru: '↗',
	rd: '↘',
	in: '◉',
	out: '◎',
	horz: '↔',
	vert: '↕',
};

/** `[row, column]` slot of each direction token in the 3x3 arrow grid. */
export const TRANSITION_DIR_GRID_POSITIONS: Readonly<Record<string, readonly [number, number]>> = {
	lu: [0, 0],
	u: [0, 1],
	ru: [0, 2],
	l: [1, 0],
	r: [1, 2],
	ld: [2, 0],
	d: [2, 1],
	rd: [2, 2],
};

/**
 * Lay the supplied direction tokens out on the 3x3 grid used by the picker.
 *
 * Returned as rows of `token | null` so a view layer can render empty cells as
 * spacers without re-deriving the geometry. Tokens with no grid slot (`in`,
 * `out`, `horz`, `vert`) are omitted; callers fall back to the inline button
 * row for those, which is why the picker only uses the grid above 3 entries.
 */
export function buildDirectionGrid(directions: readonly string[]): (string | null)[][] {
	const cells: (string | null)[][] = [
		[null, null, null],
		[null, null, null],
		[null, null, null],
	];
	for (const dir of directions) {
		const pos = TRANSITION_DIR_GRID_POSITIONS[dir];
		if (pos) {
			cells[pos[0]][pos[1]] = dir;
		}
	}
	return cells;
}
