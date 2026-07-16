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
		name.textContent = displayName(element, index);
		name.addEventListener('click', () => options.onSelect(element.id));
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

function displayName(element: PptxElement, index: number): string {
	if (hasTextProperties(element) && element.text?.trim()) {
		return element.text.trim().slice(0, 32);
	}
	return `${element.type.charAt(0).toUpperCase()}${element.type.slice(1)} ${index + 1}`;
}
