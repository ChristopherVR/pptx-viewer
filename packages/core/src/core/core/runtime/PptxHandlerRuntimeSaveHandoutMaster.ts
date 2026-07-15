/**
 * @fileoverview Save-side writer for the handout master part
 * (`p:handoutMaster`, ECMA-376 §19.3.1.24, CT_HandoutMaster).
 *
 * Handout master XML schema:
 *
 *   `<p:handoutMaster>` →
 *     `<p:cSld>` (optional `<p:bg>`, `<p:spTree>`, …)
 *     `<p:clrMap>` (12 alias attributes, REQUIRED)
 *     `<p:hf>` (optional)
 *     `<p:extLst>` (optional)
 *
 * Strategy mirrors {@link PptxHandlerRuntimeSaveNotesMaster}: read part,
 * apply typed-model mutations, write back. Background colour is handled by
 * the pre-existing
 * {@link PptxHandlerRuntimeSaveDocumentParts.applyHandoutMasterChanges};
 * this writer covers clrMap + header/footer flags without duplicating it.
 */

import { XmlObject } from '../../types';
import type { PptxHandoutMaster } from '../../types';
import { COLOR_MAP_ALIAS_KEYS, DEFAULT_COLOR_MAP } from '../../utils/theme-override-utils';
import type { PptxSaveState } from '../builders';
import type { PptxSaveConstants } from '../factories';
import { applyHeaderFooterFlagsToNode } from './master-save-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveNotesMaster';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Apply clrMap and headerFooter mutations to the handout master XML.
	 */
	protected async applyHandoutMasterStructuralChanges(
		handoutMaster: PptxHandoutMaster | undefined,
		saveSession: PptxSaveState,
		constants: PptxSaveConstants,
	): Promise<void> {
		if (!handoutMaster) {
			return;
		}
		if (
			handoutMaster.clrMap === undefined &&
			handoutMaster.headerFooter === undefined &&
			handoutMaster.elements === undefined
		) {
			return;
		}
		const file = this.zip.file(handoutMaster.path);
		if (!file) {
			return;
		}
		try {
			const xml = await file.async('string');
			const data = this.parser.parse(xml) as XmlObject;
			const root = data?.['p:handoutMaster'] as XmlObject | undefined;
			if (!root) {
				return;
			}

			if (handoutMaster.clrMap !== undefined) {
				root['p:clrMap'] = buildClrMapAttributes(handoutMaster.clrMap);
			}

			applyHeaderFooterFlagsToNode(root, handoutMaster.headerFooter);
			await this.applyAuxiliaryMasterElementChanges(
				handoutMaster.path,
				'p:handoutMaster',
				data,
				handoutMaster.elements,
				saveSession,
				constants,
			);

			data['p:handoutMaster'] = root;
			this.zip.file(handoutMaster.path, this.builder.build(data));
		} catch (e) {
			console.warn('Failed to save handout master structural changes:', e);
		}
	}
}

function buildClrMapAttributes(clrMap: Record<string, string>): XmlObject {
	const attrs: Record<string, string> = {};
	for (const key of COLOR_MAP_ALIAS_KEYS) {
		const value = clrMap[key];
		attrs[`@_${key}`] =
			value && typeof value === 'string' && value.length > 0 ? value : DEFAULT_COLOR_MAP[key];
	}
	return attrs;
}
