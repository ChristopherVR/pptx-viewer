/**
 * The small icon-strip PowerPoint anchors to the bottom-right corner of a
 * just-pasted element, offering the same four Paste Special formats as a
 * one-click follow-up. Dismissed by any subsequent pointerdown or keydown,
 * same as the element context menu.
 *
 * Reactive: mounted once and repainted whenever `store`'s `pasteOptionsToolbar`
 * field changes (set/cleared by the clipboard actions and the dialog). A thin
 * adapter over the shared `pptx-ui-paste-options`: this measures the pasted
 * element and the element renders, positions and dismisses the strip.
 */
import { findCanvasElementNode, registerPptxWebControls } from 'pptx-viewer-shared';
import type {
	PasteOptionsRequestEvent,
	PasteSpecialFormat,
	PptxUiPasteOptionsElement,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
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
	registerPptxWebControls();
	let toolbar: PptxUiPasteOptionsElement | null = null;
	let cancelPending: (() => void) | undefined;

	function dismiss(): void {
		store.set({ pasteOptionsToolbar: null });
	}

	function unmount(): void {
		cancelPending?.();
		cancelPending = undefined;
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
				cancelPending = () => view.cancelAnimationFrame(frame);
			}
			return;
		}
		const box = node.getBoundingClientRect();
		const el = doc.createElement('pptx-ui-paste-options');
		el.state = { left: box.right, top: box.bottom, translate: getTranslator() };
		el.addEventListener('paste-options-request', (event) =>
			onChoose((event as PasteOptionsRequestEvent).detail.format),
		);
		el.addEventListener('paste-options-dismiss', dismiss);
		doc.body.appendChild(el);
		toolbar = el;
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
