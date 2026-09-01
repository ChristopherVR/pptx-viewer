/**
 * `stroke-line-style-options` - the pure option catalogues backing the
 * inspector's compound-line, line-join, and line-cap pickers.
 *
 * WHY this lives in shared: `COMPOUND_LINE_OPTIONS`, `LINE_JOIN_OPTIONS`, and
 * `LINE_CAP_OPTIONS` previously sat inside React's
 * `fill-stroke-options.ts` as bare data with no framework in them, so a
 * binding porting the fill/stroke panel had to retype the 11 values (and
 * their i18n keys) by hand. React now re-exports these from here so there is
 * exactly one list to update.
 *
 * @module render/stroke-line-style-options
 */
import type { ShapeStyle } from 'pptx-viewer-core';

/** A selectable stroke-styling value with its English label and i18n key. */
export interface StrokeLineStyleOption<T extends string> {
	value: T;
	label: string;
	i18nKey: string;
}

/** Every `a:ln/@cmpd` (compound line) value offered by the inspector. */
export const COMPOUND_LINE_OPTIONS: readonly StrokeLineStyleOption<
	NonNullable<ShapeStyle['compoundLine']>
>[] = [
	{ value: 'sng', label: 'Single', i18nKey: 'pptx.strokeOptions.compoundSingle' },
	{ value: 'dbl', label: 'Double', i18nKey: 'pptx.strokeOptions.compoundDouble' },
	{ value: 'thickThin', label: 'Thick-Thin', i18nKey: 'pptx.strokeOptions.compoundThickThin' },
	{ value: 'thinThick', label: 'Thin-Thick', i18nKey: 'pptx.strokeOptions.compoundThinThick' },
	{ value: 'tri', label: 'Triple', i18nKey: 'pptx.strokeOptions.compoundTriple' },
];

/** Every `a:ln/a:*Join` (line join) value offered by the inspector. */
export const LINE_JOIN_OPTIONS: readonly StrokeLineStyleOption<
	NonNullable<ShapeStyle['lineJoin']>
>[] = [
	{ value: 'round', label: 'Round', i18nKey: 'pptx.strokeOptions.joinRound' },
	{ value: 'bevel', label: 'Bevel', i18nKey: 'pptx.strokeOptions.joinBevel' },
	{ value: 'miter', label: 'Miter', i18nKey: 'pptx.strokeOptions.joinMiter' },
];

/** Every `a:ln/@cap` (line cap) value offered by the inspector. */
export const LINE_CAP_OPTIONS: readonly StrokeLineStyleOption<
	NonNullable<ShapeStyle['lineCap']>
>[] = [
	{ value: 'flat', label: 'Flat', i18nKey: 'pptx.strokeOptions.capFlat' },
	{ value: 'rnd', label: 'Round', i18nKey: 'pptx.strokeOptions.capRound' },
	{ value: 'sq', label: 'Square', i18nKey: 'pptx.strokeOptions.capSquare' },
];
