import type { PptxElement, PptxHeaderFooter, PptxSlide } from 'pptx-viewer-core';
import { useRef, useState, useCallback, useEffect } from 'react';

import type { CanvasSize, EditorHistorySnapshot } from '../types';
import { cloneHistorySnapshot, cloneSlide, cloneTemplateElementsBySlideId } from '../utils/clone';

// ---------------------------------------------------------------------------
// Input / output interfaces
// ---------------------------------------------------------------------------

export interface EditorHistoryInput {
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	activeSlideIndex: number;
	templateElementsBySlideId: Record<string, PptxElement[]>;
	selectedElementId: string | null;
	selectedElementIds: string[];
	editTemplateMode: boolean;
	headerFooter: PptxHeaderFooter;
	loading: boolean;
	error: string | null;
	/**
	 * Undo-stack depth (File > Options > Advanced > "Maximum number of undos",
	 * resolved via the shared `resolveHistoryDepth`). Defaults to 120.
	 */
	maxHistoryEntries?: number;
	hasActivePointerInteraction: () => boolean;
	pointerCommitNonce: number;
	/**
	 * Raised whenever a local edit is committed, i.e. exactly when this hook
	 * learns the deck has diverged from what was last loaded or saved.
	 *
	 * This is what drives `state.isDirty`, and through it the status bar, the
	 * host's `onDirtyChange` (the demos hang their "* filename" title marker off
	 * it) and - critically - `useAutosave`, which short-circuits on a clean
	 * document. Before this existed, `isDirty` was raised only by a few
	 * master-view and document-property paths, so an element nudge, Home > New
	 * Slide or a notes edit left the flag false and crash recovery never ran.
	 */
	onDirty?: () => void;
	// Setters for applying snapshots
	setSlides: (slides: PptxSlide[]) => void;
	setCanvasSize: (size: CanvasSize) => void;
	setActiveSlideIndex: (index: number) => void;
	setTemplateElementsBySlideId: (map: Record<string, PptxElement[]>) => void;
	setSelectedElementId: (id: string | null) => void;
	setSelectedElementIds: (ids: string[]) => void;
	setEditTemplateMode: (mode: boolean) => void;
	setHeaderFooter: (hf: PptxHeaderFooter) => void;
}

export interface EditorHistoryResult {
	canUndo: boolean;
	canRedo: boolean;
	undoLabel: string | undefined;
	redoLabel: string | undefined;
	handleUndo: () => void;
	handleRedo: () => void;
	resetHistory: () => void;
	markDirty: () => void;
	buildHistorySnapshot: (actionLabel?: string) => EditorHistorySnapshot;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_HISTORY_ENTRIES = 120;

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

/**
 * The part of a history snapshot that IS the document.
 *
 * `activeSlideIndex` is deliberately excluded. It rides along in the STORED
 * snapshot so undo/redo return the user to the slide the edit happened on, but
 * it must never take part in deciding whether the deck changed: clicking a
 * thumbnail reassigns nothing but the index, and comparing the whole snapshot
 * made that read as a document mutation. The consequences were both visible to
 * the user - the deck was marked dirty, so autosave wrote a crash-recovery
 * snapshot and the next visit offered to "recover unsaved changes" for a deck
 * that had only been read, and every slide click pushed an undo entry, so
 * Ctrl+Z walked back through navigation instead of edits. Angular and Vanilla
 * raise dirty from explicit commit choke points and never had either symptom.
 *
 * Note this is only the CHANGE GATE: an edit still announces itself through
 * `markDirty()` the moment it commits, so narrowing the comparison cannot
 * swallow an edit made immediately after a navigation.
 */
function serializeDocument(snapshot: EditorHistorySnapshot): string {
	return JSON.stringify({
		width: snapshot.width,
		height: snapshot.height,
		slides: snapshot.slides,
		templateElementsBySlideId: snapshot.templateElementsBySlideId,
	});
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditorHistory(input: EditorHistoryInput): EditorHistoryResult {
	const {
		slides,
		canvasSize,
		activeSlideIndex,
		templateElementsBySlideId,
		loading,
		error,
		maxHistoryEntries = DEFAULT_MAX_HISTORY_ENTRIES,
		hasActivePointerInteraction,
		pointerCommitNonce,
		onDirty,
		setSlides,
		setCanvasSize,
		setActiveSlideIndex,
		setTemplateElementsBySlideId,
		setSelectedElementId,
		setSelectedElementIds,
	} = input;

	// -- Refs ---------------------------------------------------------------

	const historyPastRef = useRef<EditorHistorySnapshot[]>([]);
	const historyFutureRef = useRef<EditorHistorySnapshot[]>([]);
	const lastHistorySnapshotRef = useRef<EditorHistorySnapshot | null>(null);
	const lastHistorySerializedRef = useRef<string>('');
	/**
	 * Cheap structural hash so we can short-circuit the expensive
	 * JSON.stringify when no slide-shape change has occurred. Only when the
	 * cheap hash differs do we fall back to a full deep stringify comparison.
	 */
	const lastCheapHashRef = useRef<string>('');
	const isApplyingHistoryRef = useRef(false);
	const unlockHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// -- State --------------------------------------------------------------

	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [undoLabel, setUndoLabel] = useState<string | undefined>(undefined);
	const [redoLabel, setRedoLabel] = useState<string | undefined>(undefined);
	/**
	 * Monotonic counter bumped by every `markDirty()` call, i.e. by every local
	 * edit-commit choke point in the editor.
	 *
	 * It exists because the cheap hash below is deliberately blind to an
	 * element's CONTENT: it only sees slide / element counts. An edit that
	 * rewrites a property in place (any inspector field, a ribbon format
	 * command, an inline-text commit) changes no count, so without a nonce the
	 * hash is byte-identical before and after and the effect returns before it
	 * ever reaches the snapshot push. The edit lands on screen and is silently
	 * absent from the undo stack.
	 *
	 * `markDirty` previously flipped a boolean, which changes state exactly
	 * once in a session and so could not re-open the gate. Counting instead
	 * makes every commit distinguishable.
	 */
	const [editCommitNonce, setEditCommitNonce] = useState(0);

	// -- Helpers ------------------------------------------------------------

	const updateHistoryAvailability = useCallback(() => {
		setCanUndo(historyPastRef.current.length > 0);
		setCanRedo(historyFutureRef.current.length > 0);
		const pastTop = historyPastRef.current[historyPastRef.current.length - 1];
		setUndoLabel(pastTop?.actionLabel);
		const futureTop = historyFutureRef.current[historyFutureRef.current.length - 1];
		setRedoLabel(futureTop?.actionLabel);
	}, []);

	const buildHistorySnapshot = useCallback(
		(actionLabel?: string): EditorHistorySnapshot => {
			return {
				width: canvasSize.width,
				height: canvasSize.height,
				activeSlideIndex,
				slides: slides.map(cloneSlide),
				templateElementsBySlideId: cloneTemplateElementsBySlideId(templateElementsBySlideId),
				...(actionLabel ? { actionLabel } : {}),
			};
		},
		[activeSlideIndex, canvasSize, slides, templateElementsBySlideId],
	);

	const applyHistorySnapshot = useCallback(
		(snapshot: EditorHistorySnapshot) => {
			const maxSlideIndex = Math.max(snapshot.slides.length - 1, 0);
			setCanvasSize({
				width: snapshot.width,
				height: snapshot.height,
			});
			setSlides(snapshot.slides.map(cloneSlide));
			setTemplateElementsBySlideId(
				cloneTemplateElementsBySlideId(snapshot.templateElementsBySlideId),
			);
			setActiveSlideIndex(Math.min(snapshot.activeSlideIndex, maxSlideIndex));
			setSelectedElementIds([]);
			setSelectedElementId(null);
		},
		[
			setActiveSlideIndex,
			setCanvasSize,
			setSelectedElementId,
			setSelectedElementIds,
			setSlides,
			setTemplateElementsBySlideId,
		],
	);

	const unlockHistoryTracking = useCallback(() => {
		if (unlockHistoryTimerRef.current) {
			clearTimeout(unlockHistoryTimerRef.current);
		}
		unlockHistoryTimerRef.current = setTimeout(() => {
			isApplyingHistoryRef.current = false;
		}, 0);
	}, []);

	/**
	 * Held in a ref so `markDirty` can stay identity-stable: it is passed down
	 * into dozens of memoised handlers, and a changing identity would invalidate
	 * all of them on every render.
	 */
	const onDirtyRef = useRef(onDirty);
	useEffect(() => {
		onDirtyRef.current = onDirty;
	}, [onDirty]);

	const markDirty = useCallback(() => {
		setEditCommitNonce((previous) => previous + 1);
		onDirtyRef.current?.();
	}, []);

	// -- Stack navigation ---------------------------------------------------

	const handleUndo = useCallback(() => {
		const previousSnapshot = historyPastRef.current.pop();
		if (!previousSnapshot) {
			return;
		}

		const currentSnapshot = buildHistorySnapshot();
		historyFutureRef.current.push(currentSnapshot);
		isApplyingHistoryRef.current = true;
		const nextSnapshot = cloneHistorySnapshot(previousSnapshot);
		lastHistorySnapshotRef.current = cloneHistorySnapshot(nextSnapshot);
		lastHistorySerializedRef.current = serializeDocument(nextSnapshot);
		applyHistorySnapshot(nextSnapshot);
		updateHistoryAvailability();
		unlockHistoryTracking();
		markDirty();
	}, [
		applyHistorySnapshot,
		buildHistorySnapshot,
		markDirty,
		unlockHistoryTracking,
		updateHistoryAvailability,
	]);

	const handleRedo = useCallback(() => {
		const nextSnapshot = historyFutureRef.current.pop();
		if (!nextSnapshot) {
			return;
		}

		const currentSnapshot = buildHistorySnapshot();
		historyPastRef.current.push(currentSnapshot);
		isApplyingHistoryRef.current = true;
		const targetSnapshot = cloneHistorySnapshot(nextSnapshot);
		lastHistorySnapshotRef.current = cloneHistorySnapshot(targetSnapshot);
		lastHistorySerializedRef.current = serializeDocument(targetSnapshot);
		applyHistorySnapshot(targetSnapshot);
		updateHistoryAvailability();
		unlockHistoryTracking();
		markDirty();
	}, [
		applyHistorySnapshot,
		buildHistorySnapshot,
		markDirty,
		unlockHistoryTracking,
		updateHistoryAvailability,
	]);

	// -- Reset --------------------------------------------------------------

	const resetHistory = useCallback(
		(initialSnapshot?: EditorHistorySnapshot | null) => {
			historyPastRef.current = [];
			historyFutureRef.current = [];
			if (initialSnapshot) {
				const clonedInitial = cloneHistorySnapshot(initialSnapshot);
				lastHistorySnapshotRef.current = clonedInitial;
				lastHistorySerializedRef.current = serializeDocument(clonedInitial);
			} else {
				lastHistorySnapshotRef.current = null;
				lastHistorySerializedRef.current = '';
			}
			updateHistoryAvailability();
		},
		[updateHistoryAvailability],
	);

	// -- Cleanup timer on unmount -------------------------------------------

	useEffect(() => {
		return () => {
			if (unlockHistoryTimerRef.current) {
				clearTimeout(unlockHistoryTimerRef.current);
				unlockHistoryTimerRef.current = null;
			}
		};
	}, []);

	// -- History tracking effect --------------------------------------------

	useEffect(() => {
		if (loading || error) {
			return;
		}
		if (isApplyingHistoryRef.current) {
			return;
		}
		if (hasActivePointerInteraction()) {
			return;
		}

		// ── Cheap hash gate ────────────────────────────────────────────
		// Skip the deep stringify when slide / element counts and ids
		// match the previous snapshot. This catches the very common case
		// where the effect re-runs but no real state shape changed.
		//
		// Both nonces are part of the hash because the counts alone cannot see
		// a content-only edit, and a content-only edit is still an undo step:
		//   - `pointerCommitNonce` covers a committed pointer interaction
		//     (move / resize / adjust / on-canvas chart edit).
		//   - `editCommitNonce` covers every other local commit, via the
		//     `markDirty()` that each edit choke point already calls: inspector
		//     fields, ribbon formatting, inline-text commits, table and theme
		//     edits. Without it none of those armed Undo.
		// Opening the gate only costs a stringify; the serialized comparison
		// below still rejects a commit that changed nothing, so a handler that
		// calls `markDirty()` without touching the deck pushes no entry.
		const cheapHash = `${pointerCommitNonce}|${editCommitNonce}|${slides.length}|${activeSlideIndex}|${canvasSize.width}x${canvasSize.height}|${slides
			.map((s) => `${s.id}:${s.elements.length}`)
			.join('/')}`;
		if (cheapHash === lastCheapHashRef.current) {
			return;
		}

		const snapshot = buildHistorySnapshot();
		// Document only: see `serializeDocument`. A slide selection reaches here
		// (the cheap hash above deliberately still lets it through, so the gate
		// cannot swallow a same-tick edit) and stops on this comparison instead of
		// being reported as a mutation.
		const serialized = serializeDocument(snapshot);
		if (serialized === lastHistorySerializedRef.current) {
			// Nothing about the deck moved, only the view. Keep the stored
			// snapshot's index current so a later undo returns to the slide the
			// user was actually editing, then stop: no dirty flag, no undo entry.
			const previous = lastHistorySnapshotRef.current;
			if (previous && previous.activeSlideIndex !== snapshot.activeSlideIndex) {
				lastHistorySnapshotRef.current = {
					...previous,
					activeSlideIndex: snapshot.activeSlideIndex,
				};
			}
			lastCheapHashRef.current = cheapHash;
			return;
		}

		const previousSnapshot = lastHistorySnapshotRef.current;
		if (!previousSnapshot) {
			lastHistorySnapshotRef.current = cloneHistorySnapshot(snapshot);
			lastHistorySerializedRef.current = serialized;
			lastCheapHashRef.current = cheapHash;
			updateHistoryAvailability();
			return;
		}

		// Reaching here means the deck genuinely differs from the last snapshot,
		// which is the strongest "this document is dirty" signal there is: it is
		// true even for an edit path that forgot to call `markDirty()`. The very
		// first snapshot after a load takes the `!previousSnapshot` branch above
		// and so never reports dirty.
		onDirtyRef.current?.();
		historyPastRef.current.push(cloneHistorySnapshot(previousSnapshot));
		while (historyPastRef.current.length > Math.max(1, maxHistoryEntries)) {
			historyPastRef.current.shift();
		}
		historyFutureRef.current = [];
		lastHistorySnapshotRef.current = cloneHistorySnapshot(snapshot);
		lastHistorySerializedRef.current = serialized;
		lastCheapHashRef.current = cheapHash;
		updateHistoryAvailability();
	}, [
		activeSlideIndex,
		buildHistorySnapshot,
		canvasSize.height,
		canvasSize.width,
		editCommitNonce,
		error,
		hasActivePointerInteraction,
		loading,
		maxHistoryEntries,
		pointerCommitNonce,
		slides,
		updateHistoryAvailability,
	]);

	// -- Public API ---------------------------------------------------------

	return {
		canUndo,
		canRedo,
		undoLabel,
		redoLabel,
		handleUndo,
		handleRedo,
		resetHistory,
		markDirty,
		buildHistorySnapshot,
	};
}
