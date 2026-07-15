/**
 * @fileoverview Save-side writer for the notes master part
 * (`p:notesMaster`, ECMA-376 §19.3.1.27, CT_NotesMaster).
 *
 * Notes master XML schema:
 *
 *   `<p:notesMaster>` →
 *     `<p:cSld>` (optional `<p:bg>`, `<p:spTree>`, …)
 *     `<p:clrMap>` (12 alias attributes, REQUIRED)
 *     `<p:hf>` (optional)
 *     `<p:notesStyle>` (optional)
 *     `<p:extLst>` (optional)
 *
 * Strategy: the notes master is not cached in any XmlObject map (unlike
 * slide masters/layouts), so this writer reads the existing part from the
 * ZIP, applies typed-model mutations, and writes it back. Fields not part
 * of the typed model — `<p:notesStyle>`, `<p:extLst>`, raw spTree — are
 * preserved verbatim. The pre-existing
 * {@link PptxHandlerRuntimeSaveDocumentParts.applyNotesMasterChanges}
 * already covers background; this writer extends coverage to clrMap +
 * header/footer flags without duplicating the bg path.
 */

import { XmlObject } from '../../types';
import type { PptxNotesMaster } from '../../types';
import { COLOR_MAP_ALIAS_KEYS, DEFAULT_COLOR_MAP } from '../../utils/theme-override-utils';
import type { PptxSaveState } from '../builders';
import type { PptxSaveConstants } from '../factories';
import { applyHeaderFooterFlagsToNode } from './master-save-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveMasterElements';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Apply clrMap and headerFooter mutations to the notes master XML.
	 * Background-colour mutations are still handled by the pre-existing
	 * {@link applyNotesMasterChanges} on this runtime; calling both is
	 * idempotent because each writer touches disjoint portions of the
	 * document.
	 */
	protected async applyNotesMasterStructuralChanges(
		notesMaster: PptxNotesMaster | undefined,
		saveSession: PptxSaveState,
		constants: PptxSaveConstants,
	): Promise<void> {
		if (!notesMaster) {
			return;
		}
		// Skip if no structural fields are set; bg-only edits are handled
		// by applyNotesMasterChanges.
		if (
			notesMaster.clrMap === undefined &&
			notesMaster.headerFooter === undefined &&
			notesMaster.elements === undefined
		) {
			return;
		}
		const file = this.zip.file(notesMaster.path);
		if (!file) {
			return;
		}
		try {
			const xml = await file.async('string');
			const data = this.parser.parse(xml) as XmlObject;
			const root = data?.['p:notesMaster'] as XmlObject | undefined;
			if (!root) {
				return;
			}

			if (notesMaster.clrMap !== undefined) {
				root['p:clrMap'] = buildClrMapAttributes(notesMaster.clrMap);
			}

			applyHeaderFooterFlagsToNode(root, notesMaster.headerFooter);
			await this.applyAuxiliaryMasterElementChanges(
				notesMaster.path,
				'p:notesMaster',
				data,
				notesMaster.elements,
				saveSession,
				constants,
			);

			data['p:notesMaster'] = root;
			this.zip.file(notesMaster.path, this.builder.build(data));
		} catch (e) {
			console.warn('Failed to save notes master structural changes:', e);
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
