import { registerPptxWebControls } from 'pptx-viewer-shared';
import type {
	CompatibilityWarningToast,
	CompatToastsRequestEvent,
	PptxUiCompatToastsElement,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';

/**
 * Load-diagnostics toast stack, bottom-right of the viewer chrome: one toast
 * per {@link CompatibilityWarningToast} the shared `compatibilityWarningToasts`
 * derives from `data.warnings` + every slide's own `warnings`. Load
 * diagnostics, not transient notifications: they do not auto-hide, only a
 * per-toast dismiss or "Dismiss all" clears them (and the next load resets
 * the whole stack). A thin adapter over the shared `pptx-ui-compat-toasts`,
 * which caps the list at 5 with a "+N" overflow count and positions itself.
 */
export interface CompatToastStack {
	/** Append this to the VIEWER ROOT (the containing block the dialogs use). */
	el: HTMLElement;
	/**
	 * `rightInset` (default 0) is the width of whatever right-docked panel
	 * (currently: the format/inspector) is open: the viewer ROOT this stack
	 * is appended to spans the FULL chrome width including that panel, so
	 * without it the stack's `right: 12px` lands under the panel's own
	 * content instead of clear of it.
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

export function createCompatToastStack(
	doc: Document,
	t: Translator,
	onDismiss: (id: string) => void,
	onDismissAll: () => void,
): CompatToastStack {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-compat-toasts') as PptxUiCompatToastsElement;
	let toasts: readonly CompatibilityWarningToast[] = [];
	let rightInset = 0;
	let bottomInset = 0;
	const sync = (): void => {
		el.state = { toasts, rightInset, bottomInset, translate: t };
	};
	el.addEventListener('compat-toasts-request', (event) => {
		const intent = (event as CompatToastsRequestEvent).detail;
		if (intent.id === 'dismissAll') {
			onDismissAll();
		} else {
			onDismiss(intent.toastId);
		}
	});
	sync();
	return {
		el,
		setBottomInset(next) {
			bottomInset = next;
			sync();
		},
		update(next, nextRightInset = 0) {
			toasts = next;
			rightInset = nextRightInset;
			sync();
		},
	};
}
