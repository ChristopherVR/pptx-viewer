/**
 * collaboration-remote-sync.ts: observe the shared Y.Doc for remote slide
 * changes and apply them into the editable slides. Extracted from
 * `collaboration.svelte.ts` to keep that class within the file-size budget;
 * holds no state of its own, only callbacks into the controller's fields.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig, YDocLike } from 'pptx-viewer-shared';
import { LOCAL_SYNC_ORIGIN, observeYDocSlides, readSlidesFromYDoc } from 'pptx-viewer-shared';

export interface ObserveRemoteDeps {
	isApplyingRemote: () => boolean;
	setApplyingRemote: (value: boolean) => void;
	setLastSynced: (value: string) => void;
	applyRemoteSlides: (slides: PptxSlide[]) => void;
	scheduleWriteBack: (config: CollaborationConfig) => void;
}

/** Register the remote-slide observer; returns the unobserve function. */
export function observeRemoteSlides(
	ydoc: YDocLike,
	config: CollaborationConfig,
	deps: ObserveRemoteDeps,
): () => void {
	return observeYDocSlides(ydoc, (_events, transaction) => {
		if (transaction?.origin === LOCAL_SYNC_ORIGIN || deps.isApplyingRemote()) {
			return;
		}
		const remote = readSlidesFromYDoc(ydoc);
		if (remote.length === 0) {
			return;
		}
		deps.setApplyingRemote(true);
		deps.applyRemoteSlides(remote);
		deps.setApplyingRemote(false);
		// Dedupe the echo: the publish effect this apply schedules is a no-op.
		deps.setLastSynced(JSON.stringify(remote));
		deps.scheduleWriteBack(config);
	});
}
