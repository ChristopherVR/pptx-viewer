/**
 * schema-token-labels.ts: spell OOXML wire tokens for Angular templates.
 *
 * Several inspector controls used to print a schema enum straight into the DOM,
 * so a user picking a theme slot chose between `dk1` and `folHlink`, and a user
 * picking a cell pattern chose between `ltHorz` and `narVert`. Those are wire
 * values, not words, and they can never be translated.
 *
 * The token -> key catalogues live in `pptx-viewer-shared` so all five bindings
 * spell the same token the same way; this module is the thin Angular adapter
 * over them.
 *
 * WHY it resolves a KEY rather than finished text: shared's `schemaLabel` takes
 * a `translate` callback, but calling `TranslateService.instant()` from a
 * component getter freezes the wording of an `OnPush` component at the language
 * that happened to be active when it last rendered. Every other option list in
 * this package feeds an i18n key through `TranslatePipe`, which marks the view
 * for check when the language changes, so these do the same: `schemaLabel` is
 * called with an identity `translate`, which yields the mapped key (or the raw
 * token when a deck carries a value newer than the catalogue), and the template
 * pipes that through `translate`.
 *
 * @module angular-viewer/schema-token-labels
 */

import {
	ARROW_SIZE_LABEL_KEYS,
	ARROWHEAD_LABEL_KEYS,
	FILL_PATTERN_LABEL_KEYS,
	schemaLabel,
	SMARTART_COLOR_SCHEME_LABEL_KEYS,
	SMARTART_LAYOUT_LABEL_KEYS,
	SMARTART_STYLE_LABEL_KEYS,
	THEME_COLOR_SLOT_LABEL_KEYS,
} from '../internal/shared';

/** Identity `translate`, so `schemaLabel` hands back the key it looked up. */
function asKey(key: string): string {
	return key;
}

/**
 * The i18n key a wire token should render through, or the token itself when the
 * catalogue has no entry for it (an unmapped token is still better shown than
 * blanked; `TranslatePipe` echoes an unknown key unchanged).
 */
export function schemaLabelKey(
	keys: Readonly<Record<string, string>>,
	token: string | undefined,
): string {
	return schemaLabel(keys, token, asKey);
}

/** `a:clrScheme` slot (`dk1`, `lt2`, `accent3`, `folHlink`, ...). */
export function themeColorSlotLabelKey(slot: string): string {
	return schemaLabelKey(THEME_COLOR_SLOT_LABEL_KEYS, slot);
}

/** SmartArt colour variation (`colorful1` ... `monochromatic2`). */
export function smartArtColorSchemeLabelKey(scheme: string): string {
	return schemaLabelKey(SMARTART_COLOR_SCHEME_LABEL_KEYS, scheme);
}

/** SmartArt style intensity (`flat` / `moderate` / `intense`). */
export function smartArtStyleLabelKey(style: string): string {
	return schemaLabelKey(SMARTART_STYLE_LABEL_KEYS, style);
}

/** SmartArt layout family (`list`, `process`, `bending`, ...). */
export function smartArtLayoutLabelKey(layout: string): string {
	return schemaLabelKey(SMARTART_LAYOUT_LABEL_KEYS, layout);
}

/**
 * `a:headEnd`/`a:tailEnd` arrowhead type (`none`, `triangle`, `arrow`, ...).
 *
 * WHY it goes through the shared catalogue instead of interpolating the token
 * into `pptx.arrowhead.<token>`: that shortcut spelled `arrow` as "Arrow",
 * while the other four bindings (which all read this catalogue) spelled it
 * "Open Arrow", which is what PowerPoint calls that head (`msoArrowheadOpen`).
 * The same control therefore read differently depending on the framework.
 */
export function arrowheadLabelKey(type: string): string {
	return schemaLabelKey(ARROWHEAD_LABEL_KEYS, type);
}

/** Arrowhead width/length step (`sm` / `med` / `lg`). */
export function arrowSizeLabelKey(size: string): string {
	return schemaLabelKey(ARROW_SIZE_LABEL_KEYS, size);
}

/** `a:pattFill/@prst` preset (`pct5`, `ltDnDiag`, `zigZag`, ...). */
export function fillPatternLabelKey(preset: string): string {
	return schemaLabelKey(FILL_PATTERN_LABEL_KEYS, preset);
}
