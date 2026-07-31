/**
 * schema-label-keys.ts: i18n keys for OOXML wire tokens that bindings display
 * in selects, swatches and toggle groups.
 *
 * WHY this exists: several controls across the five bindings render a schema
 * enum straight into the DOM, so users were shown `dk1`, `folHlink`,
 * `colorful1` or `ltDnDiag` as if they were English. Those are wire values from
 * the OOXML schema; they are not words, and rendering them means the control
 * can never be translated. A few bindings had already invented private English
 * maps for the same tokens, which is how `Followed Hyperlink` ended up spelled
 * in three places.
 *
 * These maps deliberately hold KEYS, not option lists. A binding keeps whatever
 * value set it already offers and only changes how each value is spelled, so
 * wiring one up cannot silently add or drop an option (which would move a
 * control out of parity with React).
 *
 * @module render/schema-label-keys
 */

/** Resolve a wire token to translated text, falling back to the raw token. */
export function schemaLabel(
	keys: Readonly<Record<string, string>>,
	token: string | undefined,
	translate: (key: string) => string,
): string {
	if (token === undefined) {
		return '';
	}
	const key = keys[token];
	// An unmapped token is still better shown than blanked: a deck may carry a
	// value newer than this table, and hiding it would make the control look
	// broken rather than merely untranslated.
	return key === undefined ? token : translate(key);
}

/**
 * The 12 `a:clrScheme` slots. PowerPoint calls these Dark 1 / Light 1 / Accent
 * n / Hyperlink in its own colour pickers, which is the wording used here.
 */
export const THEME_COLOR_SLOT_LABEL_KEYS: Readonly<Record<string, string>> = {
	dk1: 'pptx.themeColor.dark1',
	lt1: 'pptx.themeColor.light1',
	dk2: 'pptx.themeColor.dark2',
	lt2: 'pptx.themeColor.light2',
	accent1: 'pptx.themeColor.accent1',
	accent2: 'pptx.themeColor.accent2',
	accent3: 'pptx.themeColor.accent3',
	accent4: 'pptx.themeColor.accent4',
	accent5: 'pptx.themeColor.accent5',
	accent6: 'pptx.themeColor.accent6',
	hlink: 'pptx.themeColor.hyperlink',
	folHlink: 'pptx.themeColor.followedHyperlink',
};

/** SmartArt colour variations (`dgm:colorsDef` families the editor offers). */
export const SMARTART_COLOR_SCHEME_LABEL_KEYS: Readonly<Record<string, string>> = {
	colorful1: 'pptx.smartart.schemeColorful1',
	colorful2: 'pptx.smartart.schemeColorful2',
	colorful3: 'pptx.smartart.schemeColorful3',
	monochromatic1: 'pptx.smartart.schemeMonochromatic1',
	monochromatic2: 'pptx.smartart.schemeMonochromatic2',
};

/** SmartArt style intensities (`dgm:styleDef` families the editor offers). */
export const SMARTART_STYLE_LABEL_KEYS: Readonly<Record<string, string>> = {
	flat: 'pptx.smartart.styleFlat',
	moderate: 'pptx.smartart.styleModerate',
	intense: 'pptx.smartart.styleIntense',
};

/**
 * SmartArt layout families offered by the layout switcher. React already
 * resolved `pptx.smartart.category.<type>` but only five of the fourteen keys
 * existed, so the rest fell through to the missing-key handler and rendered a
 * de-camel-cased key tail. Listing them here keeps the set honest.
 */
export const SMARTART_LAYOUT_LABEL_KEYS: Readonly<Record<string, string>> = {
	list: 'pptx.smartart.category.list',
	process: 'pptx.smartart.category.process',
	cycle: 'pptx.smartart.category.cycle',
	hierarchy: 'pptx.smartart.category.hierarchy',
	relationship: 'pptx.smartart.category.relationship',
	matrix: 'pptx.smartart.category.matrix',
	pyramid: 'pptx.smartart.category.pyramid',
	funnel: 'pptx.smartart.category.funnel',
	target: 'pptx.smartart.category.target',
	gear: 'pptx.smartart.category.gear',
	venn: 'pptx.smartart.category.venn',
	timeline: 'pptx.smartart.category.timeline',
	chevron: 'pptx.smartart.category.chevron',
	bending: 'pptx.smartart.category.bending',
};

/** `a:headEnd`/`a:tailEnd` arrowhead types. */
export const ARROWHEAD_LABEL_KEYS: Readonly<Record<string, string>> = {
	none: 'pptx.arrowhead.none',
	triangle: 'pptx.arrowhead.triangle',
	stealth: 'pptx.arrowhead.stealth',
	diamond: 'pptx.arrowhead.diamond',
	oval: 'pptx.arrowhead.oval',
	arrow: 'pptx.arrowhead.openArrow',
};

/** Arrowhead width/length steps (`@w`/`@len`: `sm`, `med`, `lg`). */
export const ARROW_SIZE_LABEL_KEYS: Readonly<Record<string, string>> = {
	sm: 'pptx.connectorOptions.sizeSmall',
	med: 'pptx.connectorOptions.sizeMedium',
	lg: 'pptx.connectorOptions.sizeLarge',
};
