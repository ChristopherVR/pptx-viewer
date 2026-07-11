/**
 * color-swatches.ts: the canonical "Office Standard Colors" swatch catalogue
 * shared by every binding's colour pickers (font colour, highlight colour,
 * and any future fill/line colour picker that wants the same 10-swatch grid).
 *
 * Mirrors the "Standard Colors" row PowerPoint itself ships. Before this
 * module existed, the VanillaJS (`swatch-picker.ts`) and Svelte
 * (`SwatchColorPicker.svelte`) bindings each independently hardcoded an
 * identical 10-colour list; this module is the single source of truth going
 * forward so no binding drifts from the others.
 *
 * There is no shared-i18n dictionary key for individual colour names yet
 * (only the `pptx.ribbon.customColour` "Custom colour..." row label exists),
 * so {@link OfficeColorSwatch.label} is a plain English fallback rather than
 * an `i18nKey`, matching the optional-label convention used elsewhere in this
 * module family (e.g. `LineSpacingOption` in `text-format-presets.ts`).
 *
 * @module render/color-swatches
 */

/** One entry in the Office standard colour swatch grid. */
export interface OfficeColorSwatch {
	/** Swatch colour as a lower-case `#rrggbb` hex string. */
	hex: string;
	/** English fallback name for the swatch (used for tooltips/aria-labels). */
	label: string;
}

/**
 * The canonical 10-swatch "Office Standard Colors" catalogue, in PowerPoint's
 * on-screen order. Consumed by the font-colour and highlight-colour pickers
 * (and any other picker that wants the same standard set) across every
 * binding.
 */
export const OFFICE_COLOR_SWATCHES: readonly OfficeColorSwatch[] = [
	{ hex: '#000000', label: 'Black' },
	{ hex: '#ffffff', label: 'White' },
	{ hex: '#ff0000', label: 'Red' },
	{ hex: '#00aa00', label: 'Green' },
	{ hex: '#0000ff', label: 'Blue' },
	{ hex: '#ff8800', label: 'Orange' },
	{ hex: '#8800cc', label: 'Purple' },
	{ hex: '#00cccc', label: 'Cyan' },
	{ hex: '#ff69b4', label: 'Pink' },
	{ hex: '#808080', label: 'Gray' },
];

/**
 * The same catalogue flattened to bare `#rrggbb` hex strings, in the same
 * order as {@link OFFICE_COLOR_SWATCHES}. A drop-in replacement for the
 * `readonly string[]` swatch lists the vanilla and Svelte bindings each
 * hardcoded locally before this module existed.
 */
export const OFFICE_COLOR_SWATCH_HEXES: readonly string[] = OFFICE_COLOR_SWATCHES.map(
	(swatch) => swatch.hex,
);
