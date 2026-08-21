import type { SmartArtLayout } from 'pptx-viewer-core';
import type { SmartArtCategory, SmartArtPreset } from 'pptx-viewer-shared';
import { CATEGORIES, PRESETS } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import { createEl } from '../../../../render';
import { buildSmartArtGalleryPreview } from './smartart-gallery-preview';

export interface SmartArtDialog {
	el: HTMLElement;
	open(host: HTMLElement): void;
	close(): void;
}

/** Build the React-aligned, category-filtered SmartArt insertion dialog. */
export function createSmartArtDialog(
	doc: Document,
	t: Translator,
	onInsert: (layout: SmartArtLayout, defaultItems: string[]) => void,
): SmartArtDialog {
	const layer = createEl(doc, 'div', 'pptxv-smartart-dialog-layer');
	layer.hidden = true;

	const backdrop = createEl(doc, 'button', 'pptxv-smartart-dialog-backdrop');
	backdrop.type = 'button';
	backdrop.setAttribute('aria-label', t('pptx.smartart.close'));

	const panel = createEl(doc, 'div', 'pptxv-smartart-dialog');
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-modal', 'true');
	panel.setAttribute('aria-label', t('pptx.smartart.insertTitle'));
	panel.tabIndex = -1;

	const header = createEl(doc, 'div', 'pptxv-smartart-dialog-header');
	const title = createEl(doc, 'h2');
	title.textContent = t('pptx.smartart.insertTitle');
	const closeButton = createEl(doc, 'button', 'pptxv-smartart-dialog-close');
	closeButton.type = 'button';
	closeButton.setAttribute('aria-label', t('pptx.smartart.close'));
	closeButton.textContent = '\u00d7';
	header.append(title, closeButton);

	const body = createEl(doc, 'div', 'pptxv-smartart-dialog-body');
	const categories = createEl(doc, 'nav', 'pptxv-smartart-categories');
	categories.setAttribute('aria-label', t('pptx.insertSmartArt.categories'));
	const gallery = createEl(doc, 'div', 'pptxv-smartart-gallery');
	const listbox = createEl(doc, 'div', 'pptxv-smartart-options');
	listbox.setAttribute('role', 'listbox');
	listbox.setAttribute('aria-label', t('pptx.insertSmartArt.layouts'));
	gallery.appendChild(listbox);
	body.append(categories, gallery);

	const footer = createEl(doc, 'div', 'pptxv-smartart-dialog-footer');
	const cancelButton = createEl(doc, 'button', 'pptxv-smartart-dialog-cancel');
	cancelButton.type = 'button';
	cancelButton.textContent = t('pptx.smartart.cancel');
	const insertButton = createEl(doc, 'button', 'pptxv-smartart-dialog-insert');
	insertButton.type = 'button';
	insertButton.textContent = t('pptx.smartart.insert');
	insertButton.disabled = true;
	footer.append(cancelButton, insertButton);

	panel.append(header, body, footer);
	layer.append(backdrop, panel);

	let activeCategory: SmartArtCategory = 'list';
	let selectedPreset: SmartArtPreset | undefined;
	let previousFocus: HTMLElement | null = null;

	function selectPreset(preset: SmartArtPreset): void {
		selectedPreset = preset;
		insertButton.disabled = false;
		for (const option of listbox.querySelectorAll<HTMLElement>('[role="option"]')) {
			const selected = option.dataset.layout === preset.layout;
			option.setAttribute('aria-selected', String(selected));
			option.classList.toggle('is-selected', selected);
		}
	}

	function commitPreset(preset: SmartArtPreset | undefined): void {
		if (!preset) {
			return;
		}
		onInsert(preset.layout, preset.defaultItems);
		close();
	}

	function renderOptions(): void {
		listbox.replaceChildren();
		for (const preset of PRESETS.filter((item) => item.category === activeCategory)) {
			const option = createEl(doc, 'button', 'pptxv-smartart-option');
			option.type = 'button';
			option.dataset.layout = preset.layout;
			option.setAttribute('role', 'option');
			option.setAttribute('aria-selected', String(selectedPreset?.layout === preset.layout));
			option.classList.toggle('is-selected', selectedPreset?.layout === preset.layout);

			const preview = buildSmartArtGalleryPreview(doc, t, preset.layout);
			const label = createEl(doc, 'span', 'pptxv-smartart-option-label');
			label.textContent = t(preset.labelKey);
			option.append(preview, label);
			option.addEventListener('click', () => selectPreset(preset));
			option.addEventListener('dblclick', () => commitPreset(preset));
			listbox.appendChild(option);
		}
	}

	function activateCategory(category: SmartArtCategory): void {
		activeCategory = category;
		selectedPreset = undefined;
		insertButton.disabled = true;
		for (const button of categories.querySelectorAll<HTMLButtonElement>('button')) {
			const active = button.dataset.category === category;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', String(active));
		}
		renderOptions();
	}

	for (const category of CATEGORIES) {
		const button = createEl(doc, 'button', 'pptxv-smartart-category');
		button.type = 'button';
		button.dataset.category = category.id;
		button.textContent = t(category.labelKey);
		button.addEventListener('click', () => activateCategory(category.id));
		categories.appendChild(button);
	}
	activateCategory(activeCategory);

	function close(): void {
		if (layer.hidden) {
			return;
		}
		layer.hidden = true;
		previousFocus?.focus();
		previousFocus = null;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key !== 'Tab') {
			return;
		}
		const focusable = Array.from(
			panel.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])'),
		);
		if (focusable.length === 0) {
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && doc.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && doc.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	backdrop.addEventListener('click', close);
	closeButton.addEventListener('click', close);
	cancelButton.addEventListener('click', close);
	insertButton.addEventListener('click', () => commitPreset(selectedPreset));
	layer.addEventListener('keydown', handleKeydown);

	return {
		el: layer,
		open(host) {
			const HTMLElementCtor = doc.defaultView?.HTMLElement;
			previousFocus =
				HTMLElementCtor && doc.activeElement instanceof HTMLElementCtor
					? (doc.activeElement as HTMLElement)
					: null;
			if (layer.parentElement !== host) {
				host.appendChild(layer);
			}
			layer.hidden = false;
			panel.focus();
		},
		close,
	};
}
