/**
 * The four `ST_PlaceholderType` values the Header & Footer dialog owns, and the
 * inheritance rules that are special to them.
 *
 * Verified against PowerPoint through COM (see `header-footer-parts.ts`): the
 * footer / date / slide-number TEXT lives in the slide MASTER's `ftr` / `dt` /
 * `sldNum` placeholder shapes, and PowerPoint leaves each slide's copy of the
 * placeholder EMPTY so it inherits. Per-slide visibility is expressed by the
 * presence or absence of the shape, and no `p:hf` is written on `p:sld` at all.
 *
 * Two consequences drive everything in this module:
 *
 *  - These placeholders exist at most ONCE per part, so PowerPoint does not
 *    keep their `@idx` aligned down the chain. A deck it authors typically
 *    numbers them 10 / 11 / 12 on the layout and 2 / 3 / 4 on the master, so
 *    matching a slide's `ftr` to the master by `idx` finds nothing and the
 *    placeholder resolves neither its transform nor its text. They must be
 *    matched by TYPE across the inheritance chain.
 *  - An EMPTY body on one of them is an instruction to render the ancestor's
 *    string, not an empty footer. That is the opposite of a `title` or `body`
 *    placeholder, whose ancestor text is prompt text ("Click to edit Master
 *    title style") and must never be rendered as content.
 *
 * @module header-footer-placeholder
 */

/**
 * `ST_PlaceholderType` values that are singletons per part and whose text is
 * inherited rather than prompted. Lower-cased, matching the normalisation
 * `extractPlaceholderInfo` applies to `p:ph/@type`.
 */
const HEADER_FOOTER_PLACEHOLDER_TYPES: ReadonlySet<string> = new Set([
	'hdr',
	'ftr',
	'dt',
	'sldnum',
]);

/**
 * `a:fld/@type` equivalent for a placeholder whose inherited text is a LITERAL
 * run rather than a field.
 *
 * `dt` and `sldNum` masters carry a real `a:fld` (`datetime1`, `slidenum`)
 * which already parses with its own field type, so they are absent here. A
 * footer / header master run is plain text, and tagging the inherited segment
 * as a field is what makes the canvas follow the Header & Footer dialog live:
 * the shared substitution resolves `footer` from `PptxHeaderFooter.footerText`,
 * so editing the footer repaints without a reload.
 */
const INHERITED_FIELD_TYPES: Readonly<Record<string, string>> = {
	ftr: 'footer',
	hdr: 'header',
};

/** Whether `type` is one of the four placeholders the dialog owns. */
export function isHeaderFooterPlaceholder(type: string | undefined): boolean {
	return type !== undefined && HEADER_FOOTER_PLACEHOLDER_TYPES.has(type.trim().toLowerCase());
}

/**
 * The field type to stamp on text inherited by `type`, or `undefined` when the
 * inherited runs already carry their own (`dt`, `sldNum`).
 */
export function inheritedPlaceholderFieldType(type: string | undefined): string | undefined {
	if (type === undefined) {
		return undefined;
	}
	return INHERITED_FIELD_TYPES[type.trim().toLowerCase()];
}
