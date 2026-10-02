import type { DialogFooterAction, SlideTemplateId } from 'pptx-viewer-shared';
import { modalActiveElement, modalFocusableElements, SLIDE_TEMPLATES } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { appendDialogFooter } from '../../dialog-footer';
import { renderSlideTemplatePreview } from './slide-template-preview';

export interface SlideTemplateDialog {
	el: HTMLElement;
	open(host: HTMLElement): void;
	close(): void;
}

export interface SlideTemplateDialogOptions {
	/** Insert the chosen template after the current slide (history-integrated). */
	onInsert(templateId: SlideTemplateId): void;
	/** Deck scheme resolver so previews show the loaded deck's theme colours. */
	getScheme?(): Record<string, string> | undefined;
}

/**
 * The New Slide template gallery, aligned with React's
 * `SlideTemplateGalleryDialog`: a modal listbox of live-rendered template
 * previews. Single click selects, double click or the Insert button inserts.
 * Tiles are rebuilt on every `open` so previews always reflect the currently
 * loaded deck's theme scheme.
 */
export function createSlideTemplateDialog(
	doc: Document,
	t: Translator,
	options: SlideTemplateDialogOptions,
): SlideTemplateDialog {
	const layer = createEl(doc, 'div', 'pptxv-tpl-dialog-layer');
	layer.hidden = true;

	const backdrop = createEl(doc, 'button', 'pptxv-tpl-dialog-backdrop');
	backdrop.type = 'button';
	backdrop.setAttribute('aria-label', t('pptx.slideTemplates.close'));

	const panel = createEl(doc, 'div', 'pptxv-tpl-dialog');
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-modal', 'true');
	panel.setAttribute('aria-label', t('pptx.slideTemplates.galleryTitle'));
	panel.tabIndex = -1;

	const header = createEl(doc, 'div', 'pptxv-tpl-dialog-header');
	const heading = createEl(doc, 'div', 'pptxv-tpl-dialog-heading');
	const title = createEl(doc, 'h2');
	title.textContent = t('pptx.slideTemplates.galleryTitle');
	const description = createEl(doc, 'p');
	description.textContent = t('pptx.slideTemplates.galleryDescription');
	heading.append(title, description);
	const closeButton = createEl(doc, 'button', 'pptxv-tpl-dialog-close');
	closeButton.type = 'button';
	closeButton.setAttribute('aria-label', t('pptx.slideTemplates.close'));
	closeButton.textContent = '×';
	header.append(heading, closeButton);

	const body = createEl(doc, 'div', 'pptxv-tpl-dialog-body');
	const listbox = createEl(doc, 'div', 'pptxv-tpl-options');
	listbox.setAttribute('role', 'listbox');
	listbox.setAttribute('aria-label', t('pptx.slideTemplates.gallery'));
	body.appendChild(listbox);

	const footer = createEl(doc, 'div', 'pptxv-tpl-dialog-footer');
	const footerActions = (canInsert: boolean): DialogFooterAction[] => [
		{ id: 'cancel', label: t('pptx.slideTemplates.cancel') },
		{
			id: 'insert',
			label: t('pptx.slideTemplates.insert'),
			variant: 'primary',
			disabled: !canInsert,
		},
	];
	const footerElement = appendDialogFooter(doc, footer, footerActions(false), (id) => {
		if (id === 'insert') {
			commitTemplate(selected);
		} else {
			close();
		}
	});

	panel.append(header, body, footer);
	layer.append(backdrop, panel);

	let selected: SlideTemplateId | undefined;
	let previousFocus: HTMLElement | null = null;

	function selectTemplate(templateId: SlideTemplateId): void {
		selected = templateId;
		footerElement.state = { actions: footerActions(true) };
		for (const option of listbox.querySelectorAll<HTMLElement>('[role="option"]')) {
			const isSelected = option.dataset.templateId === templateId;
			option.setAttribute('aria-selected', String(isSelected));
			option.classList.toggle('is-selected', isSelected);
		}
	}

	function commitTemplate(templateId: SlideTemplateId | undefined): void {
		if (!templateId) {
			return;
		}
		options.onInsert(templateId);
		close();
	}

	function renderOptions(): void {
		const scheme = options.getScheme?.();
		listbox.replaceChildren();
		for (const spec of SLIDE_TEMPLATES) {
			const option = createEl(doc, 'button', 'pptxv-tpl-option');
			option.type = 'button';
			option.dataset.templateId = spec.id;
			option.setAttribute('role', 'option');
			option.setAttribute('aria-selected', String(selected === spec.id));
			option.setAttribute('aria-label', t(spec.nameKey));
			option.title = t(spec.descriptionKey);
			option.classList.toggle('is-selected', selected === spec.id);

			option.appendChild(renderSlideTemplatePreview(doc, t, spec.id, scheme));
			const label = createEl(doc, 'span', 'pptxv-tpl-option-label');
			label.textContent = t(spec.nameKey);
			option.append(label);
			option.addEventListener('click', () => selectTemplate(spec.id));
			option.addEventListener('dblclick', () => commitTemplate(spec.id));
			listbox.appendChild(option);
		}
	}

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
		// The footer buttons live in the shared element's open shadow root.
		const focusable = modalFocusableElements(panel);
		if (focusable.length === 0) {
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = modalActiveElement(doc);
		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	backdrop.addEventListener('click', close);
	closeButton.addEventListener('click', close);
	layer.addEventListener('keydown', handleKeydown);

	return {
		el: layer,
		open(host) {
			const HTMLElementCtor = doc.defaultView?.HTMLElement;
			previousFocus =
				HTMLElementCtor && doc.activeElement instanceof HTMLElementCtor
					? (doc.activeElement as HTMLElement)
					: null;
			renderOptions();
			if (layer.parentElement !== host) {
				host.appendChild(layer);
			}
			layer.hidden = false;
			panel.focus();
		},
		close,
	};
}
