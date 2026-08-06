import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { restoreEditorKeyboardFocus } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/** What the pane lists: the active slide's objects and the current selection. */
export interface SelectionPaneModel {
	elements: readonly PptxElement[];
	selectedIds: readonly string[];
}

export interface SelectionPaneOptions extends SelectionPaneModel {
	onSelect(id: string): void;
	onToggleHidden(id: string): void;
	onReorder(from: number, to: number): void;
	/** Rename commit: a trimmed non-empty name, or `undefined` to clear it. */
	onRename(id: string, name: string | undefined): void;
	/**
	 * Live model feed. Without it the pane is a snapshot of the deck as it was
	 * when it opened, which is how an undone rename kept showing the new name:
	 * the model went back, the rows did not. Returns an unsubscribe function.
	 */
	subscribe?(listener: (model: SelectionPaneModel) => void): () => void;
	/** Invoked when the pane's own close button tears it down. */
	onClose?(): void;
}

/** Handle so the caller can release the pane (and its subscription). */
export interface SelectionPaneHandle {
	close(): void;
}

export function openSelectionPane(
	doc: Document,
	host: HTMLElement,
	t: Translator,
	options: SelectionPaneOptions,
): SelectionPaneHandle {
	host.querySelector('[data-pptx-selection-pane]')?.remove();
	const pane = createEl(doc, 'aside', 'pptxv-workspace-pane');
	pane.dataset.pptxSelectionPane = 'true';
	const header = createEl(doc, 'header');
	const title = createEl(doc, 'h2');
	title.textContent = t('pptx.selectionPane.title');
	const close = createEl(doc, 'button');
	close.type = 'button';
	close.textContent = '×';
	close.setAttribute('aria-label', t('pptx.selectionPane.close'));
	header.append(title, close);
	pane.appendChild(header);

	const list = createEl(doc, 'div', 'pptxv-workspace-list');
	let model: SelectionPaneModel = { elements: options.elements, selectedIds: options.selectedIds };
	let renderedElements: readonly PptxElement[] | null = null;
	const rowsById = new Map<string, HTMLElement>();

	/** Repaint the selection highlight without touching the row nodes. */
	const paintSelection = (): void => {
		for (const [id, row] of rowsById) {
			row.classList.toggle('is-selected', model.selectedIds.includes(id));
		}
	};
	const renderRows = (): void => {
		// Selection-only changes must NOT rebuild: a row whose node is swapped
		// between the two halves of a double-click never sees the `dblclick` (it
		// lands on the common ancestor instead), which would make rename
		// unreachable, since the first click of the pair selects the row.
		if (renderedElements === model.elements) {
			paintSelection();
			return;
		}
		renderedElements = model.elements;
		rowsById.clear();
		list.replaceChildren();
		if (!model.elements.length) {
			const empty = createEl(doc, 'p');
			empty.textContent = t('pptx.selectionPane.empty');
			list.appendChild(empty);
			return;
		}
		[...model.elements].reverse().forEach((element, reversedIndex) => {
			const row = buildRow(
				doc,
				t,
				element,
				model.elements.length - reversedIndex - 1,
				options,
				model.selectedIds,
			);
			rowsById.set(element.id, row);
			list.appendChild(row);
		});
	};
	renderRows();
	pane.appendChild(list);

	const unsubscribe =
		options.subscribe?.((next) => {
			model = next;
			// A rename in flight owns the DOM: rebuilding under it would drop the
			// input mid-keystroke. The commit re-renders as soon as it is done.
			if (list.querySelector('.pptxv-selection-rename')) {
				return;
			}
			renderRows();
		}) ?? null;
	const handle: SelectionPaneHandle = {
		close() {
			unsubscribe?.();
			pane.remove();
		},
	};
	close.addEventListener('click', () => {
		handle.close();
		options.onClose?.();
	});
	host.appendChild(pane);
	return handle;
}

/** One object row: drag handle, name label (double-click renames), eye toggle. */
function buildRow(
	doc: Document,
	t: Translator,
	element: PptxElement,
	index: number,
	options: SelectionPaneOptions,
	selectedIds: readonly string[],
): HTMLElement {
	const row = createEl(doc, 'div', 'pptxv-selection-row');
	row.draggable = true;
	row.dataset.index = String(index);
	row.classList.toggle('is-selected', selectedIds.includes(element.id));
	const grip = createEl(doc, 'span');
	grip.textContent = '☰';
	const name = createEl(doc, 'button');
	name.type = 'button';
	// E2E contract: the row's name label, double-clicked to rename.
	name.dataset.pptxSelectionName = 'true';
	name.textContent = displayName(element, index);
	name.addEventListener('click', () => options.onSelect(element.id));
	name.addEventListener('dblclick', () =>
		startRename(doc, t, row, name, element, index, options.onRename),
	);
	const visible = createEl(doc, 'button');
	visible.type = 'button';
	visible.textContent = element.hidden ? '○' : '◉';
	visible.setAttribute(
		'aria-label',
		t(element.hidden ? 'pptx.selectionPane.show' : 'pptx.selectionPane.hide'),
	);
	visible.addEventListener('click', () => options.onToggleHidden(element.id));
	row.addEventListener('dragstart', (event) =>
		event.dataTransfer?.setData('text/plain', String(index)),
	);
	row.addEventListener('dragover', (event) => event.preventDefault());
	row.addEventListener('drop', (event) => {
		event.preventDefault();
		const from = Number(event.dataTransfer?.getData('text/plain'));
		if (Number.isInteger(from)) {
			options.onReorder(from, index);
		}
	});
	row.append(grip, name, visible);
	return row;
}

/**
 * Swap the name button for a text input, matching React's SelectionPane:
 * Enter and blur commit, Escape cancels. The input is seeded with the display
 * name, and an unedited commit changes nothing (in particular, a "Shape 3"
 * fallback label is never written into the element as a real name). A commit
 * with an emptied value clears the stored name.
 */
function startRename(
	doc: Document,
	t: Translator,
	row: HTMLElement,
	name: HTMLButtonElement,
	element: PptxElement,
	index: number,
	onRename: SelectionPaneOptions['onRename'],
): void {
	const seed = displayName(element, index);
	const input = doc.createElement('input');
	input.type = 'text';
	input.className = 'pptxv-selection-rename';
	input.setAttribute('aria-label', t('pptx.selectionPane.renameElement'));
	input.value = seed;
	name.hidden = true;
	row.insertBefore(input, name);
	input.focus();
	input.select();

	// Enter commits and removes the input, which also fires blur: `done`
	// keeps that second path from committing (or restoring) twice.
	let done = false;
	const finish = (commit: boolean): void => {
		if (done) {
			return;
		}
		done = true;
		const trimmed = input.value.trim();
		// Hand the keyboard back to the viewer root BEFORE the input leaves the
		// document. Otherwise focus falls to `document.body`, outside the root
		// this binding listens on, and the Ctrl+Z that undoes the rename is
		// silently dropped.
		restoreEditorKeyboardFocus(input);
		input.remove();
		name.hidden = false;
		// An unedited commit keeps whatever the element had (the seed may be a
		// fallback label, not a stored name).
		if (!commit || trimmed === seed.trim()) {
			return;
		}
		name.textContent = trimmed.length > 0 ? trimmed : fallbackName(element, index);
		onRename(element.id, trimmed.length > 0 ? trimmed : undefined);
	};
	input.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			finish(true);
		} else if (event.key === 'Escape') {
			finish(false);
		}
	});
	input.addEventListener('blur', () => finish(true));
}

function displayName(element: PptxElement, index: number): string {
	if (element.name && element.name.trim().length > 0) {
		return element.name.trim();
	}
	return fallbackName(element, index);
}

/** The label used when the element has no explicit name (text or `Type n`). */
function fallbackName(element: PptxElement, index: number): string {
	if (hasTextProperties(element) && element.text?.trim()) {
		return element.text.trim().slice(0, 32);
	}
	return `${element.type.charAt(0).toUpperCase()}${element.type.slice(1)} ${index + 1}`;
}
