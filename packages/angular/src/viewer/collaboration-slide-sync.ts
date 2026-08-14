/**
 * collaboration-slide-sync.ts: the granular local<->doc slide sync engine for
 * the Angular `CollaborationService`, extracted so the service stays within the
 * repo's 300 LOC ceiling.
 *
 * Owns the first-write gate plus the echo-dedupe bookkeeping (`lastSynced`,
 * `applyingRemote`, `pendingBroadcast`) and the broadcast / remote-apply /
 * post-load-adoption logic. The service keeps provider + awareness ownership
 * and binds this engine to the live doc for the duration of a session.
 */

import type { PptxSlide } from 'pptx-viewer-core';

import type { CollabLoadOrigin, YjsFactories, YTransactionLike } from '../internal/shared';
import {
	createSyncGate,
	LOCAL_SYNC_ORIGIN,
	readSlidesFromYDoc,
	reconcileSlidesInYDoc,
	shouldRoomSlidesReplaceLoad,
	YDOC_SLIDES_KEY,
} from '../internal/shared';
import type { DestroyableYDoc, ProviderLike } from './collaboration-providers';

/** Live-session references the engine writes into, set on connect. */
export interface SlideSyncBinding {
	ydoc: DestroyableYDoc;
	factories: YjsFactories;
	/** Apply remotely-authored slides to viewer state. */
	onRemoteSlides: ((slides: PptxSlide[]) => void) | null;
	/** Schedule an owner-role write-back after a doc mutation. */
	scheduleWriteBack: () => void;
}

export class SlideSyncEngine {
	/**
	 * First-write gate: local broadcasts are suppressed (captured as pending)
	 * until the provider confirms its initial sync or the grace period lifts the
	 * gate, so a late joiner never seeds its placeholder deck into a room whose
	 * real content has not arrived yet.
	 */
	readonly gate = createSyncGate(() => this.#flushPending());

	#binding: SlideSyncBinding | null = null;
	#lastSynced = '';
	#applyingRemote = false;
	#pending: readonly PptxSlide[] | null = null;

	/** Attach the engine to a freshly connected session's doc. */
	bind(binding: SlideSyncBinding): void {
		this.#binding = binding;
	}

	/** Clear all per-session state (call on disconnect). */
	reset(): void {
		this.gate.reset();
		this.#binding = null;
		this.#pending = null;
		this.#lastSynced = '';
		this.#applyingRemote = false;
	}

	/**
	 * Record the current local deck as the sync baseline so the first (unchanged)
	 * broadcast after connecting is suppressed. Call right after connect for a
	 * joiner whose local deck is a placeholder awaiting remote sync, so it never
	 * overwrites the shared document before receiving it.
	 */
	seedBaseline(slides: readonly PptxSlide[]): void {
		this.#lastSynced = JSON.stringify(slides);
	}

	/**
	 * Open the first-write gate on the provider's initial-sync confirmation.
	 * y-websocket emits 'sync' with a boolean; y-webrtc emits 'synced' with an
	 * object carrying a `synced` flag (and only once a peer syncs, hence the
	 * grace timer). Listen to both; opening is idempotent.
	 */
	wireSynced(provider: ProviderLike): void {
		const handle = (payload: unknown): void => {
			const flag = payload as boolean | { synced?: boolean } | undefined;
			const isSynced = typeof flag === 'boolean' ? flag : flag?.synced !== false;
			if (isSynced) {
				this.gate.open();
			}
		};
		provider.on('sync', handle);
		provider.on('synced', handle);
		if (provider.synced === true) {
			this.gate.open();
		} else {
			this.gate.arm();
		}
	}

	/**
	 * Broadcast the local slide set to peers, reconciling only what changed into
	 * the pptx:slides Y.Array. An empty deck is never written (so a late-joiner
	 * that has not yet received the doc cannot clobber it), an unchanged deck is
	 * skipped, and while the gate is shut the deck is held as pending.
	 */
	broadcast(slides: readonly PptxSlide[]): void {
		const b = this.#binding;
		if (!b || this.#applyingRemote || slides.length === 0) {
			return;
		}
		if (!this.gate.isOpen()) {
			this.#pending = slides;
			return;
		}
		const s = JSON.stringify(slides);
		if (s === this.#lastSynced) {
			return;
		}
		this.#lastSynced = s;
		reconcileSlidesInYDoc([...slides], b.ydoc, b.factories, LOCAL_SYNC_ORIGIN);
		b.scheduleWriteBack();
	}

	/** Handle a remote Y.Doc change, skipping our own local-origin transactions. */
	onRemoteChange(transaction?: YTransactionLike): void {
		const b = this.#binding;
		if (transaction?.origin === LOCAL_SYNC_ORIGIN || this.#applyingRemote || !b) {
			return;
		}
		const remote = readSlidesFromYDoc(b.ydoc);
		if (remote.length === 0) {
			return;
		}
		// Suppress the echo: record what we just applied so the subsequent local
		// broadcast (driven by the editor signal) is a no-op.
		this.#lastSynced = JSON.stringify(remote);
		this.#applyingRemote = true;
		b.onRemoteSlides?.(remote);
		this.#applyingRemote = false;
		b.scheduleWriteBack();
	}

	/**
	 * Re-adopt the shared document's slides after a local content load committed
	 * a parsed deck to viewer state. The load pipeline applies its deck
	 * unconditionally, so a load finishing AFTER the room's slides were applied
	 * (a late joiner's bootstrap deck parsing slower than the doc sync) would
	 * clobber the synced state, and with the doc itself unchanged the observer
	 * never re-fires. When the room already has slides they win, re-applied
	 * through `onRemoteSlides` and recorded as the baseline (bypassing the JSON
	 * dedupe) so the follow-up local broadcast is a no-op. An empty room means
	 * this client is the seeder. Returns true when the doc was adopted.
	 *
	 * Only a BOOTSTRAP deck loses this argument. A file the user opened during
	 * the session is what they asked for: replacing it left the room's starter
	 * deck on screen and lost the file entirely (`shouldRoomSlidesReplaceLoad`).
	 */
	adoptDocAfterLoad(origin: CollabLoadOrigin = 'user'): boolean {
		const b = this.#binding;
		if (!b) {
			return false;
		}
		const docSlides = readSlidesFromYDoc(b.ydoc);
		if (!shouldRoomSlidesReplaceLoad(origin, docSlides.length)) {
			return false;
		}
		this.#lastSynced = JSON.stringify(docSlides);
		this.#applyingRemote = true;
		b.onRemoteSlides?.(docSlides);
		this.#applyingRemote = false;
		return true;
	}

	/**
	 * Perform the deferred first broadcast once the gate opens. When the doc is
	 * still empty (fresh room, or nobody else present), clear the baseline so the
	 * pending deck actually seeds it; when remote content already arrived, the
	 * pending deck matches the applied baseline and the write is a no-op.
	 */
	#flushPending(): void {
		const b = this.#binding;
		const pending = this.#pending;
		this.#pending = null;
		if (!pending || !b) {
			return;
		}
		if (b.ydoc.getArray(YDOC_SLIDES_KEY).length === 0) {
			this.#lastSynced = '';
		}
		this.broadcast(pending);
	}
}
