import { activateModalFocus } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * modal-dialog.ts: a small reusable modal shell (backdrop + centered panel
 * with a header, body, and footer), the vanilla counterpart of the Vue
 * `ModalDialog.vue` / Angular `modal-dialog.component.ts`.
 *
 * The caller owns the `open` flag via {@link ModalDialog.setOpen} and appends
 * `.el` to `document.body` once (escaping the slide-stage transform, matching
 * the Vue component's `<Teleport to="body">`). Closing is triggered by the
 * header `x` button, a click on the backdrop, or `Escape`; focus moves into
 * the panel on open and back to the previously-focused element on close.
 */

export interface ModalDialogOptions {
	title: string;
	onClose(): void;
}

export interface ModalDialog {
	/** Backdrop root; append to `document.body`. */
	el: HTMLElement;
	/** Append dialog-specific content here. */
	bodyEl: HTMLElement;
	/** Append action buttons here (right-aligned). */
	footerEl: HTMLElement;
	setOpen(open: boolean): void;
	setTitle(title: string): void;
	destroy(): void;
}

export function createModalDialog(
	doc: Document,
	t: Translator,
	options: ModalDialogOptions,
): ModalDialog {
	let isOpen = false;
	let releaseFocus: (() => void) | undefined;

	const backdrop = createEl(doc, 'div', 'pptxv-modal-backdrop');
	backdrop.hidden = true;
	backdrop.addEventListener('pointerdown', (event) => {
		if (event.target === backdrop) {
			options.onClose();
		}
	});

	const panel = createEl(doc, 'div', 'pptxv-modal-panel');
	panel.tabIndex = -1;
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-modal', 'true');
	panel.addEventListener('pointerdown', (event) => event.stopPropagation());
	backdrop.appendChild(panel);

	const header = createEl(doc, 'div', 'pptxv-modal-header');
	panel.appendChild(header);

	const titleEl = createEl(doc, 'h2', 'pptxv-modal-title');
	header.appendChild(titleEl);

	const closeBtn = createEl(doc, 'button', 'pptxv-modal-close');
	closeBtn.type = 'button';
	closeBtn.textContent = '×';
	closeBtn.setAttribute('aria-label', t('pptx.settings.close'));
	closeBtn.addEventListener('click', () => options.onClose());
	header.appendChild(closeBtn);

	const bodyEl = createEl(doc, 'div', 'pptxv-modal-body');
	panel.appendChild(bodyEl);

	const footerEl = createEl(doc, 'div', 'pptxv-modal-footer');
	panel.appendChild(footerEl);

	function applyTitle(title: string): void {
		titleEl.textContent = title;
		panel.setAttribute('aria-label', title);
	}
	applyTitle(options.title);

	return {
		el: backdrop,
		bodyEl,
		footerEl,
		setTitle(title) {
			applyTitle(title);
		},
		setOpen(open) {
			if (open === isOpen) {
				return;
			}
			isOpen = open;
			backdrop.hidden = !open;
			if (open) {
				releaseFocus = activateModalFocus(panel, { onEscape: options.onClose });
			} else {
				releaseFocus?.();
				releaseFocus = undefined;
			}
		},
		destroy() {
			releaseFocus?.();
			backdrop.remove();
		},
	};
}
