/** Framework-neutral keyboard focus management for modal dialogs. */

export const MODAL_FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[contenteditable="true"]',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

export interface ModalFocusOptions {
	/** Element that should receive initial focus. Defaults to the first control. */
	initialFocus?: HTMLElement | null;
	/** Invoked after Escape is consumed. */
	onEscape?: () => void;
	/** Restore focus to the opener when the manager is released. */
	restoreFocus?: boolean;
}

function isAvailable(element: HTMLElement): boolean {
	if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
		return false;
	}
	const style = element.ownerDocument.defaultView?.getComputedStyle(element);
	return style?.display !== 'none' && style?.visibility !== 'hidden';
}

function focusableElements(panel: HTMLElement): HTMLElement[] {
	return Array.from(panel.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)).filter(
		isAvailable,
	);
}

/**
 * Moves focus into a modal, traps Tab within it, handles Escape, and returns
 * focus to the opener on cleanup. The caller owns visibility and teardown.
 */
export function activateModalFocus(
	panel: HTMLElement,
	options: ModalFocusOptions = {},
): () => void {
	const doc = panel.ownerDocument;
	let activeElement = doc.activeElement;
	while (activeElement?.shadowRoot?.activeElement) {
		activeElement = activeElement.shadowRoot.activeElement;
	}
	const opener = activeElement instanceof HTMLElement ? activeElement : null;
	const restoreFocus = options.restoreFocus ?? true;

	function focusInitial(): void {
		const candidate = options.initialFocus ?? focusableElements(panel)[0] ?? panel;
		candidate.focus();
	}

	function onKeydown(event: KeyboardEvent): void {
		if (!panel.isConnected) {
			doc.removeEventListener('keydown', onKeydown, true);
			return;
		}
		if (event.key === 'Escape' && options.onEscape) {
			// An open select popup consumes the first Escape; the dialog stays open.
			if (
				event
					.composedPath()
					.some(
						(node) =>
							node instanceof Element &&
							node.localName === 'pptx-ui-select' &&
							node.hasAttribute('open'),
					)
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			options.onEscape();
			return;
		}
		if (event.key !== 'Tab') {
			return;
		}

		const focusable = focusableElements(panel);
		if (focusable.length === 0) {
			event.preventDefault();
			panel.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = doc.activeElement;
		if (event.shiftKey && (active === first || !panel.contains(active))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !panel.contains(active))) {
			event.preventDefault();
			first.focus();
		}
	}

	doc.addEventListener('keydown', onKeydown, true);
	queueMicrotask(focusInitial);

	return () => {
		doc.removeEventListener('keydown', onKeydown, true);
		if (restoreFocus && opener?.isConnected) {
			opener.focus();
		}
	};
}
