/**
 * @fileoverview Save-side writer for slide-layout parts (`p:sldLayout`).
 *
 * Strategy mirrors {@link PptxHandlerRuntimeSaveSlideMaster}: layouts are
 * cached in `layoutXmlMap` and flushed to the ZIP by the save pipeline.
 * This writer mutates the cached XmlObject in place to apply typed-model
 * edits before the flush. Any field not part of the typed model
 * (transition, timing, extLst, raw spTree) is preserved verbatim.
 *
 * Slide-layout XML schema (ECMA-376 §19.3.1.40, CT_SlideLayout):
 *
 *   `<p:sldLayout>` attrs: `@matchingName`, `@type`, `@preserve`,
 *                          `@userDrawn`, `@showMasterPhAnim`
 *     `<p:cSld>` (`@name`, optional `<p:bg>`, `<p:spTree>`, …)
 *     `<p:clrMapOvr>` (optional)
 *     `<p:transition>` (optional)
 *     `<p:timing>` (optional)
 *     `<p:hf>` (optional)
 *     `<p:extLst>` (optional)
 */

import { XmlObject } from '../../types';
import type { PptxSlideLayout } from '../../types';
import {
	applyBackgroundColorToCSld,
	applyClrMapOverrideToLayoutRoot,
	applyHeaderFooterFlagsToNode,
} from './master-save-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSlideMaster';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Apply typed mutations from the supplied {@link PptxSlideLayout} array
	 * to each layout's cached XmlObject. Called by the save pipeline before
	 * the layoutXmlMap entries are flushed to the ZIP.
	 */
	protected applySlideLayoutChanges(layouts: PptxSlideLayout[] | undefined): void {
		if (!layouts || layouts.length === 0) {
			return;
		}
		for (const layout of layouts) {
			try {
				this.applySlideLayoutChange(layout);
			} catch (e) {
				console.warn(`Failed to apply slide layout changes for ${layout.path}:`, e);
			}
		}
	}

	private applySlideLayoutChange(layout: PptxSlideLayout): void {
		const xmlObj = this.layoutXmlMap.get(layout.path);
		if (!xmlObj) {
			return;
		}
		const root = xmlObj['p:sldLayout'] as XmlObject | undefined;
		if (!root) {
			return;
		}

		// Layout-level attribute mutations.
		if (layout.matchingName !== undefined) {
			const trimmed = layout.matchingName.trim();
			if (trimmed.length > 0) {
				root['@_matchingName'] = trimmed;
			} else {
				delete root['@_matchingName'];
			}
		}
		if (layout.preserve !== undefined) {
			root['@_preserve'] = layout.preserve ? '1' : '0';
		}
		if (layout.userDrawn !== undefined) {
			root['@_userDrawn'] = layout.userDrawn ? '1' : '0';
		}
		if (layout.showMasterPhAnim !== undefined) {
			root['@_showMasterPhAnim'] = layout.showMasterPhAnim ? '1' : '0';
		}

		// `<p:cSld>` — background colour and `@name`.
		const cSld = (root['p:cSld'] || {}) as XmlObject;
		applyBackgroundColorToCSld(cSld, layout.backgroundColor);
		if (layout.name !== undefined) {
			const trimmed = layout.name.trim();
			if (trimmed.length > 0) {
				cSld['@_name'] = trimmed;
			} else {
				delete cSld['@_name'];
			}
		}
		root['p:cSld'] = cSld;

		// `<p:clrMapOvr>` — colour-map override.
		applyClrMapOverrideToLayoutRoot(root, layout.clrMapOverride);

		// `<p:hf>` — header/footer flags.
		applyHeaderFooterFlagsToNode(root, layout.headerFooter);

		xmlObj['p:sldLayout'] = root;
		this.layoutXmlMap.set(layout.path, xmlObj);
	}
}
