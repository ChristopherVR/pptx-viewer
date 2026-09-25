/**
 * usePictureCropMode: PowerPoint's on-canvas picture crop mode for React.
 *
 * Every decision (who may crop, what a drag does, what Enter / Escape mean,
 * whether a commit changed anything) comes from `pptx-viewer-shared`'s
 * `picture-crop` module; this hook only wires it to React state:
 *
 * - Handle and pan drags update the picture LIVE through `updateElementById`.
 *   The open session is in the history hook's pointer-interaction gate (see
 *   `useCropSessionState`), so none of those updates becomes an undo entry.
 * - Commit (Enter, a pointer-down outside the overlay, a selection or slide
 *   change, pressing Crop again) closes the session; the history hook then
 *   records the whole session as ONE step against the pre-crop snapshot.
 * - Cancel (Escape) writes the snapshot back before closing, so the deck is
 *   unchanged and no undo step is left. The key is swallowed so the viewer's
 *   own Escape (clear selection) does not also run.
 *
 * @module usePictureCropMode
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { CropElementUpdate, NaturalImageSize } from 'pptx-viewer-shared';
import {
	canCropElement,
	cancelCropUpdate,
	cropFill,
	cropFit,
	cropModeKeyAction,
	cropSessionChanged,
	cropToAspectRatio,
	startCropSession,
} from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef } from 'react';

import type { CropSessionState } from './useCropSessionState';

export interface UsePictureCropModeInput extends CropSessionState {
	/** Editable deck in an editing view. */
	editable: boolean;
	selectedElement: PptxElement | null;
	effectiveSelectedIds: string[];
	elementLookup: Map<string, PptxElement>;
	activeSlideIndex: number;
	updateElementById: (elementId: string, updates: Partial<PptxElement>) => void;
	markDirty: () => void;
}

export interface PictureCropController {
	/** The picture being cropped (live), or null outside crop mode. */
	element: PptxElement | null;
	/** Whether the Crop button / menu may act on the current selection. */
	canCrop: boolean;
	/** Crop button: enter crop mode, or commit it when already open. */
	toggle: () => void;
	/** Context-menu Crop: enter crop mode on the selected picture. */
	enter: () => void;
	commit: () => void;
	cancel: () => void;
	/** Apply a live drag update to the picture being cropped. */
	liveUpdate: (update: CropElementUpdate) => void;
	/** Crop to Aspect Ratio, Fill and Fit: each one undoable update. */
	cropToAspect: (ratioWidth: number, ratioHeight: number) => void;
	fill: () => void;
	fit: () => void;
}

/** Controls that must not count as "outside" (they end crop mode themselves). */
const CROP_KEEP_SELECTOR = [
	'[data-pptx-crop-overlay]',
	'[data-pptx-ribbon-control="crop"]',
	'[data-pptx-ribbon-control="crop-menu"]',
	'[data-pptx-crop-aspect]',
	'[data-pptx-crop-action]',
].join(',');

/** The rendered bitmap's natural size, when the picture is on screen. */
function naturalSizeOf(elementId: string): NaturalImageSize | undefined {
	if (typeof document === 'undefined' || typeof CSS === 'undefined') {
		return undefined;
	}
	const img = document.querySelector<HTMLImageElement>(
		`[data-element-id="${CSS.escape(elementId)}"][data-pptx-element="true"] img`,
	);
	return img && img.naturalWidth > 0 && img.naturalHeight > 0
		? { width: img.naturalWidth, height: img.naturalHeight }
		: undefined;
}

const INSET_KEYS = ['cropLeft', 'cropTop', 'cropRight', 'cropBottom'] as const;

/**
 * The cancel update, with insets the picture never had written back as
 * ABSENT rather than as 0: the shared snapshot reads a missing inset as 0, and
 * an explicit `cropLeft: 0` on a picture that had none would read to the
 * history hook as an edit, leaving an undo step behind a cancelled crop.
 */
function restoreUpdate(
	update: CropElementUpdate,
	original: PptxElement | null,
): Partial<PptxElement> {
	const restored: Record<string, number | undefined> = { ...update };
	for (const key of INSET_KEYS) {
		if (original && !(key in original)) {
			restored[key] = undefined;
		}
	}
	return restored as Partial<PptxElement>;
}

function isEditableTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
	);
}

export function usePictureCropMode(input: UsePictureCropModeInput): PictureCropController {
	const { cropSession, cropSessionRef, setCropSession, editable, selectedElement } = input;
	const { elementLookup, updateElementById, markDirty, activeSlideIndex } = input;
	const single = input.effectiveSelectedIds.length === 1 ? selectedElement : null;
	const canCrop = editable && canCropElement(single);
	const element = cropSession ? (elementLookup.get(cropSession.elementId) ?? null) : null;
	const lookupRef = useRef(elementLookup);
	lookupRef.current = elementLookup;
	const sessionSlideRef = useRef(activeSlideIndex);
	const originalRef = useRef<PptxElement | null>(null);

	const commit = useCallback(() => {
		const session = cropSessionRef.current;
		if (!session) {
			return;
		}
		const current = lookupRef.current.get(session.elementId);
		setCropSession(null);
		// Re-opens the history gate: the tracker compares against the snapshot
		// taken before crop mode opened and records ONE step (none if unchanged).
		if (current && cropSessionChanged(session, current)) {
			markDirty();
		}
	}, [cropSessionRef, markDirty, setCropSession]);

	const cancel = useCallback(() => {
		const session = cropSessionRef.current;
		if (!session) {
			return;
		}
		if (lookupRef.current.has(session.elementId)) {
			updateElementById(
				session.elementId,
				restoreUpdate(cancelCropUpdate(session), originalRef.current),
			);
		}
		setCropSession(null);
	}, [cropSessionRef, setCropSession, updateElementById]);

	const enter = useCallback(() => {
		if (cropSessionRef.current || !canCrop) {
			return;
		}
		sessionSlideRef.current = activeSlideIndex;
		originalRef.current = single;
		setCropSession(startCropSession(single));
	}, [activeSlideIndex, canCrop, cropSessionRef, setCropSession, single]);

	const toggle = useCallback(() => {
		if (cropSessionRef.current) {
			commit();
		} else {
			enter();
		}
	}, [commit, cropSessionRef, enter]);

	const liveUpdate = useCallback(
		(update: CropElementUpdate) => {
			const session = cropSessionRef.current;
			if (session) {
				updateElementById(session.elementId, update);
			}
		},
		[cropSessionRef, updateElementById],
	);

	const target = element ?? single;
	const applyOnce = (build: (el: PptxElement) => CropElementUpdate) => {
		if (target && editable && canCropElement(target)) {
			updateElementById(target.id, build(target));
		}
	};

	// A selection change, slide change or the picture disappearing commits.
	const selectionKey = input.effectiveSelectedIds.join('|');
	useEffect(() => {
		const session = cropSessionRef.current;
		if (!session) {
			return;
		}
		if (
			selectionKey !== session.elementId ||
			activeSlideIndex !== sessionSlideRef.current ||
			!editable ||
			!lookupRef.current.has(session.elementId)
		) {
			commit();
		}
	}, [activeSlideIndex, commit, cropSessionRef, editable, selectionKey]);

	// Enter / Escape, and a pointer-down outside the overlay, while open. Both
	// listen in the CAPTURE phase on window so they run before the viewer's own
	// shortcuts and canvas handlers.
	const active = cropSession !== null;
	useEffect(() => {
		if (!active) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			const action = cropModeKeyAction(event.key);
			if (!action || isEditableTarget(event.target)) {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			if (action === 'commit') {
				commit();
			} else {
				cancel();
			}
		};
		const onPointerDown = (event: PointerEvent) => {
			const node = event.target instanceof Element ? event.target : null;
			if (!node?.closest(CROP_KEEP_SELECTOR)) {
				commit();
			}
		};
		window.addEventListener('keydown', onKeyDown, true);
		window.addEventListener('pointerdown', onPointerDown, true);
		return () => {
			window.removeEventListener('keydown', onKeyDown, true);
			window.removeEventListener('pointerdown', onPointerDown, true);
		};
	}, [active, cancel, commit]);

	return {
		element,
		canCrop: canCrop || element !== null,
		toggle,
		enter,
		commit,
		cancel,
		liveUpdate,
		cropToAspect: (w, h) => applyOnce((el) => cropToAspectRatio(el, w, h)),
		fill: () => applyOnce((el) => cropFill(el, naturalSizeOf(el.id))),
		fit: () => applyOnce((el) => cropFit(el, naturalSizeOf(el.id))),
	};
}
