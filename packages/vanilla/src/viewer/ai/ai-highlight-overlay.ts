import { createEl } from '../render';
/**
 * Draws animated rings around the element(s) the AI assistant is focused on,
 * rendered INSIDE the (CSS-transform-scaled) slide stage so element canvas
 * coordinates map 1:1. Two variants share the same overlay:
 *   - `pick`  : a persistent, subtle ring for an element the user handed to the
 *     assistant in pick mode (with a brief entry pulse).
 *   - `active`: a livelier pulsing ring for the element a running tool is
 *     touching right now ("the AI is looking at / working on this").
 *
 * It also toggles `data-pptx-ai-active` on the stage while the assistant is
 * active so colour edits can tween (see the round-3 CSS). Vanilla counterpart of
 * React's `AiFocusHighlightOverlay`, repainted after every stage render (the
 * renderer rebuilds the stage, discarding the previous overlay).
 */
import type { Store, ViewerState } from '../state';
import type { AiFocusController } from './ai-panel-controller';

export interface AiHighlightOverlayDeps {
	doc: Document;
	store: Store<ViewerState>;
	controller: AiFocusController;
	/** The live `.pptxv-stage` node (rebuilt on each render), or null. */
	getStageRoot(): HTMLElement | null;
}

export interface AiHighlightOverlay {
	destroy(): void;
}

/** Mount the highlight overlay; repaints on store + controller changes. */
export function mountAiHighlightOverlay(deps: AiHighlightOverlayDeps): AiHighlightOverlay {
	const { doc, store, controller } = deps;
	let layer: HTMLElement | null = null;

	const paint = (): void => {
		layer?.remove();
		layer = null;
		const stage = deps.getStageRoot();
		if (!stage) {
			return;
		}
		if (controller.isAnimating()) {
			stage.setAttribute('data-pptx-ai-active', 'true');
		} else {
			stage.removeAttribute('data-pptx-ai-active');
		}

		const state = store.get();
		const highlights = controller
			.getHighlights()
			.filter((hl) => hl.slideIndex === state.currentSlide);
		if (highlights.length === 0) {
			return;
		}
		const elements = state.slides[state.currentSlide]?.elements ?? [];
		const byId = new Map(elements.map((el) => [el.id, el]));

		const nextLayer = createEl(doc, 'div', 'pptxv-ai-hl-layer');
		for (const hl of highlights) {
			const el = byId.get(hl.elementId);
			if (!el) {
				continue;
			}
			const ring = createEl(doc, 'div', `pptxv-ai-hl pptxv-ai-hl-${hl.variant}`, {
				left: `${el.x - 3}px`,
				top: `${el.y - 3}px`,
				width: `${el.width + 6}px`,
				height: `${el.height + 6}px`,
			});
			nextLayer.appendChild(ring);
		}
		stage.appendChild(nextLayer);
		layer = nextLayer;
	};

	const unsubStore = store.subscribe(paint);
	const unsubController = controller.subscribe(paint);
	paint();

	return {
		destroy() {
			unsubStore();
			unsubController();
			layer?.remove();
			layer = null;
			deps.getStageRoot()?.removeAttribute('data-pptx-ai-active');
		},
	};
}
