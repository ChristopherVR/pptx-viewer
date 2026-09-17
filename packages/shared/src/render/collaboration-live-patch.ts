/**
 * collaboration-live-patch.ts: interim ("live preview") writes straight into
 * the shared Y.Doc, bypassing each binding's slides state.
 *
 * Why: the editors deliberately keep gestures out of framework state. React's
 * drag/resize writes `style.left/top/width/height` on the DOM node and only
 * calls `updateElementById` on pointer-up; every binding's inline text editor
 * buffers the typed string and only commits it on blur. Because the Y.Doc sync
 * is driven off the slides state, remote peers saw nothing until the gesture
 * (or the edit) ended.
 *
 * This module patches the element's Y.Map directly, so the host keeps its
 * per-frame performance design while peers see the move/typing live:
 *
 *  - geometry scalars (x / y / width / height / rotation) are set in place
 *  - text goes through the SAME character-level Y.Text merge the reconcile
 *    pass uses (`reconcileElementTextBody`), so concurrent typing on one
 *    element still merges instead of last-write-wins
 *  - writes are throttled (~1 per 50ms) with a trailing write, plus an
 *    explicit `flush()` for gesture end; borrowed sessions opt into immediate
 *    writes so the host can revoke readiness without losing accepted edits
 *  - every transaction is tagged with LOCAL_SYNC_ORIGIN, exactly like
 *    `reconcileSlidesInYDoc`, so the local observer skips the echo
 *
 * It is a no-op until `configure()` is handed a live doc + factories, so
 * bindings can call it unconditionally.
 */

import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';

import { MAX_LIVE_TEXT_LENGTH, applyLivePatch } from './collaboration-live-patch-target';
import type {
	LiveGeometryPatch,
	LiveTextSource,
	PendingPatch,
} from './collaboration-live-patch-target';
import { LOCAL_SYNC_ORIGIN } from './collaboration-reconcile';
import type { YDocLike, YjsFactories } from './collaboration-sync';

export { findElementYMap, MAX_LIVE_TEXT_LENGTH } from './collaboration-live-patch-target';
export type { LiveGeometryPatch, LiveTextSource } from './collaboration-live-patch-target';

/** Default gap between interim doc writes. */
export const LIVE_PATCH_THROTTLE_MS = 50;

export interface CollaborationLivePatcherOptions {
	/** Minimum gap between doc writes in ms (default {@link LIVE_PATCH_THROTTLE_MS}). */
	throttleMs?: number;
}

export interface CollaborationLivePatcher {
	/** Attach a live doc (or `null` to go dormant). Pending patches are dropped. */
	configure: (
		doc: YDocLike | null,
		factories: YjsFactories | null,
		/** Publish synchronously when the host may revoke write readiness at any time. */
		immediate?: boolean,
	) => void;
	/** True when a doc + factories are attached, i.e. patches will be written. */
	isActive: () => boolean;
	/** Queue interim geometry for an element. */
	patchGeometry: (
		slideId: string | undefined,
		elementId: string,
		geometry: LiveGeometryPatch,
	) => void;
	/** Queue interim text for an element (remapped over `source`'s segments). */
	patchText: (
		slideId: string | undefined,
		elementId: string,
		text: string,
		source?: LiveTextSource,
	) => void;
	/** Write everything queued right now (call on gesture end / edit commit). */
	flush: () => void;
	/** Drop pending work, cancel timers and detach the doc. */
	dispose: () => void;
}

// ---------------------------------------------------------------------------
// Patcher
// ---------------------------------------------------------------------------

export function createCollaborationLivePatcher(
	options: CollaborationLivePatcherOptions = {},
): CollaborationLivePatcher {
	const throttleMs = options.throttleMs ?? LIVE_PATCH_THROTTLE_MS;
	const pending = new Map<string, PendingPatch>();
	let doc: YDocLike | null = null;
	let factories: YjsFactories | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastWriteAt = Number.NEGATIVE_INFINITY;
	let immediate = false;

	const cancelTimer = (): void => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	};

	const writePending = (): void => {
		const activeDoc = doc;
		const activeFactories = factories;
		if (!activeDoc || !activeFactories || pending.size === 0) {
			pending.clear();
			return;
		}
		const patches = [...pending.values()];
		pending.clear();
		lastWriteAt = Date.now();
		try {
			activeDoc.transact(() => {
				for (const patch of patches) {
					applyLivePatch(activeDoc, activeFactories, patch, MAX_LIVE_TEXT_LENGTH);
				}
			}, LOCAL_SYNC_ORIGIN);
		} catch {
			/* a live preview must never break the gesture it mirrors */
		}
	};

	const schedule = (): void => {
		if (immediate) {
			writePending();
			return;
		}
		if (timer !== null) {
			return;
		}
		const elapsed = Date.now() - lastWriteAt;
		if (elapsed >= throttleMs) {
			writePending();
			return;
		}
		timer = setTimeout(() => {
			timer = null;
			writePending();
		}, throttleMs - elapsed);
	};

	const enqueue = (slideId: string | undefined, elementId: string): PendingPatch | null => {
		if (!doc || !factories || !elementId) {
			return null;
		}
		const key = `${slideId ?? ''}\u0000${elementId}`;
		let entry = pending.get(key);
		if (!entry) {
			entry = { slideId, elementId };
			pending.set(key, entry);
		}
		return entry;
	};

	return {
		configure(nextDoc, nextFactories, nextImmediate = false) {
			if (nextDoc === doc && nextFactories === factories && nextImmediate === immediate) {
				return;
			}
			cancelTimer();
			pending.clear();
			doc = nextDoc;
			factories = nextFactories;
			immediate = nextImmediate;
			lastWriteAt = Number.NEGATIVE_INFINITY;
		},
		isActive() {
			return doc !== null && factories !== null;
		},
		patchGeometry(slideId, elementId, geometry) {
			const entry = enqueue(slideId, elementId);
			if (!entry) {
				return;
			}
			entry.geometry = { ...entry.geometry, ...geometry };
			schedule();
		},
		patchText(slideId, elementId, text, source) {
			const entry = enqueue(slideId, elementId);
			if (!entry) {
				return;
			}
			entry.text = { value: text, source: source ?? entry.text?.source ?? {} };
			schedule();
		},
		flush() {
			cancelTimer();
			writePending();
		},
		dispose() {
			cancelTimer();
			pending.clear();
			doc = null;
			factories = null;
		},
	};
}

// ---------------------------------------------------------------------------
// Binding helpers
// ---------------------------------------------------------------------------

/**
 * Publish the interim inline-editor text for `elementId` on `slide`. Reads the
 * element's pre-edit segments/style so the remap keeps per-run formatting (and
 * equation/field metadata). Safe to call on every keystroke: it no-ops when
 * collaboration is off, the slide/element is unknown, or the element carries no
 * text.
 */
export function publishLiveInlineText(
	patcher: CollaborationLivePatcher | null | undefined,
	slide: PptxSlide | undefined,
	elementId: string | null | undefined,
	text: string,
): void {
	if (!patcher || !slide || !elementId || !patcher.isActive()) {
		return;
	}
	const element = slide.elements.find((el) => el.id === elementId);
	if (!element || !hasTextProperties(element)) {
		return;
	}
	patcher.patchText(slide.id, elementId, text, {
		textSegments: element.textSegments,
		textStyle: element.textStyle,
	});
}

/** Publish interim geometry for `elementId` on the slide with id `slideId`. */
export function publishLiveGeometry(
	patcher: CollaborationLivePatcher | null | undefined,
	slideId: string | undefined,
	elementId: string | null | undefined,
	geometry: LiveGeometryPatch,
): void {
	if (!patcher || !elementId || !patcher.isActive()) {
		return;
	}
	patcher.patchGeometry(slideId, elementId, geometry);
}
