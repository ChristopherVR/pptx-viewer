/**
 * collaboration-load-adoption.ts: re-adopt the shared doc's slides after a
 * local content load completes mid-session.
 *
 * The content-load pipeline parses asynchronously and assigns its slides
 * unconditionally when done. A late joiner's bootstrap deck can therefore
 * finish parsing AFTER the room's real slides arrived over the doc sync and
 * silently clobber them; with the Y.Doc itself unchanged afterwards, the doc
 * observer never re-fires, so the bootstrap deck would stick until a remote
 * edit. Watching the host's load-version counter closes that hole: on every
 * bump, if the room already holds slides they win; an empty room means this
 * client is the seeder and its loaded deck stands.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { YDocLike } from 'pptx-viewer-shared';
import { readSlidesFromYDoc } from 'pptx-viewer-shared';
import { watch } from 'vue';
import type { Ref, WatchStopHandle } from 'vue';

export interface LoadAdoptionContext {
	/** Bumped by the host each time a content load finishes applying. */
	loadVersion: Ref<number>;
	/** The session's live Y.Doc, or null once the session stopped. */
	getYDoc: () => YDocLike | null;
	/** Whether the session currently reports a connection. */
	isConnected: () => boolean;
	/** Apply the doc's slides locally (sets the applying-remote guard + dedupe). */
	adoptDocSlides: (docSlides: PptxSlide[]) => void;
}

/**
 * Watch the load-version counter and re-adopt the doc's slides on each bump.
 * The watcher flushes synchronously: the load pipeline assigns its slides
 * first (queueing the local-slides pre-watcher) and bumps the counter right
 * after, and queued pre-watchers run in trigger order, so only a sync flush
 * guarantees adoption runs (and re-primes the echo dedupe) before the local
 * write could push the bootstrap deck into the doc.
 */
export function watchLoadAdoption(ctx: LoadAdoptionContext): WatchStopHandle {
	return watch(
		ctx.loadVersion,
		() => {
			const doc = ctx.getYDoc();
			if (!doc || !ctx.isConnected()) {
				return;
			}
			const docSlides = readSlidesFromYDoc(doc);
			if (docSlides.length === 0) {
				return;
			}
			ctx.adoptDocSlides(docSlides);
		},
		{ flush: 'sync' },
	);
}
