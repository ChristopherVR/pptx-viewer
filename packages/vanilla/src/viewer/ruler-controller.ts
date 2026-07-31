import type { RulerUnit } from 'pptx-viewer-shared';

import { getActiveElements } from './editor/editor-active-elements';
import type { Store, ViewerState } from './state';
import type { RulerSelection } from './ui';
import { createRulerStrips } from './ui';

/**
 * Owns the View > Rulers strips: turns store state into {@link RulerStrips}
 * updates and keeps them attached to the stage wrap.
 *
 * A controller (rather than a call inside the render controller) because the
 * two things that must repaint the rulers happen on different clocks: the stage
 * is rebuilt with `replaceChildren` (which detaches the strips, so they need
 * re-mounting), while selection / zoom / the Rulers toggle change the strips
 * WITHOUT re-rendering the stage at all. Subscribing to the store covers the
 * second, and {@link RulerController.sync} is called from the post-render hook
 * for the first.
 */
export interface RulerControllerDeps {
	doc: Document;
	store: Store<ViewerState>;
	/** The live stage wrap; rebuilt whenever the chrome is remounted. */
	getStageWrap(): HTMLElement | null;
	/** Effective stage scale (fit * zoom), owned by the render controller. */
	getScale(): number;
	/** Unit system for the labels; PowerPoint defaults to inches. */
	getUnit?(): RulerUnit;
	/** Drop a guide dragged off a strip, at an already-resolved slide position. */
	onCreateGuide(axis: 'h' | 'v', position: number): void;
}

export interface RulerController {
	/** Re-attach and repaint the strips (call after every stage render). */
	sync(): void;
	destroy(): void;
}

export function createRulerController(deps: RulerControllerDeps): RulerController {
	const strips = createRulerStrips(deps.doc, deps.onCreateGuide);

	/** Single selection only, matching React/Vue/Angular/Svelte. */
	const selection = (state: ViewerState): RulerSelection | null => {
		if (state.selectedElementIds.length !== 1) {
			return null;
		}
		const element = getActiveElements(state).find(
			(candidate) => candidate.id === state.selectedElementIds[0],
		);
		return element
			? { x: element.x, y: element.y, width: element.width, height: element.height }
			: null;
	};

	const sync = (): void => {
		const stageWrap = deps.getStageWrap();
		if (!stageWrap) {
			return;
		}
		strips.mount(stageWrap);
		const state = deps.store.get();
		strips.update({
			// Rulers are an editing aid, so they never intrude on the slide show.
			visible: state.showRulers && !state.presenting,
			canvasSize: state.canvasSize,
			scale: deps.getScale(),
			unit: deps.getUnit?.() ?? 'inches',
			selection: selection(state),
			draggable: state.editable && !state.presenting,
		});
	};

	const unsubscribe = deps.store.subscribe(sync);

	return {
		sync,
		destroy() {
			unsubscribe();
			strips.destroy();
		},
	};
}
