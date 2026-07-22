/**
 * While the AI panel is in PICK MODE, intercept the next canvas element
 * click(s) as picks for the assistant instead of letting them select/edit. A
 * capture-phase `pointerdown` on the viewport resolves the top-level element the
 * user pointed at (via the editor's own hit-testing) and hands it to the
 * {@link AiFocusController}, stopping the event before the editor's stage
 * handler runs. Picks are deduped and highlighted by the controller/overlay.
 */
import { resolveTopLevelElementId } from '../editor/element-hit';
import type { Store, ViewerState } from '../state';
import type { AiFocusController } from './ai-panel-controller';

export interface AiPickInterceptionDeps {
	/** The scrollable viewport that contains the stage (a capture-phase anchor). */
	viewport: HTMLElement;
	store: Store<ViewerState>;
	controller: AiFocusController;
	/** The live `.pptxv-stage` node, or null. */
	getStageRoot(): HTMLElement | null;
}

export interface AiPickInterception {
	destroy(): void;
}

/** Attach the capture-phase pick interceptor. */
export function mountAiPickInterception(deps: AiPickInterceptionDeps): AiPickInterception {
	const { viewport, store, controller } = deps;

	const onPointerDown = (event: PointerEvent): void => {
		if (!controller.isPicking() || event.button !== 0) {
			return;
		}
		const id = resolveTopLevelElementId(event.target, deps.getStageRoot());
		if (!id) {
			return;
		}
		// Claim the event so the editor never sees it as a select/drag press.
		event.preventDefault();
		event.stopImmediatePropagation();
		controller.addPick(store.get().currentSlide, id);
	};

	viewport.addEventListener('pointerdown', onPointerDown, true);

	return {
		destroy() {
			viewport.removeEventListener('pointerdown', onPointerDown, true);
		},
	};
}
