/**
 * @fileoverview Shared helpers for the master/layout save writers.
 *
 * Used by:
 *   {@link PptxHandlerRuntimeSaveSlideMaster}
 *   {@link PptxHandlerRuntimeSaveSlideLayout}
 *   {@link PptxHandlerRuntimeSaveNotesMaster}
 *   {@link PptxHandlerRuntimeSaveHandoutMaster}
 *
 * These mutate cached XmlObjects in place to apply typed-model changes
 * while preserving every other element of the parsed XML verbatim.
 */

import type { XmlObject, PptxHeaderFooterFlags } from '../../types';

/**
 * Apply the typed {@link PptxHeaderFooterFlags} to a parsed CT-level node
 * (`p:sldMaster`, `p:sldLayout`, `p:notesMaster`, `p:handoutMaster`).
 *
 * Only emits a `<p:hf>` element when at least one flag has been explicitly
 * set on the typed model. Otherwise the existing node is preserved as-is so
 * the round-trip stays byte-stable.
 */
export function applyHeaderFooterFlagsToNode(
	root: XmlObject,
	flags: PptxHeaderFooterFlags | undefined,
): void {
	if (!flags || Object.keys(flags).length === 0) {
		return;
	}
	const existing = (root['p:hf'] || {}) as XmlObject;
	if (flags.hasHeader !== undefined) {
		existing['@_hdr'] = flags.hasHeader ? '1' : '0';
	}
	if (flags.hasFooter !== undefined) {
		existing['@_ftr'] = flags.hasFooter ? '1' : '0';
	}
	if (flags.hasDateTime !== undefined) {
		existing['@_dt'] = flags.hasDateTime ? '1' : '0';
	}
	if (flags.hasSlideNumber !== undefined) {
		existing['@_sldNum'] = flags.hasSlideNumber ? '1' : '0';
	}
	root['p:hf'] = existing;
}

/**
 * Apply a *chosen* background colour to a `<p:cSld>` node in place.
 *
 * `<p:bg>` has two mutually exclusive shapes (§19.3.1.1, CT_Background):
 * `<p:bgPr>` is a literal fill, `<p:bgRef idx="…">` points into the theme's
 * `<a:bgFillStyleLst>` so the part follows its theme. Replacing the second
 * with the first is destructive, and it is exactly what a caller that cannot
 * tell "the loader flattened a `bgRef` to paint it" from "the user picked a
 * colour" will do on every save.
 *
 * Which is why `loadedBackgroundColor` exists: pass what the loader resolved
 * for this part and an unchanged colour is a no-op, leaving a `bgRef` (or a
 * gradient, or a picture fill) exactly as authored.
 *
 * When the colour *has* changed, overwriting `bgRef` is correct, because that
 * is what PowerPoint itself writes. Verified by COM: setting
 * `CustomLayouts(1).Background.Fill.Solid()` on a stock deck whose master
 * carried `<p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef>` emits
 * `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
 * <a:effectLst/></p:bgPr></p:bg>` and drops the reference, on the layout and
 * on the master alike. Untouched layouts keep no `<p:bg>` at all.
 *
 * `undefined` means "not specified, leave it alone"; the empty string means
 * "remove", which clears `<p:bg>` and restores inheritance from the master.
 */
export function applyBackgroundColorToCSld(
	cSld: XmlObject,
	backgroundColor: string | undefined,
	loadedBackgroundColor?: string | undefined,
): void {
	if (backgroundColor === undefined) {
		return;
	}
	if (!backgroundColorChanged(backgroundColor, loadedBackgroundColor)) {
		return;
	}
	if (backgroundColor === '') {
		delete cSld['p:bg'];
		return;
	}
	const hex = backgroundColor.replace(/^#/, '').toUpperCase();
	cSld['p:bg'] = {
		'p:bgPr': {
			'a:solidFill': { 'a:srgbClr': { '@_val': hex } },
			'a:effectLst': {},
		},
	};
}

/**
 * True when the requested colour differs from the loaded one. Comparison
 * ignores `#` and case, because a colour input hands back `#ffffff` for the
 * `FFFFFF` the parser produced and that is not an edit.
 *
 * An omitted `loadedBackgroundColor` means the caller has no record, so the
 * request is taken at face value and the existing behaviour is preserved.
 */
function backgroundColorChanged(
	backgroundColor: string,
	loadedBackgroundColor: string | undefined,
): boolean {
	if (loadedBackgroundColor === undefined) {
		return true;
	}
	const normalise = (value: string): string => value.trim().replace(/^#/, '').toUpperCase();
	return normalise(backgroundColor) !== normalise(loadedBackgroundColor);
}

/**
 * Apply a typed `clrMapOverride` map to a slide-layout root in place.
 *
 * Slide layouts use `<p:clrMapOvr>` with either:
 * - `<a:masterClrMapping/>` — inherit the master's clrMap (default), or
 * - `<a:overrideClrMapping ...>` with the 12 alias attributes set.
 *
 * Pass `undefined` to leave the existing node untouched. Pass an empty
 * record to switch to `<a:masterClrMapping/>`. Pass a populated record to
 * emit `<a:overrideClrMapping>` with the supplied attributes (any missing
 * alias keys are dropped — slide layout overrides may be partial).
 */
export function applyClrMapOverrideToLayoutRoot(
	root: XmlObject,
	override: Record<string, string> | undefined,
): void {
	if (override === undefined) {
		return;
	}
	if (Object.keys(override).length === 0) {
		root['p:clrMapOvr'] = { 'a:masterClrMapping': {} };
		return;
	}
	const attrs: Record<string, string> = {};
	for (const [key, value] of Object.entries(override)) {
		if (typeof value === 'string' && value.length > 0) {
			attrs[`@_${key}`] = value;
		}
	}
	root['p:clrMapOvr'] = { 'a:overrideClrMapping': attrs };
}
