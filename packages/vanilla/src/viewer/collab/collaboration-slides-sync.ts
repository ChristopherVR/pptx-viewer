/**
 * collaboration-slides-sync.ts: local<->remote slide synchronization for the
 * vanilla viewer's collaboration session.
 *
 * Local edits publish granularly via the shared `reconcileSlidesInYDoc`
 * (diff by id, one transaction); remote updates read back via
 * `readSlidesFromYDoc` and replace the store's working slides. Echo-dedupe
 * (`lastSynced`) and the `applyingRemote` re-entrancy guard are owned here so
 * the collaboration controller only has to call `flushLocalSlides` /
 * `applyRemoteSlides` at the right moments.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig, YDocLike, YjsFactories } from 'pptx-viewer-shared';
import { reconcileSlidesInYDoc, readSlidesFromYDoc } from 'pptx-viewer-shared';

import { clampSlideIndex } from '../state';
import type { Store, ViewerState } from '../state';

export interface SlidesSync {
	/** Publish the current local slides into the doc (granular, echo-deduped). No-op while a remote apply is in flight or `publishSuppressed`. */
	flushLocalSlides(
		ydoc: YDocLike | null,
		factories: YjsFactories | null,
		config: CollaborationConfig | null,
		publishSuppressed: boolean,
	): void;
	/**
	 * Apply the doc's current slides into the store (skips an empty/unsynced
	 * doc). Applies unconditionally when the doc has slides: the JSON dedupe is
	 * only ever written here, never consulted, so callers can also use this to
	 * re-adopt the doc after a local content load. Returns whether doc slides
	 * were applied.
	 */
	applyRemoteSlides(ydoc: YDocLike | null, config: CollaborationConfig): boolean;
	/** Whether a remote apply is currently in flight (observer re-entrancy guard). */
	isApplyingRemote(): boolean;
	/** Clear echo-dedupe/re-entrancy state (session teardown). */
	reset(): void;
}

export function createSlidesSync(
	store: Store<ViewerState>,
	scheduleWriteBack: (config: CollaborationConfig) => void,
): SlidesSync {
	let lastSynced = '';
	let applyingRemote = false;

	function flushLocalSlides(
		ydoc: YDocLike | null,
		factories: YjsFactories | null,
		config: CollaborationConfig | null,
		publishSuppressed: boolean,
	): void {
		if (!ydoc || !factories || applyingRemote || publishSuppressed) {
			return;
		}
		const slides = store.get().slides;
		const serialized = JSON.stringify(slides);
		if (serialized === lastSynced) {
			return;
		}
		lastSynced = serialized;
		reconcileSlidesInYDoc(slides, ydoc, factories);
		if (config) {
			scheduleWriteBack(config);
		}
	}

	function applyRemoteSlides(ydoc: YDocLike | null, config: CollaborationConfig): boolean {
		if (!ydoc) {
			return false;
		}
		const remote: PptxSlide[] = readSlidesFromYDoc(ydoc);
		if (remote.length === 0) {
			return false;
		}
		applyingRemote = true;
		store.set({
			slides: remote,
			currentSlide: clampSlideIndex(store.get().currentSlide, remote.length),
		});
		applyingRemote = false;
		// Dedupe the echo: the store change this triggers is a no-op for us.
		lastSynced = JSON.stringify(remote);
		scheduleWriteBack(config);
		return true;
	}

	function reset(): void {
		lastSynced = '';
		applyingRemote = false;
	}

	return {
		flushLocalSlides,
		applyRemoteSlides,
		isApplyingRemote: () => applyingRemote,
		reset,
	};
}
