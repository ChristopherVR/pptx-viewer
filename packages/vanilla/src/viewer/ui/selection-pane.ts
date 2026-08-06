import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface SelectionPaneOptions {
	elements: readonly PptxElement[];
	selectedIds: readonly string[];
	onSelect(id: string): void;
	onToggleHidden(id: string): void;
	onReorder(from: number, to: number): void;
	/** Rename commit: a trimmed non-empty name, or `undefined` to clear it. */
	onRename(id: string, name: string | undefined): void;
}

export function openSelectionPane(
	doc: Document,
	host: HTMLElement,
	t: Translator,
	options: SelectionPaneOptions,
): void {
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
	if (!options.elements.length) {
		const empty = createEl(doc, 'p');
		empty.textContent = t('pptx.selectionPane.empty');
		list.appendChild(empty);
	}
	[...options.elements].reverse().forEach((element, reversedIndex) => {
		const index = options.elements.length - reversedIndex - 1;
		const row = createEl(doc, 'div', 'pptxv-selection-row');
		row.draggable = true;
		row.dataset.index = String(index);
		row.classList.toggle('is-selected', options.selectedIds.includes(element.id));
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
		list.appendChild(row);
	});
	pane.appendChild(list);
	close.addEventListener('click', () => pane.remove());
	host.appendChild(pane);
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
