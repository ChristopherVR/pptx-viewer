import type { OleNestedDeckSlideDetail, OleSheetGrid } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * The three content-tab bodies for `ole-editor-dialog.ts`'s "Edit content"
 * dialog, split out to keep each file within the repo's ~300 LOC limit.
 * Pure DOM builders: each returns a detached element, ported from React's
 * `OleEditorDialogTabs.tsx` to this binding's `createEl`/event-listener
 * idiom instead of JSX.
 */

function emptyMessage(doc: Document, text: string): HTMLElement {
	const message = createEl(doc, 'p', 'pptxv-ole-edit-empty');
	message.textContent = text;
	return message;
}

/** Editable spreadsheet grid for the "sheet" tab: one `<input>` per cell, committed on blur. */
export function renderOleSheetGrid(
	doc: Document,
	t: Translator,
	grid: OleSheetGrid | undefined,
	onCellEdit: (row: number, col: number, value: string) => void,
): HTMLElement {
	if (!grid || grid.rows.length === 0) {
		return emptyMessage(doc, t('pptx.ole.editDialog.emptySheet'));
	}
	const wrap = createEl(doc, 'div', 'pptxv-ole-edit-table-wrap');
	const table = createEl(doc, 'table', 'pptxv-ole-edit-table');
	const body = doc.createElement('tbody');
	grid.rows.forEach((row, rowIndex) => {
		const tr = doc.createElement('tr');
		row.cells.forEach((cell, colIndex) => {
			const td = doc.createElement('td');
			const input = doc.createElement('input');
			input.type = 'text';
			input.value = cell.value;
			input.setAttribute('aria-label', t('pptx.ole.editDialog.cellEditLabel'));
			input.addEventListener('keydown', (event) => event.stopPropagation());
			input.addEventListener('blur', () => {
				if (input.value !== cell.value) {
					onCellEdit(rowIndex, colIndex, input.value);
				}
			});
			td.appendChild(input);
			tr.appendChild(td);
		});
		body.appendChild(tr);
	});
	table.appendChild(body);
	wrap.appendChild(table);
	return wrap;
}

/** Editable paragraph list for the "document" tab: one `<textarea>` per paragraph, committed on blur. */
export function renderOleDocumentEditor(
	doc: Document,
	t: Translator,
	paragraphs: string[] | undefined,
	onEdit: (index: number, text: string) => void,
): HTMLElement {
	if (!paragraphs || paragraphs.length === 0) {
		return emptyMessage(doc, t('pptx.ole.editDialog.emptyDocument'));
	}
	const container = createEl(doc, 'div', 'pptxv-ole-edit-paragraphs');
	paragraphs.forEach((paragraph, index) => {
		const textarea = doc.createElement('textarea');
		textarea.rows = 2;
		textarea.value = paragraph;
		textarea.addEventListener('keydown', (event) => event.stopPropagation());
		textarea.addEventListener('blur', () => {
			if (textarea.value !== paragraph) {
				onEdit(index, textarea.value);
			}
		});
		container.appendChild(textarea);
	});
	return container;
}

/**
 * Editable full text-element list for the "deck" (nested presentation) tab:
 * every slide, every text-bearing shape, committed on blur.
 */
export function renderOleDeckEditor(
	doc: Document,
	t: Translator,
	slides: OleNestedDeckSlideDetail[] | undefined,
	onEdit: (slideIndex: number, elementId: string, text: string) => void,
): HTMLElement {
	if (!slides || slides.length === 0) {
		return emptyMessage(doc, t('pptx.ole.editDialog.deckEmpty'));
	}
	const container = createEl(doc, 'div', 'pptxv-ole-edit-deck');
	for (const slide of slides) {
		const group = createEl(doc, 'div', 'pptxv-ole-edit-deck-slide');
		const caption = doc.createElement('span');
		caption.className = 'pptxv-ole-edit-deck-caption';
		caption.textContent = t('pptx.ole.editDialog.deckSlideLabel', { number: slide.index + 1 });
		group.appendChild(caption);
		if (slide.elements.length === 0) {
			group.appendChild(emptyMessage(doc, t('pptx.ole.editDialog.deckEmpty')));
		}
		for (const element of slide.elements) {
			const input = doc.createElement('input');
			input.type = 'text';
			input.value = element.text;
			input.addEventListener('keydown', (event) => event.stopPropagation());
			input.addEventListener('blur', () => {
				if (input.value !== element.text) {
					onEdit(slide.index, element.elementId, input.value);
				}
			});
			group.appendChild(input);
		}
		container.appendChild(group);
	}
	return container;
}
