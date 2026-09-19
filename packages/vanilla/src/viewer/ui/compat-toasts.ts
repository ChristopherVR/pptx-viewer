import { compatToastStackStyleAttr } from 'pptx-viewer-shared';
import type { CompatibilityWarningToast } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';

/**
 * Load-diagnostics toast stack, bottom-right of the viewer chrome: one toast
 * per {@link CompatibilityWarningToast} the shared `compatibilityWarningToasts`
 * derives from `data.warnings` + every slide's own `warnings`. Load
 * diagnostics, not transient notifications: they do not auto-hide, only a
 * per-toast dismiss or "Dismiss all" clears them (and the next load resets
 * the whole stack). Capped to 5 visible with a "+N" overflow count.
 */
export interface CompatToastStack {
	el: HTMLElement;
	/**
	 * `rightInset` (default 0) is the width of whatever right-docked panel
	 * (currently: the format/inspector) is open: the viewer ROOT this stack
	 * is appended to spans the FULL chrome width including that panel, so
	 * without it the stack's `right: 12px` lands under the panel's own
	 * content instead of clear of it (it rendered on top of, and visually
	 * inside, the Properties panel).
	 */
	update(toasts: readonly CompatibilityWarningToast[], rightInset?: number): void;
	/**
	 * Height (px) of the docked "Speaker notes" strip, which sits between the
	 * canvas and the status bar in the same containing block: without it the
	 * stack's bottom inset only clears the status bar and the stack overlaps
	 * the strip. Re-styles the stack in place; `0` when the strip is hidden.
	 */
	setBottomInset(bottomInset: number): void;
}

const VISIBLE_CAP = 5;

export function createCompatToastStack(
	doc: Document,
	t: Translator,
	onDismiss: (id: string) => void,
	onDismissAll: () => void,
): CompatToastStack {
	const el = createEl(doc, 'div', 'pptxv-compat-toasts');
	el.dataset.testid = 'pptx-compat-toasts';
	el.hidden = true;
	// Anchored to the VIEWER ROOT (this element must be appended there, the
	// same containing block the dialogs use), bottom-inset above the status
	// bar so a toast never covers the "Slide show" button.
	el.setAttribute('style', compatToastStackStyleAttr());
	let rightInset = 0;
	let bottomInset = 0;
	const restyle = (): void => {
		el.setAttribute('style', compatToastStackStyleAttr(rightInset, bottomInset));
	};
	el.setAttribute('role', 'region');
	el.setAttribute('aria-label', t('pptx.compatibility.toastTitle'));
	const list = createEl(doc, 'div', 'pptxv-compat-toasts-list');
	const overflow = createEl(doc, 'div', 'pptxv-compat-toasts-overflow');
	overflow.hidden = true;
	const dismissAll = createEl(doc, 'button', 'pptxv-compat-toasts-dismiss-all');
	dismissAll.type = 'button';
	dismissAll.dataset.testid = 'pptx-compat-toasts-dismiss-all';
	dismissAll.textContent = t('pptx.compatibility.dismissAll');
	dismissAll.addEventListener('click', onDismissAll);
	el.append(list, overflow, dismissAll);

	function renderToast(toast: CompatibilityWarningToast): HTMLElement {
		const item = createEl(doc, 'div', 'pptxv-compat-toast');
		item.dataset.testid = 'pptx-compat-toast';
		item.dataset.code = toast.code;
		item.dataset.severity = toast.severity;
		item.setAttribute('role', 'status');
		item.appendChild(createIcon(doc, 'alert'));
		const body = createEl(doc, 'div', 'pptxv-compat-toast-body');
		const title = createEl(doc, 'strong', 'pptxv-compat-toast-title');
		title.textContent = t('pptx.compatibility.toastTitle');
		const message = createEl(doc, 'span', 'pptxv-compat-toast-message');
		message.textContent = t(toast.messageKey, toast.params);
		body.append(title, message);
		const dismiss = createEl(doc, 'button', 'pptxv-compat-toast-dismiss');
		dismiss.type = 'button';
		dismiss.dataset.testid = 'pptx-compat-toast-dismiss';
		dismiss.setAttribute('aria-label', t('pptx.compatibility.dismiss'));
		dismiss.appendChild(createIcon(doc, 'close'));
		dismiss.addEventListener('click', () => onDismiss(toast.id));
		item.append(body, dismiss);
		return item;
	}

	return {
		el,
		setBottomInset(next) {
			bottomInset = next;
			restyle();
		},
		update(toasts, nextRightInset = 0) {
			el.hidden = toasts.length === 0;
			rightInset = nextRightInset;
			restyle();
			list.replaceChildren(...toasts.slice(0, VISIBLE_CAP).map(renderToast));
			const hiddenCount = toasts.length - VISIBLE_CAP;
			overflow.hidden = hiddenCount <= 0;
			if (hiddenCount > 0) {
				overflow.textContent = `+${hiddenCount}`;
			}
		},
	};
}
