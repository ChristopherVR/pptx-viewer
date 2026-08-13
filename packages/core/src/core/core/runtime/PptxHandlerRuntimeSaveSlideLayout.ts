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
import type { PptxSlideLayout, PptxSlideMaster } from '../../types';
import { masterPartLoadedBackground } from './master-part-background-cache';
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
	protected applySlideLayoutChanges(layouts: readonly PptxSlideLayout[] | undefined): void {
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

	/**
	 * Masters carry their layouts, so the layout writer has to run over the
	 * nested ones too.
	 *
	 * `save({ slideMasters })` is what every binding passes: the Slide Master
	 * view edits `slideMasters[i].layouts[j]`, and no binding has ever passed
	 * the separate `slideLayouts` option. Layout-level edits (background,
	 * `@name`, `@preserve`, `clrMapOverride`, header/footer flags) therefore
	 * reached no writer at all and were dropped on save, while the sibling
	 * shape-tree writer had already learned to descend
	 * ({@link PptxHandlerRuntimeSaveMasterElements.applySlideMasterElementChanges}).
	 */
	protected override applySlideMasterChanges(masters: PptxSlideMaster[] | undefined): void {
		super.applySlideMasterChanges(masters);
		for (const master of masters ?? []) {
			this.applySlideLayoutChanges(master.layouts);
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

		// `<p:cSld>`: background colour and `@name`. A layout that inherits its
		// background carries no `p:bg` at all, which is what the loaded record
		// says, so an untouched layout is left without one.
		const cSld = (root['p:cSld'] || {}) as XmlObject;
		applyBackgroundColorToCSld(
			cSld,
			layout.backgroundColor,
			masterPartLoadedBackground(this, layout.path),
		);
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
