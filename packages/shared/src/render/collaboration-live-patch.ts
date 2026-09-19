/**
 * collaboration-live-patch.ts: interim ("live preview") writes straight into
 * the shared Y.Doc, bypassing each binding's slides state.
 *
 * Editors keep gestures out of framework state until pointer-up/blur. Patch
 * each element's Y.Map directly so peers see those pending edits live:
 *
 *  - geometry scalars (x / y / width / height / rotation) are set in place
 *  - mounted text sessions merge observed native intent; their legacy
 *    whole-draft preview channel is suppressed while the session owns the text
 *  - writes are throttled (~1 per 50ms) with a trailing write, plus an
 *    explicit `flush()` for gesture end; borrowed sessions opt into immediate
 *    writes so the host can revoke readiness without losing accepted edits
 *  - LOCAL_SYNC_ORIGIN lets document observers skip local echoes
 * It is dormant until configure receives a live document and factories.
 */

import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { MAX_LIVE_TEXT_LENGTH, applyLivePatch } from './collaboration-live-patch-target';
import type {
	LiveGeometryPatch,
	LiveTextSource,
	PendingPatch,
} from './collaboration-live-patch-target';
import { LOCAL_SYNC_ORIGIN } from './collaboration-reconcile';
import type { YDocLike, YjsFactories } from './collaboration-sync';
import { createCollaborationTextTarget } from './collaboration-text-target';
import type { CollaborationTextTarget } from './collaboration-text-target';

export { findElementYMap, MAX_LIVE_TEXT_LENGTH } from './collaboration-live-patch-target';
export type { LiveGeometryPatch, LiveTextSource } from './collaboration-live-patch-target';
export type {
	CollaborationTextTarget,
	CollaborationInlineSnapshot,
} from './collaboration-text-target';

/** Default gap between interim doc writes. */
export const LIVE_PATCH_THROTTLE_MS = 50;

export interface CollaborationLivePatcherOptions {
	/** Minimum gap between doc writes in ms (default {@link LIVE_PATCH_THROTTLE_MS}). */
	throttleMs?: number;
}

export interface CollaborationLivePatcher {
	/** Bind a mounted native editor; its handle must be disposed on unmount. */
	beginTextEdit?: (
		slideId: string | undefined,
		elementId: string,
		onChange?: () => void,
		ownsModel?: (element: PptxElement) => boolean,
	) => CollaborationTextTarget | undefined;
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
	const textSessions = new Map<string, CollaborationTextTarget>();
	const textOwners = new Map<string, object>();
	const keyFor = (slideId: string | undefined, elementId: string): string =>
		`${slideId ?? ''}\u0000${elementId}`;
	const retireTextSessions = (): void => {
		const retiring = [...textSessions.values()];
		textSessions.clear();
		textOwners.clear();
		for (const session of retiring) {
			session.dispose();
		}
	};
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
		const key = keyFor(slideId, elementId);
		let entry = pending.get(key);
		if (!entry) {
			entry = { slideId, elementId };
			pending.set(key, entry);
		}
		return entry;
	};
	return {
		beginTextEdit(slideId, elementId, onChange, ownsModel) {
			if (!doc || !factories) {
				return undefined;
			}
			const activeDoc = doc;
			const activeFactories = factories;
			const key = keyFor(slideId, elementId);
			const owner = {};
			textOwners.set(key, owner);
			const isWritable = () =>
				doc === activeDoc && factories === activeFactories && textOwners.get(key) === owner;
			textSessions.get(key)?.dispose();
			if (!isWritable()) {
				return undefined;
			}
			const queued = pending.get(key);
			if (queued) {
				delete queued.text;
			}
			const target = createCollaborationTextTarget({
				doc,
				factories,
				slideId,
				elementId,
				onChange,
				ownsModel,
				isWritable,
			});
			if (!target || textOwners.get(key) !== owner) {
				target?.dispose();
				if (textOwners.get(key) === owner) {
					textOwners.delete(key);
				}
				return undefined;
			}
			const dispose = target.dispose;
			target.dispose = () => {
				dispose();
				if (textSessions.get(key) === target) {
					textSessions.delete(key);
				}
				if (textOwners.get(key) === owner) {
					textOwners.delete(key);
				}
			};
			textSessions.set(key, target);
			return target;
		},
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
			retireTextSessions();
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
			// Native sessions already publish exact intent, not a second whole draft.
			if (textOwners.has(keyFor(slideId, elementId))) {
				return;
			}
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
			retireTextSessions();
		},
	};
}

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
