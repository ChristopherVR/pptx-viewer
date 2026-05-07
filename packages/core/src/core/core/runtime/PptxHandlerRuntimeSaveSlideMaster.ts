/**
 * @fileoverview Save-side writer for slide-master parts (`p:sldMaster`).
 *
 * Strategy: every loaded master's parsed XML lives in `masterXmlMap` and is
 * already flushed back to the ZIP by {@link PptxHandlerRuntimeSavePipeline}.
 * Without intervention, those flushes are byte-for-byte passthroughs because
 * the typed model never touches the cached XmlObject.
 *
 * This writer takes the optional `slideMasters` array supplied via
 * {@link PptxHandlerSaveOptions.slideMasters} and, for each entry, mutates
 * the corresponding {@link masterXmlMap} entry in place so that subsequent
 * passthrough emits the requested edits. Fields that are not part of the
 * typed model (`txStyles`, `transition`, `timing`, `extLst`, raw shape tree)
 * are left untouched, preserving them verbatim across the round-trip.
 *
 * Slide-master XML schema (ECMA-376 §19.3.1.42, CT_SlideMaster):
 *
 *   `<p:sldMaster>` →
 *     `<p:cSld>` (optional `@name`, optional `<p:bg>`, `<p:spTree>`, …)
 *     `<p:clrMap>` (12 alias attributes, REQUIRED)
 *     `<p:sldLayoutIdLst>` (optional)
 *     `<p:transition>` (optional)
 *     `<p:timing>` (optional)
 *     `<p:hf>` (optional)
 *     `<p:txStyles>` (optional)
 *     `<p:extLst>` (optional)
 */

import { XmlObject } from '../../types';
import type { PptxSlideMaster } from '../../types';
import { COLOR_MAP_ALIAS_KEYS, DEFAULT_COLOR_MAP } from '../../utils/theme-override-utils';
import { applyHeaderFooterFlagsToNode, applyBackgroundColorToCSld } from './master-save-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveTheme';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Apply typed mutations from the supplied {@link PptxSlideMaster} array
	 * to each master's cached XmlObject. Called by the save pipeline before
	 * the masterXmlMap entries are flushed to the ZIP.
	 */
	protected applySlideMasterChanges(masters: PptxSlideMaster[] | undefined): void {
		if (!masters || masters.length === 0) {
			return;
		}
		for (const master of masters) {
			try {
				this.applySlideMasterChange(master);
			} catch (e) {
				console.warn(`Failed to apply slide master changes for ${master.path}:`, e);
			}
		}
	}

	private applySlideMasterChange(master: PptxSlideMaster): void {
		const xmlObj = this.masterXmlMap.get(master.path);
		if (!xmlObj) {
			return;
		}
		const root = xmlObj['p:sldMaster'] as XmlObject | undefined;
		if (!root) {
			return;
		}

		// `<p:cSld>` — background colour and optional name attribute.
		const cSld = (root['p:cSld'] || {}) as XmlObject;
		applyBackgroundColorToCSld(cSld, master.backgroundColor);
		if (master.name !== undefined) {
			const trimmed = master.name.trim();
			if (trimmed.length > 0) {
				cSld['@_name'] = trimmed;
			} else {
				delete cSld['@_name'];
			}
		}
		root['p:cSld'] = cSld;

		// `<p:clrMap>` — REQUIRED on slide master per CT_SlideMaster. Build
		// an attribute set covering all 12 aliases. Missing entries fall
		// back to the OOXML default mapping so PowerPoint never sees a
		// partial dictionary (which would fail schema validation).
		if (master.clrMap !== undefined) {
			root['p:clrMap'] = buildClrMapAttributes(master.clrMap);
		}

		// `<p:hf>` — header/footer flags. Only emit when typed model has at
		// least one explicit flag, otherwise preserve whatever was on the
		// node (or absent) verbatim.
		applyHeaderFooterFlagsToNode(root, master.headerFooter);

		xmlObj['p:sldMaster'] = root;
		// Re-cache the mutated object so SavePipeline's flush picks it up.
		this.masterXmlMap.set(master.path, xmlObj);
	}
}

/**
 * Build a `<p:clrMap>` XmlObject from a partial alias dictionary. Missing
 * keys fall back to {@link DEFAULT_COLOR_MAP} so the emitted node always
 * has all 12 aliases (which the OOXML schema requires).
 */
function buildClrMapAttributes(clrMap: Record<string, string>): XmlObject {
	const attrs: Record<string, string> = {};
	for (const key of COLOR_MAP_ALIAS_KEYS) {
		const value = clrMap[key];
		attrs[`@_${key}`] =
			value && typeof value === 'string' && value.length > 0 ? value : DEFAULT_COLOR_MAP[key];
	}
	return attrs;
}
