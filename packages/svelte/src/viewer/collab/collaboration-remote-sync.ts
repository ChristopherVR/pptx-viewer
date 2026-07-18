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

/** The subset of {@link ObserveRemoteDeps} needed by {@link adoptDocSlidesAfterLoad}. */
export type AdoptDocSlidesDeps = Pick<
	ObserveRemoteDeps,
	'setApplyingRemote' | 'setLastSynced' | 'applyRemoteSlides'
>;

/**
 * Re-adopt the shared doc's slides after a local content load. The load
 * pipeline applies its parsed deck to viewer state unconditionally, so when a
 * late joiner's bootstrap deck finishes parsing AFTER the room's slides were
 * already synced in, the synced state is silently clobbered and, with the doc
 * itself unchanged, the observer never re-fires. Called by the load pipeline
 * right after it commits a parsed deck: when the room already has slides they
 * win; an empty room means this client is the seeder and its loaded deck
 * stands (written into the doc by the normal gated publish path).
 */
export function adoptDocSlidesAfterLoad(ydoc: YDocLike, deps: AdoptDocSlidesDeps): void {
	const docSlides = readSlidesFromYDoc(ydoc);
	if (docSlides.length === 0) {
		return;
	}
	// Bypass the JSON dedupe: point it at the doc content so the publish flush
	// this apply schedules is recognized as an echo, not a fresh local edit.
	deps.setLastSynced(JSON.stringify(docSlides));
	deps.setApplyingRemote(true);
	deps.applyRemoteSlides(docSlides);
	// Release asynchronously: the publish effect runs later in the same flush
	// and must still see the guard up.
	queueMicrotask(() => deps.setApplyingRemote(false));
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
