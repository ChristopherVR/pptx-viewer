import type { PptxElement } from 'pptx-viewer-core';
import { motionPathFor } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import type { MotionPathOverlay } from './motion-path-overlay';
import { createMotionPathOverlay } from './motion-path-overlay';

export interface MotionPathControllerDeps {
	doc: Document;
	store: Store<ViewerState>;
	getTranslator(): Translator;
	/** Editor zoom, so a pointer delta converts back to slide pixels. */
	getScale(): number;
	/** The stage host; the scaled `.pptxv-stage` is resolved from it per sync. */
	getStageWrap(): HTMLElement | null;
	/** Primary selection, or `undefined` when nothing is selected. */
	getSelectedElement(state: ViewerState): PptxElement | undefined;
	/** Commit an edited path (end-handle drag release). */
	onChangePath(path: string): void;
}

export interface MotionPathController {
	/** Build the overlay layer (called when the chrome is attached). */
	attach(): void;
	/** Re-project the selection's path onto the current stage. */
	sync(): void;
	detach(): void;
}

/**
 * Owns the on-canvas motion-path layer for the editor.
 *
 * Split out of `editor-controller.ts` (already well past the file-size rule)
 * because this layer has a lifecycle of its own: unlike the selection chrome it
 * lives INSIDE the stage's zoom transform, so it must be re-mounted after every
 * stage rebuild, and `.pptxv-stage` is therefore resolved fresh on each sync
 * rather than cached.
 */
export function createMotionPathController(deps: MotionPathControllerDeps): MotionPathController {
	let overlay: MotionPathOverlay | null = null;

	return {
		attach() {
			overlay?.destroy();
			overlay = createMotionPathOverlay(deps.doc, deps.getTranslator(), deps.onChangePath);
		},
		sync() {
			if (!overlay) {
				return;
			}
			const state = deps.store.get();
			const editing = state.editable && !state.presenting;
			const element = editing ? deps.getSelectedElement(state) : undefined;
			const slide = state.slides[state.currentSlide];
			overlay.update({
				element: element ?? null,
				path: element ? motionPathFor(slide?.animations ?? [], element.id) : undefined,
				canvasSize: state.canvasSize,
				scale: deps.getScale(),
				canEdit: editing,
			});
			overlay.mount(deps.getStageWrap()?.querySelector<HTMLElement>('.pptxv-stage') ?? null);
		},
		detach() {
			overlay?.destroy();
			overlay = null;
		},
	};
}
