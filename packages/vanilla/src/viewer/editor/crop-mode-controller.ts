import type { PptxElement } from 'pptx-viewer-core';
import {
	beginCropDrag,
	CROP_HANDLE_ARIA_KEY,
	cropModeKeyAction,
	dragCropHandle,
	getImageSrc,
	panCropImage,
	toElementAxes,
} from 'pptx-viewer-shared';
import type { CropDragStart, CropElementUpdate, CropHandleId } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import type { CropOverlayView } from './crop-overlay-view';
import { createCropOverlayView } from './crop-overlay-view';
import { findActiveElement } from './editor-active-elements';
import type { CropActions } from './editor-crop-actions';

export interface CropModeControllerDeps {
	doc: Document;
	store: Store<ViewerState>;
	getTranslator(): Translator;
	/** Stage zoom, so a client-pixel delta converts back to slide pixels. */
	getScale(): number;
	/** The stage host; the scaled `.pptxv-stage` is resolved from it per sync. */
	getStageWrap(): HTMLElement | null;
	actions: CropActions;
}

export interface CropModeController {
	/** Start listening (keys, outside presses) inside the viewer `root`. */
	attach(root: HTMLElement): void;
	/** Re-project the overlay onto the current stage (after every render). */
	sync(): void;
	/** True while a crop handle or pan drag is in flight. */
	isDragging(): boolean;
	detach(): void;
	destroy(): void;
}

/** A press on the crop ribbon controls must not commit: they own the toggle. */
const CROP_CONTROLS_SELECTOR = '[data-pptx-crop-controls]';

function isTextInput(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}

/**
 * Owns on-canvas crop mode for the vanilla editor: the overlay's re-mount
 * lifecycle inside the scaled stage (rebuilt on every store change), the
 * handle/pan drags, and the commit/cancel triggers. What each gesture DOES is
 * the shared `picture-crop` module; the store/history half is
 * `editor-crop-actions.ts`.
 *
 * Commit triggers: Enter, a press outside the overlay, a selection change, a
 * slide change, the Crop button (handled by the action). Escape cancels, and
 * is consumed in the capture phase so the editor's own Escape (deselect) does
 * not also run on the same key press.
 */
export function createCropModeController(deps: CropModeControllerDeps): CropModeController {
	const { doc, store, actions } = deps;
	let view: CropOverlayView | null = null;
	let root: HTMLElement | null = null;
	let drag: { stop(): void } | null = null;

	const sessionElement = (state: ViewerState): PptxElement | undefined =>
		state.cropSession ? findActiveElement(state, state.cropSession.elementId) : undefined;

	const beginDrag = (
		event: PointerEvent,
		compute: (start: CropDragStart, dx: number, dy: number) => CropElementUpdate,
	): void => {
		const element = sessionElement(store.get());
		if (!element) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		drag?.stop();
		const start = beginCropDrag(element);
		const scale = deps.getScale() > 0 ? deps.getScale() : 1;
		const originX = event.clientX;
		const originY = event.clientY;
		store.set({ interactionActive: true });
		const onMove = (move: PointerEvent): void => {
			const local = toElementAxes(
				(move.clientX - originX) / scale,
				(move.clientY - originY) / scale,
				start.rotation,
			);
			actions.previewCrop(compute(start, local.dx, local.dy));
		};
		const stop = (): void => {
			doc.removeEventListener('pointermove', onMove);
			doc.removeEventListener('pointerup', stop);
			doc.removeEventListener('pointercancel', stop);
			drag = null;
			store.set({ interactionActive: false });
		};
		// Document-level, not pointer capture: every frame rebuilds the stage and
		// re-mounts this overlay, and removing a node drops its capture.
		doc.addEventListener('pointermove', onMove);
		doc.addEventListener('pointerup', stop);
		doc.addEventListener('pointercancel', stop);
		drag = { stop };
	};

	const ensureView = (): CropOverlayView => {
		view ??= createCropOverlayView(doc, deps.getTranslator()(CROP_HANDLE_ARIA_KEY), {
			onHandlePointerDown: (handle: CropHandleId, event) =>
				beginDrag(event, (start, dx, dy) => dragCropHandle(start, handle, dx, dy)),
			onPanPointerDown: (event) => beginDrag(event, panCropImage),
		});
		return view;
	};

	const onKeyDown = (event: KeyboardEvent): void => {
		if (!store.get().cropSession || isTextInput(event.target)) {
			return;
		}
		if (root && event.target instanceof Node && event.target !== doc.body) {
			if (!root.contains(event.target)) {
				return;
			}
		}
		const action = cropModeKeyAction(event.key);
		if (!action) {
			return;
		}
		event.preventDefault();
		event.stopImmediatePropagation();
		if (action === 'commit') {
			actions.commitCropMode();
		} else {
			actions.cancelCropMode();
		}
	};

	const onPointerDown = (event: PointerEvent): void => {
		if (!store.get().cropSession || drag) {
			return;
		}
		const target = event.target instanceof Element ? event.target : null;
		if (target && (view?.root.contains(target) || target.closest(CROP_CONTROLS_SELECTOR))) {
			return;
		}
		actions.commitCropMode();
	};

	const unsubscribe = store.subscribe((state, previous) => {
		const session = state.cropSession;
		if (!session) {
			return;
		}
		const stillSelected =
			state.selectedElementIds.length === 1 && state.selectedElementIds[0] === session.elementId;
		if (
			state.currentSlide !== previous.currentSlide ||
			!stillSelected ||
			!state.editable ||
			state.presenting
		) {
			actions.commitCropMode();
		}
	});

	const detach = (): void => {
		drag?.stop();
		view?.unmount();
		doc.removeEventListener('keydown', onKeyDown, true);
		doc.removeEventListener('pointerdown', onPointerDown);
		root = null;
	};

	return {
		attach(nextRoot) {
			detach();
			root = nextRoot;
			doc.addEventListener('keydown', onKeyDown, true);
			doc.addEventListener('pointerdown', onPointerDown);
		},
		sync() {
			const state = store.get();
			const element = state.editable && !state.presenting ? sessionElement(state) : undefined;
			if (!element) {
				view?.unmount();
				return;
			}
			const overlay = ensureView();
			overlay.update(element, deps.getScale(), getImageSrc(element, new Map(state.mediaDataUrls)));
			overlay.mount(deps.getStageWrap()?.querySelector<HTMLElement>('.pptxv-stage') ?? null);
		},
		isDragging: () => drag !== null,
		detach,
		destroy() {
			detach();
			unsubscribe();
			view = null;
		},
	};
}
