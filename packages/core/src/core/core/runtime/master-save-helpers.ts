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
 * Apply a typed background colour to a `<p:cSld>` node in place. When
 * `backgroundColor` is undefined the existing background (if any) is left
 * alone — callers signal "remove" by passing an empty string, which clears
 * the `<p:bg>` child.
 */
export function applyBackgroundColorToCSld(
	cSld: XmlObject,
	backgroundColor: string | undefined,
): void {
	if (backgroundColor === undefined) {
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
