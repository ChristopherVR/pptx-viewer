import {
	assertElementUpdateTarget,
	cloneElementUpdates,
	prepareElementUpdateBatch,
} from 'pptx-viewer-shared';
import type { PowerPointViewerAPI } from 'pptx-viewer-shared';
import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { UseViewerIntegrationInput } from './useViewerIntegration';

/** Explicit history commits isolate batches from React's automatic batching. */
export function useElementUpdateBatch(
	input: UseViewerIntegrationInput,
): PowerPointViewerAPI['updateElements'] {
	const live = useRef(input);
	live.current = input;
	const [, render] = useState(0);
	return useCallback(async (updates, options) => {
		const owned = cloneElementUpdates(updates);
		const label = options?.label;
		// Also allow callers to start a batch from an effect after loading.
		await Promise.resolve();
		flushSync(() => render((value) => value + 1));
		const current = live.current;
		assertElementUpdateTarget({
			canEdit: current.canEdit && current.canInsertElement !== false,
			mode: current.mode,
			loaded: !current.loading && !current.error,
			editTemplateMode: current.state.editTemplateMode,
		});
		const state = current.state;
		if (
			state.dragStateRef.current ||
			state.resizeStateRef.current ||
			state.marqueeStateRef.current ||
			state.shapeAdjustmentDragStateRef.current ||
			state.isDrawingRef.current
		) {
			throw new Error('Finish the current pointer interaction before updating elements.');
		}
		// Invalid and no-op batches must not even commit pending inline text.
		if (!prepareElementUpdateBatch(current.state.slidesRef.current, owned)) {
			return;
		}
		flushSync(() => current.editorOps.canvasHandlers.handleInlineEditCommit());
		const next = prepareElementUpdateBatch(live.current.state.slidesRef.current, owned);
		if (!next) {
			return;
		}
		flushSync(() =>
			live.current.history.commitSlides(next, label, live.current.state.slidesRef.current),
		);
	}, []);
}
