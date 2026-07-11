import type { PptxElement } from 'pptx-viewer-core';
import { MIN_ELEMENT_SIZE } from 'pptx-viewer-core';
import { bringForward, bringToFront, sendBackward, sendToBack } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import {
	adjustFontSize,
	patchShapeStyle,
	setFontSize,
	setHighlightColor,
	setTextColor,
	toggleTextProp,
} from './editor-format-mutations';
import type { InsertKind } from './editor-insert';
import { buildInsertElement, pickImageElement } from './editor-insert';
import { appendElementOnSlide, reorderElementOnSlide, updateElement } from './editor-mutations';
import type { EditorOps } from './editor-operations';

/** A geometry patch from the inspector (all fields optional). */
export interface GeometryPatch {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	rotation?: number;
}

/**
 * The formatting / insert / arrange actions exposed to the editing chrome
 * (format toolbar, inspector, insert menu). Every mutating action is
 * history-integrated (push -> mutate -> commit) via the shared {@link EditorOps}.
 */
export interface EditActions {
	toggleBold(): void;
	toggleItalic(): void;
	toggleUnderline(): void;
	changeFontSize(delta: number): void;
	setFontSize(size: number): void;
	setTextColor(color: string): void;
	setHighlightColor(color: string): void;
	setShapeFill(color: string): void;
	setShapeStroke(color: string): void;
	setShapeStrokeWidth(width: number): void;
	/** Commit an inspector geometry edit (X/Y/W/H/rotation). */
	setGeometry(patch: GeometryPatch): void;
	insert(kind: InsertKind): void;
	insertImage(): Promise<void>;
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
}

export interface EditActionsDeps {
	doc: Document;
	store: Store<ViewerState>;
	ops: EditorOps;
}

/**
 * Build the {@link EditActions} bound to the viewer store + history ops.
 * Separated from {@link EditorOps} so `editor-operations.ts` stays focused on
 * the core selection/gesture/history primitives it already owns.
 */
export function createEditActions(deps: EditActionsDeps): EditActions {
	const { doc, store, ops } = deps;

	/** Apply a formatting patch to the selected element, history-integrated. */
	const applyToSelected = (build: (el: PptxElement) => Partial<PptxElement>): void => {
		const state = store.get();
		const id = state.selectedElementId;
		const el = ops.selectedElement(state);
		if (!state.editable || !id || !el) {
			return;
		}
		const patch = build(el);
		if (Object.keys(patch).length === 0) {
			return;
		}
		ops.pushHistory();
		store.set({ slides: updateElement(state.slides, state.currentSlide, id, patch) });
		ops.commitChange();
	};

	/** Reorder the selected element via a shared z-order transform. */
	const reorder = (transform: (els: readonly PptxElement[], id: string) => PptxElement[]): void => {
		const state = store.get();
		const id = state.selectedElementId;
		const elements = state.slides[state.currentSlide]?.elements;
		if (!state.editable || !id || !elements) {
			return;
		}
		// The shared transforms return the same array reference when it is a
		// no-op (already front/back); skip the history entry in that case.
		if (transform(elements, id) === elements) {
			return;
		}
		ops.pushHistory();
		store.set({
			slides: reorderElementOnSlide(state.slides, state.currentSlide, (els) => transform(els, id)),
		});
		ops.commitChange();
	};

	/** Append a freshly-built element to the current slide, selected. */
	const insertElement = (element: PptxElement | null): void => {
		if (!element) {
			return;
		}
		const state = store.get();
		if (!state.editable || !state.slides[state.currentSlide]) {
			return;
		}
		ops.pushHistory();
		store.set({
			slides: appendElementOnSlide(state.slides, state.currentSlide, element),
			selectedElementId: element.id,
		});
		ops.commitChange();
	};

	return {
		toggleBold: () => applyToSelected((el) => toggleTextProp(el, 'bold')),
		toggleItalic: () => applyToSelected((el) => toggleTextProp(el, 'italic')),
		toggleUnderline: () => applyToSelected((el) => toggleTextProp(el, 'underline')),
		changeFontSize: (delta) => applyToSelected((el) => adjustFontSize(el, delta)),
		setFontSize: (size) => applyToSelected((el) => setFontSize(el, size)),
		setTextColor: (color) => applyToSelected((el) => setTextColor(el, color)),
		setHighlightColor: (color) => applyToSelected((el) => setHighlightColor(el, color)),
		setShapeFill: (color) => applyToSelected((el) => patchShapeStyle(el, { fillColor: color })),
		setShapeStroke: (color) => applyToSelected((el) => patchShapeStyle(el, { strokeColor: color })),
		setShapeStrokeWidth: (width) =>
			applyToSelected((el) => patchShapeStyle(el, { strokeWidth: Math.max(0, width) })),

		setGeometry(patch) {
			applyToSelected(() => {
				const next: Partial<PptxElement> = {};
				if (patch.x !== undefined && Number.isFinite(patch.x)) {
					next.x = Math.round(patch.x);
				}
				if (patch.y !== undefined && Number.isFinite(patch.y)) {
					next.y = Math.round(patch.y);
				}
				if (patch.width !== undefined && Number.isFinite(patch.width)) {
					next.width = Math.max(MIN_ELEMENT_SIZE, Math.round(patch.width));
				}
				if (patch.height !== undefined && Number.isFinite(patch.height)) {
					next.height = Math.max(MIN_ELEMENT_SIZE, Math.round(patch.height));
				}
				if (patch.rotation !== undefined && Number.isFinite(patch.rotation)) {
					next.rotation = patch.rotation;
				}
				return next;
			});
		},

		insert(kind) {
			const state = store.get();
			if (!state.slides[state.currentSlide]) {
				return;
			}
			insertElement(buildInsertElement(kind, state.canvasSize));
		},
		async insertImage() {
			const state = store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return;
			}
			insertElement(await pickImageElement(doc, state.canvasSize));
		},

		bringForward: () => reorder(bringForward),
		sendBackward: () => reorder(sendBackward),
		bringToFront: () => reorder(bringToFront),
		sendToBack: () => reorder(sendToBack),
	};
}
