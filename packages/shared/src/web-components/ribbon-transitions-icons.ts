/**
 * Thumbnails for the Transitions gallery on a 36x24 stroke grid, drawn as
 * PowerPoint's tiles are: the slide outline plus a hint of the motion.
 */
export const RIBBON_TRANSITION_TILE_PATHS: Readonly<Record<string, string>> = {
	none: 'M5 3h26v18H5z',
	fade: 'M5 3h26v18H5z M9 8h18 M9 12h18 M9 16h18',
	push: 'M5 3h26v18H5z M10 12h14 M20 8l4 4-4 4',
	wipe: 'M5 3h26v18H5z M18 3v18 M9 12h6 M12 9l3 3-3 3',
	split: 'M5 3h26v18H5z M18 3v18 M15 12H9 M11 9l-3 3 3 3 M21 12h6 M25 9l3 3-3 3',
	reveal: 'M5 3h18v13H5z M13 8h18v13H13z',
	cut: 'M5 3h26v18H5z M21 3v7h10',
	cover: 'M5 3h18v13H5z M13 8h18v13H13z M28 18 20 10 M20 15v-5h5',
	uncover: 'M5 3h18v13H5z M13 8h18v13H13z M20 10l8 8 M28 13v5h-5',
};

/** Fallback artwork for a transition type without a bespoke tile. */
export const RIBBON_TRANSITION_TILE_DEFAULT = RIBBON_TRANSITION_TILE_PATHS.none;
