import type { OleNestedDeckSlideDetail, OlePptxElement, OleSheetGrid } from 'pptx-viewer-core';
import {
	applyOleDocumentParagraphEdit,
	applyOleNestedDeckElementTextEdit,
	applyOleSheetCellEdit,
	getOleDocumentParagraphs,
	getOleNestedDeckDetail,
	getOleSheetGrid,
	replaceOleFile,
} from 'pptx-viewer-core';
import { buildOleContentUpdatePatch, buildOleEditDialogDescriptor } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { appendDialogButton, createParityDialogShell } from '../parity-dialog-shell';
import {
	renderOleDeckEditor,
	renderOleDocumentEditor,
	renderOleSheetGrid,
} from './ole-editor-dialog-tabs';

/** Sink for a committed OLE content edit, matching `InspectorHandlers.setOleContent`. */
export interface OleEditorDialogDeps {
	onUpdateElement(patch: Partial<OlePptxElement>): void;
}

/**
 * "Edit content" dialog for an embedded OLE object: a spreadsheet grid,
 * document paragraph list, or nested-deck slide title list depending on the
 * payload kind (`buildOleEditDialogDescriptor`), plus a Replace File action
 * always available regardless of kind. Vanilla counterpart of React's
 * `OleEditorDialog.tsx`, built directly on this binding's DOM idioms rather
 * than a component tree.
 *
 * Every edit commits through the same core `ole-edit-api.ts` functions every
 * other binding calls, and through `deps.onUpdateElement`
 * (`InspectorHandlers.setOleContent`), the same patch mechanism every other
 * inspector field already uses, so undo/history/collaboration sync works
 * exactly like a typed-field edit.
 */
export function openOleEditorDialog(
	doc: Document,
	t: Translator,
	element: OlePptxElement,
	deps: OleEditorDialogDeps,
): void {
	const descriptor = buildOleEditDialogDescriptor(element);
	const shell = createParityDialogShell(doc, t, t(descriptor.titleKey));
	shell.dialog.classList.add('pptxv-ole-edit-dialog');

	// The element mutates across edits (each commit returns a NEW object with
	// refreshed `oleEmbeddedData`); subsequent edits must read from the latest
	// one, not the stale snapshot the dialog opened with.
	let current = element;

	const commit = (updated: OlePptxElement): void => {
		current = updated;
		if (updated.oleContentDirty) {
			deps.onUpdateElement(buildOleContentUpdatePatch(updated));
		}
	};

	const loading = createEl(doc, 'p', 'pptxv-ole-edit-loading');
	loading.textContent = t('pptx.ole.editDialog.loading');
	const error = createEl(doc, 'p', 'pptxv-ole-edit-error');
	error.textContent = t('pptx.ole.editDialog.saveError');
	error.hidden = true;
	const content = createEl(doc, 'div', 'pptxv-ole-edit-content');
	shell.body.append(loading, error, content);

	// The per-cell/paragraph/element handlers below settle after their own
	// awaits (a re-encode or a full deck save/load round-trip), which can
	// outlive the dialog if it is closed first. Guard every post-await DOM
	// write with this so a late resolution never repopulates a dialog that is
	// no longer attached to the document.
	const isOpen = (): boolean => shell.dialog.isConnected;

	const showError = (): void => {
		if (isOpen()) {
			error.hidden = false;
		}
	};

	const renderSheet = (grid: OleSheetGrid | undefined): void => {
		if (!isOpen()) {
			return;
		}
		content.replaceChildren(
			renderOleSheetGrid(doc, t, grid, (row, col, value) => {
				void (async () => {
					try {
						const updated = await applyOleSheetCellEdit(current, { row, col, value });
						commit(updated);
						const refreshed = await getOleSheetGrid(updated);
						renderSheet(refreshed);
					} catch {
						showError();
					}
				})();
			}),
		);
	};

	const renderDocument = (paragraphs: string[] | undefined): void => {
		if (!isOpen()) {
			return;
		}
		content.replaceChildren(
			renderOleDocumentEditor(doc, t, paragraphs, (index, text) => {
				void (async () => {
					try {
						const updated = await applyOleDocumentParagraphEdit(current, index, text);
						commit(updated);
						const refreshed = await getOleDocumentParagraphs(updated);
						renderDocument(refreshed);
					} catch {
						showError();
					}
				})();
			}),
		);
	};

	const renderDeck = (slides: OleNestedDeckSlideDetail[] | undefined): void => {
		if (!isOpen()) {
			return;
		}
		content.replaceChildren(
			renderOleDeckEditor(doc, t, slides, (slideIndex, elementId, text) => {
				void (async () => {
					try {
						const updated = await applyOleNestedDeckElementTextEdit(
							current,
							slideIndex,
							elementId,
							text,
						);
						commit(updated);
						const refreshed = await getOleNestedDeckDetail(updated);
						renderDeck(refreshed);
					} catch {
						showError();
					}
				})();
			}),
		);
	};

	const showUnsupported = (): void => {
		const message = createEl(doc, 'p', 'pptxv-ole-edit-empty');
		message.textContent = t('pptx.ole.editDialog.unsupported');
		content.replaceChildren(message);
	};

	const load = async (): Promise<void> => {
		const kind = descriptor.contentTab?.kind;
		try {
			if (kind === 'sheet') {
				renderSheet(await getOleSheetGrid(element));
			} else if (kind === 'document') {
				renderDocument(await getOleDocumentParagraphs(element));
			} else if (kind === 'deck') {
				renderDeck(await getOleNestedDeckDetail(element));
			} else {
				showUnsupported();
			}
		} catch {
			showError();
		} finally {
			loading.hidden = true;
		}
	};
	void load();

	const fileInput = doc.createElement('input');
	fileInput.type = 'file';
	fileInput.hidden = true;
	fileInput.addEventListener('change', () => {
		const file = fileInput.files?.[0];
		fileInput.value = '';
		if (!file) {
			return;
		}
		void (async () => {
			try {
				const buffer = new Uint8Array(await file.arrayBuffer());
				const updated = await replaceOleFile(current, buffer, file.name);
				commit(updated);
				shell.close();
			} catch {
				showError();
			}
		})();
	});
	shell.footer.appendChild(fileInput);
	appendDialogButton(doc, shell.footer, t('pptx.ole.editDialog.replaceFile'), () =>
		fileInput.click(),
	);
	appendDialogButton(doc, shell.footer, t('pptx.ole.editDialog.save'), () => shell.close(), true);
}
