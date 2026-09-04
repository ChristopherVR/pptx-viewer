/**
 * decorative-extension.ts - "Mark as decorative" accessibility extension
 * (issue G16).
 *
 * PowerPoint's Alt Text pane writes
 * `p:cNvPr/a:extLst/a:ext[@uri='{C183D7F6-B498-43B3-948B-1728B52AA6E4}']/
 * adec:decorative val="1"` when a shape or picture is marked decorative, a
 * vendor extension it round-trips and screen readers/exporters honor.
 * Isolated in its own module so the read (parse) and write (save) halves of
 * the contract stay next to each other and are directly unit-testable.
 */
import type { XmlObject } from '../types';

/** MS-ODRAWXML "Mark as decorative" extension GUID (`adec` namespace). */
export const DECORATIVE_EXT_URI = '{C183D7F6-B498-43B3-948B-1728B52AA6E4}';

/** Narrow an `a:ext` bag (single node or array) to an array. */
function extArray(rawExt: unknown): XmlObject[] {
	if (Array.isArray(rawExt)) {
		return rawExt as XmlObject[];
	}
	return rawExt ? [rawExt as XmlObject] : [];
}

/**
 * Read whether a `p:cNvPr` node is marked decorative via its `a:extLst`.
 *
 * Returns `undefined` (not `false`) when the extension is absent, so callers
 * can distinguish "not marked" from "explicitly authored as not decorative"
 * and preserve the former untouched on save.
 */
export function isCNvPrMarkedDecorative(cNvPr: XmlObject | undefined): boolean | undefined {
	const extLst = cNvPr?.['a:extLst'] as XmlObject | undefined;
	if (!extLst) {
		return undefined;
	}
	for (const ext of extArray(extLst['a:ext'])) {
		if (String(ext?.['@_uri'] || '') !== DECORATIVE_EXT_URI) {
			continue;
		}
		const decorative = ext['adec:decorative'] as XmlObject | undefined;
		if (!decorative) {
			continue;
		}
		const val = String(decorative['@_val'] ?? '')
			.trim()
			.toLowerCase();
		return val === '1' || val === 'true';
	}
	return undefined;
}

/**
 * Write (or clear) the decorative `a:ext` node on `cNvPr` in place, preserving
 * any other `a:ext` entries already on its `a:extLst`.
 *
 * `isDecorative === undefined` is a no-op (preserves whatever the raw XML
 * already has, matching the "carried when unset" pattern used for locks that
 * not every parse path populates yet). `false` removes the decorative ext
 * entirely rather than writing `val="0"`, matching how PowerPoint itself
 * clears "Mark as decorative" (it deletes the ext, it does not write a
 * negative value).
 */
export function serializeDecorativeExtension(
	cNvPr: XmlObject,
	isDecorative: boolean | undefined,
): void {
	if (isDecorative === undefined) {
		return;
	}
	const existingExtLst = cNvPr['a:extLst'] as XmlObject | undefined;
	const others = extArray(existingExtLst?.['a:ext']).filter(
		(ext) => String(ext?.['@_uri'] || '') !== DECORATIVE_EXT_URI,
	);

	if (!isDecorative) {
		if (others.length === 0) {
			delete cNvPr['a:extLst'];
		} else {
			cNvPr['a:extLst'] = { 'a:ext': others.length === 1 ? others[0] : others };
		}
		return;
	}

	const decorativeExt: XmlObject = {
		'@_uri': DECORATIVE_EXT_URI,
		'adec:decorative': { '@_val': '1' },
	};
	const allExts = [...others, decorativeExt];
	cNvPr['a:extLst'] = { 'a:ext': allExts.length === 1 ? allExts[0] : allExts };
}
