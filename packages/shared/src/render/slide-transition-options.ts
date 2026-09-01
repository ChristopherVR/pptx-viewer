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
import type {
	PptxMorphOption,
	PptxSlideTransition,
	PptxTransitionSpeed,
	PptxTransitionType,
} from 'pptx-viewer-core';

/** A selectable slide-transition type with its English label and i18n key. */
export interface SlideTransitionOptionEntry {
	value: NonNullable<PptxSlideTransition['type']>;
	label: string;
	i18nKey: string;
}

/** A selectable value with its English label and i18n key (speed, morph option, ...). */
export interface SlideTransitionValueOption<T extends string> {
	value: T;
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
	{ value: 'conveyor', label: 'Conveyor', i18nKey: 'pptx.transitionPresets.conveyor' },
	{ value: 'doors', label: 'Doors', i18nKey: 'pptx.transitionPresets.doors' },
	{ value: 'ferris', label: 'Ferris Wheel', i18nKey: 'pptx.transitionPresets.ferris' },
	{ value: 'flash', label: 'Flash', i18nKey: 'pptx.transitionPresets.flash' },
	{ value: 'flythrough', label: 'Fly Through', i18nKey: 'pptx.transitionPresets.flythrough' },
	{ value: 'gallery', label: 'Gallery', i18nKey: 'pptx.transitionPresets.gallery' },
	{ value: 'glitter', label: 'Glitter', i18nKey: 'pptx.transitionPresets.glitter' },
	{ value: 'honeycomb', label: 'Honeycomb', i18nKey: 'pptx.transitionPresets.honeycomb' },
	{ value: 'pan', label: 'Pan', i18nKey: 'pptx.transitionPresets.pan' },
	{ value: 'prism', label: 'Prism', i18nKey: 'pptx.transitionPresets.prism' },
	{ value: 'reveal', label: 'Reveal', i18nKey: 'pptx.transitionPresets.reveal' },
	{ value: 'ripple', label: 'Ripple', i18nKey: 'pptx.transitionPresets.ripple' },
	{ value: 'shred', label: 'Shred', i18nKey: 'pptx.transitionPresets.shred' },
	{ value: 'switch', label: 'Switch', i18nKey: 'pptx.transitionPresets.switch' },
	{ value: 'vortex', label: 'Vortex', i18nKey: 'pptx.transitionPresets.vortex' },
	{ value: 'warp', label: 'Warp', i18nKey: 'pptx.transitionPresets.warp' },
	{ value: 'wheelReverse', label: 'Reverse Wheel', i18nKey: 'pptx.transitionPresets.wheelReverse' },
	{ value: 'window', label: 'Window', i18nKey: 'pptx.transitionPresets.window' },
	{ value: 'cube', label: 'Cube', i18nKey: 'pptx.transitionPresets.cube' },
	{ value: 'flip', label: 'Flip', i18nKey: 'pptx.transitionPresets.flip' },
	{ value: 'rotate', label: 'Rotate', i18nKey: 'pptx.transitionPresets.rotate' },
	{ value: 'box', label: 'Box', i18nKey: 'pptx.transitionPresets.box' },
	{ value: 'orbit', label: 'Orbit', i18nKey: 'pptx.transitionPresets.orbit' },
];

/**
 * Every transition speed (`p:transition/@spd`) offered by the inspector's
 * Speed select, shown for every transition type (including `none`, matching
 * how PowerPoint itself always keeps the Timing > Duration/Speed control live).
 * Defaults to `fast` when the attribute is absent, matching the schema default.
 */
export const TRANSITION_SPEED_OPTIONS: readonly SlideTransitionValueOption<PptxTransitionSpeed>[] =
	[
		{ value: 'slow', label: 'Slow', i18nKey: 'pptx.transition.speed.slow' },
		{ value: 'med', label: 'Medium', i18nKey: 'pptx.transition.speed.med' },
		{ value: 'fast', label: 'Fast', i18nKey: 'pptx.transition.speed.fast' },
	];

/**
 * Morph granularity options (`<p159:morph @option>`), offered only when the
 * selected transition type is `morph`. Defaults to `byObject`, matching
 * PowerPoint's own default when the attribute is absent.
 */
export const TRANSITION_MORPH_OPTIONS: readonly SlideTransitionValueOption<PptxMorphOption>[] = [
	{ value: 'byObject', label: 'By Object', i18nKey: 'pptx.transition.morphOption.byObject' },
	{ value: 'byWord', label: 'By Word', i18nKey: 'pptx.transition.morphOption.byWord' },
	{ value: 'byChar', label: 'By Character', i18nKey: 'pptx.transition.morphOption.byChar' },
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
