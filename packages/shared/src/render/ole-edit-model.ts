/**
 * Pure decision module for the "Edit content" OLE dialog: which editor tab
 * a binding should show for a given `OlePptxElement`, and the dialog's
 * title/label furniture. Every binding maps this descriptor onto its own
 * dialog component; none of them re-derive the kind themselves.
 *
 * This is a LIGHTWEIGHT, synchronous classification from the element's
 * already-parsed `oleObjectType` / `oleFileExtension` fields, used only to
 * decide which UI affordance to show (a grid, a paragraph list, a nested
 * viewer, or just Replace File). It is deliberately not the same check as
 * core's `detectOlePayloadEditorKind` (`pptx-viewer-core`), which sniffs the
 * actual payload bytes and is the source of truth the edit functions
 * (`ole-edit-api.ts` in core) validate against before writing anything. A
 * mismatch between this guess and core's byte-level detection just means the
 * dialog opened the "wrong" tab for a mislabelled file; core's own detection
 * still decides what can actually be written, so no edit is ever silently
 * corrupted by a wrong guess here.
 *
 * @module render/ole-edit-model
 */
import type { OleObjectType, OlePptxElement } from 'pptx-viewer-core';

/** Which editor UI a binding's "Edit content" dialog should present. */
export type OleEditorKind = 'sheet' | 'document' | 'deck' | 'file';

const OBJECT_TYPE_TO_KIND: Partial<Record<OleObjectType, OleEditorKind>> = {
	excel: 'sheet',
	word: 'document',
	powerpoint: 'deck',
};

/**
 * Guess which editor tab applies to an OLE element, from its already-parsed
 * type/extension fields (no byte-sniffing; see module doc).
 */
export function resolveOleEditorKind(
	element: Pick<OlePptxElement, 'oleObjectType' | 'oleFileExtension'>,
): OleEditorKind {
	const fromType = element.oleObjectType ? OBJECT_TYPE_TO_KIND[element.oleObjectType] : undefined;
	if (fromType) {
		return fromType;
	}
	switch (element.oleFileExtension?.toLowerCase()) {
		case 'xlsx':
		case 'xls':
		case 'xlsm':
			return 'sheet';
		case 'docx':
		case 'doc':
			return 'document';
		case 'pptx':
		case 'ppt':
			return 'deck';
		default:
			return 'file';
	}
}

/** Descriptor for one tab of the "Edit content" dialog. */
export interface OleEditDialogTab {
	kind: OleEditorKind;
	/** i18n key for the tab label. */
	labelKey: string;
}

/** Full descriptor for the "Edit content" dialog: which tabs to show and in what order. */
export interface OleEditDialogDescriptor {
	/** i18n key for the dialog title. */
	titleKey: string;
	/** The content-editing tab for this element's kind, absent for a plain file (Replace File only). */
	contentTab?: OleEditDialogTab;
	/** Whether to show the "Replace file" action (always true: every kind supports it). */
	showReplaceFile: true;
	/** Whether to show the Object Name field (always true, mirrors the existing inspector field). */
	showObjectName: true;
}

const TAB_LABEL_KEYS: Record<OleEditorKind, string> = {
	sheet: 'pptx.ole.editDialog.tabSheet',
	document: 'pptx.ole.editDialog.tabDocument',
	deck: 'pptx.ole.editDialog.tabDeck',
	file: 'pptx.ole.editDialog.tabFile',
};

/** Build the full dialog descriptor for an OLE element's "Edit content" action. */
export function buildOleEditDialogDescriptor(
	element: Pick<OlePptxElement, 'oleObjectType' | 'oleFileExtension'>,
): OleEditDialogDescriptor {
	const kind = resolveOleEditorKind(element);
	return {
		titleKey: 'pptx.ole.editDialog.title',
		...(kind === 'file' ? {} : { contentTab: { kind, labelKey: TAB_LABEL_KEYS[kind] } }),
		showReplaceFile: true,
		showObjectName: true,
	};
}

/**
 * Extract the `Partial<OlePptxElement>` patch to commit after any of core's
 * `ole-edit-api.ts` functions (`applyOleSheetCellEdit`,
 * `applyOleDocumentParagraphEdit`, `applyOleNestedDeckBytes`,
 * `replaceOleFile`, `setOleObjectName`) returns an updated element.
 *
 * Every binding's OLE editor dialog calls this the same way (commit through
 * the same `onUpdateElement`-style patch API every other inspector field
 * uses), so the field list that content-editing can touch lives once here
 * instead of being repeated per binding.
 */
export function buildOleContentUpdatePatch(updated: OlePptxElement): Partial<OlePptxElement> {
	return {
		oleName: updated.oleName,
		oleEmbeddedData: updated.oleEmbeddedData,
		oleEmbeddedByteSize: updated.oleEmbeddedByteSize,
		oleEmbeddedFileName: updated.oleEmbeddedFileName,
		oleEmbeddedMimeType: updated.oleEmbeddedMimeType,
		fileName: updated.fileName,
		previewImageData: updated.previewImageData,
		oleContentDirty: updated.oleContentDirty,
	};
}
