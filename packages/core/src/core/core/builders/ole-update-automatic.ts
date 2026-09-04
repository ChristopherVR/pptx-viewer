import type { OlePptxElement, XmlObject } from '../../types';

/**
 * `p:link/@updateAutomatic` (`CT_OleObjectLink`, ECMA-376 §19.3.2.4): whether
 * a linked OLE object refreshes automatically from its source (PowerPoint's
 * Edit Links dialog "Automatic" vs. "Manual" radio buttons). Split into its
 * own module (P1-G3) rather than growing `PptxGraphicFrameParser.ts` /
 * `PptxHandlerRuntimeSaveShapeXml.ts`, both already well past the file-size
 * limit.
 */

/**
 * Parse `p:link/@updateAutomatic` into a boolean. Only present on the
 * `p:link` child (linked OLE objects); the schema default is `false`.
 * Returns `undefined` when the attribute is absent so a save that never
 * touches this field does not fabricate a value it never read.
 */
export function parseOleUpdateAutomatic(linkNode: XmlObject | undefined): boolean | undefined {
	const raw = linkNode?.['@_updateAutomatic'];
	if (raw === undefined) {
		return undefined;
	}
	return String(raw) === '1' || String(raw).toLowerCase() === 'true';
}

/**
 * The `@_updateAutomatic` XML attribute value for a freshly-fabricated
 * `p:link` node. Schema default is `false` - never assume `true` just
 * because a `p:link` node is being fabricated (the previous behaviour always
 * hardcoded `'1'` regardless of the typed field).
 */
export function oleUpdateAutomaticAttr(el: Pick<OlePptxElement, 'oleUpdateAutomatic'>): string {
	return el.oleUpdateAutomatic ? '1' : '0';
}
