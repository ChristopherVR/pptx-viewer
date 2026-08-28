import type { PresentationSnapshot } from 'pptx-viewer-shared';

import type { EditorController } from './editor';
import type { Translator } from './i18n';
import type { PresentationAnnotationsController } from './presentation-annotations';
import { createPresentationAnnotationsController } from './presentation-annotations';
import type { Store, ViewerState } from './state';
import type { ViewerChrome } from './ui';

export interface PresentationAnnotationsHost {
	sync(snapshot: PresentationSnapshot): void;
	/**
	 * Discard the show's ink. The controller owns the strokes, so emptying
	 * `snapshot.inkStrokes` alone never erased anything: the next `sync` remounted
	 * the overlay from the controller's own (untouched) list and the ink came
	 * straight back.
	 */
	clear(): void;
	finish(): Promise<'none' | 'kept' | 'discarded'>;
	dispose(): void;
}

export function createPresentationAnnotationsHost(options: {
	doc: Document;
	t: Translator;
	store: Store<ViewerState>;
	editor: EditorController;
	getChrome(): ViewerChrome;
	getSnapshot(): PresentationSnapshot;
	updateSnapshot(patch: Partial<PresentationSnapshot>): void;
	/** File > Options > Advanced > "Prompt to keep ink annotations when exiting". */
	shouldPromptKeepAnnotations?(): boolean;
}): PresentationAnnotationsHost {
	const controller: PresentationAnnotationsController = createPresentationAnnotationsController({
		doc: options.doc,
		t: options.t,
		getSlides: () => options.store.get().slides,
		commitSlides: (slides) => options.editor.commitSlides(slides),
		shouldPromptKeepAnnotations: options.shouldPromptKeepAnnotations,
		onStrokesChange: (inkStrokes) => options.updateSnapshot({ inkStrokes }),
		onPointerMove: ({ x, y }) =>
			options.updateSnapshot({
				pointer: {
					...(options.getSnapshot().pointer ?? {
						tool: 'laser',
						color: '#ef4444',
					}),
					x,
					y,
				},
			}),
	});
	return {
		sync(snapshot) {
			const state = options.store.get();
			controller.syncStage({
				stageWrap: options.getChrome().stageWrap,
				// Ctrl+M hides the ink overlay without discarding the strokes.
				active: state.presenting && snapshot.inkMarkupVisible !== false,
				slideIndex: state.currentSlide,
				canvasSize: state.canvasSize,
				pointer: snapshot.pointer,
				blackout: snapshot.blackout,
			});
		},
		clear: () => controller.clear(),
		finish: () => controller.finishPresentation(),
		dispose: () => controller.dispose(),
	};
}
