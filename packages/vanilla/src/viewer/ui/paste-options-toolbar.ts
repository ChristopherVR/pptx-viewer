/**
 * The small icon-strip PowerPoint anchors to the bottom-right corner of a
 * just-pasted element, offering the same four Paste Special formats as a
 * one-click follow-up. Dismissed by any subsequent pointerdown or keydown,
 * same as the element context menu.
 *
 * Reactive: mounted once and repainted whenever `store`'s `pasteOptionsToolbar`
 * field changes (set/cleared by the clipboard actions and the dialog).
 */
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import { findCanvasElementNode, PASTE_SPECIAL_OPTIONS } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { Store, ViewerState } from '../state';

export interface PasteOptionsToolbarDeps {
	doc: Document;
	store: Store<ViewerState>;
	getTranslator(): Translator;
	onChoose(format: PasteSpecialFormat): void;
}

export interface PasteOptionsToolbarHandle {
	destroy(): void;
}

/** Frames to wait for a just-pasted element to render before giving up. */
const MAX_PAINT_ATTEMPTS = 10;

export function mountPasteOptionsToolbar(deps: PasteOptionsToolbarDeps): PasteOptionsToolbarHandle {
	const { doc, store, getTranslator, onChoose } = deps;
	let toolbar: HTMLElement | null = null;
	let removeOutsideListeners: (() => void) | undefined;

	function dismiss(): void {
		store.set({ pasteOptionsToolbar: null });
	}

	function unmount(): void {
		removeOutsideListeners?.();
		removeOutsideListeners = undefined;
		toolbar?.remove();
		toolbar = null;
	}

	function paint(attempt = 0): void {
		unmount();
		const entries = store.get().pasteOptionsToolbar;
		const elementId = entries?.[0]?.id;
		if (!elementId) {
			return;
		}
		const node = findCanvasElementNode(doc, elementId, { canvasOnly: true });
		if (!node) {
			// The store notifies this subscriber in the same tick as the paste,
			// before the stage has re-rendered the pasted element, so the node
			// is usually not in the DOM yet: the toolbar then never appeared at
			// all. Retry on the next frames instead of giving up.
			const view = doc.defaultView;
			if (view && attempt < MAX_PAINT_ATTEMPTS) {
				const frame = view.requestAnimationFrame(() => paint(attempt + 1));
				removeOutsideListeners = () => view.cancelAnimationFrame(frame);
			}
			return;
		}
		const box = node.getBoundingClientRect();
		const t = getTranslator();
		const el = createEl(doc, 'div', 'pptxv-paste-options');
		el.setAttribute('role', 'toolbar');
		el.setAttribute('tabindex', '-1');
		el.setAttribute('aria-label', t('pptx.pasteSpecial.optionsLabel'));
		el.setAttribute('data-pptx-paste-options', '');
		el.style.position = 'fixed';
		el.style.left = `${box.right + 4}px`;
		el.style.top = `${box.bottom + 4}px`;
		el.addEventListener('mousedown', (e) => e.stopPropagation());
		for (const option of PASTE_SPECIAL_OPTIONS) {
			const button = createEl(doc, 'button');
			button.type = 'button';
			button.textContent = t(option.labelKey);
			button.title = t(option.labelKey);
			button.addEventListener('click', () => onChoose(option.id));
			el.appendChild(button);
		}
		doc.body.appendChild(el);
		toolbar = el;
		// Deferred so the paste action's OWN pointerdown/keydown does not
		// immediately dismiss the toolbar it just opened.
		const timer = doc.defaultView?.setTimeout(() => {
			doc.addEventListener('pointerdown', dismiss, true);
			doc.addEventListener('keydown', dismiss, true);
		}, 0);
		removeOutsideListeners = () => {
			if (timer !== undefined) {
				doc.defaultView?.clearTimeout(timer);
			}
			doc.removeEventListener('pointerdown', dismiss, true);
			doc.removeEventListener('keydown', dismiss, true);
		};
	}

	paint();
	const unsubscribe = store.subscribe((state, previous) => {
		if (state.pasteOptionsToolbar !== previous.pasteOptionsToolbar) {
			paint();
		}
	});

	return {
		destroy(): void {
			unsubscribe();
			unmount();
		},
	};
}
