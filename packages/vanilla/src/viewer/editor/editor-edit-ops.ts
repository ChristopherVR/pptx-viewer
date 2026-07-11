import type { PptxChartType, PptxElement, SmartArtLayout } from 'pptx-viewer-core';
import { MIN_ELEMENT_SIZE } from 'pptx-viewer-core';
import type { ShapePresetType } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { AnimationActions } from './editor-animation-actions';
import { createAnimationActions } from './editor-animation-actions';
import { createApplyToSelected } from './editor-apply-to-selected';
import type { ArrangeActions } from './editor-arrange-actions';
import { createArrangeActions } from './editor-arrange-actions';
import type { SlideBackgroundActions } from './editor-background-actions';
import { createSlideBackgroundActions } from './editor-background-actions';
import type { ClipboardActions } from './editor-clipboard-actions';
import { createClipboardActions } from './editor-clipboard-actions';
import { patchShapeStyle } from './editor-format-mutations';
import type { InsertKind } from './editor-insert';
import { buildInsertElement, pickImageElement } from './editor-insert';
import { pickMediaElement } from './editor-insert-media';
import {
	buildActionButtonInsertElement,
	buildChartInsertElement,
	buildEquationInsertElement,
	buildFieldInsertElement,
	buildSmartArtInsertElement,
	resolveFieldDisplayText,
} from './editor-insert-structured';
import { appendElementOnSlide } from './editor-mutations';
import type { EditorOps } from './editor-operations';
import type { SlideActions } from './editor-slide-actions';
import { createSlideActions } from './editor-slide-actions';
import type { TextActions } from './editor-text-actions';
import { createTextActions } from './editor-text-actions';
import type { TransitionActions } from './editor-transition-actions';
import { createTransitionActions } from './editor-transition-actions';

/** A geometry patch from the inspector (all fields optional). */
export interface GeometryPatch {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	rotation?: number;
}

/**
 * The full set of formatting / insert / arrange / clipboard / slide actions
 * exposed to the editing chrome (ribbon, inspector). Composed from the
 * focused per-concern action files (`editor-text-actions.ts`,
 * `editor-arrange-actions.ts`, `editor-clipboard-actions.ts`,
 * `editor-slide-actions.ts`) plus the shape/geometry/insert actions owned
 * directly here. Every mutating action is history-integrated (push -> mutate
 * -> commit) via the shared {@link EditorOps}.
 */
export interface EditActions
	extends
		TextActions,
		ArrangeActions,
		ClipboardActions,
		SlideActions,
		SlideBackgroundActions,
		TransitionActions,
		AnimationActions {
	setShapeFill(color: string): void;
	setShapeStroke(color: string): void;
	setShapeStrokeWidth(width: number): void;
	/** Commit an inspector geometry edit (X/Y/W/H/rotation). */
	setGeometry(patch: GeometryPatch): void;
	insert(kind: InsertKind, shapeType?: ShapePresetType): void;
	insertImage(): Promise<void>;
	insertMedia(): Promise<void>;
	insertChart(chartType: PptxChartType): void;
	insertSmartArt(layout: SmartArtLayout, defaultItems: string[]): void;
	insertEquation(omml: Record<string, unknown>): void;
	insertActionButton(shapeType: string): void;
	insertField(fieldType: string, value?: string): void;
	duplicateSelected(): void;
	deleteSelected(): void;
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
	const applyToSelected = createApplyToSelected(store, ops);

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
		...createTextActions(applyToSelected),
		...createArrangeActions({ store, ops, applyToSelected }),
		...createClipboardActions({ store, ops }),
		...createSlideActions({ store, ops }),
		...createSlideBackgroundActions({ store, ops }),
		...createTransitionActions({ store, ops }),
		...createAnimationActions({ store, ops }),

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

		insert(kind, shapeType) {
			const state = store.get();
			if (!state.slides[state.currentSlide]) {
				return;
			}
			insertElement(buildInsertElement(kind, state.canvasSize, shapeType));
		},
		async insertImage() {
			const state = store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return;
			}
			insertElement(await pickImageElement(doc, state.canvasSize));
		},
		async insertMedia() {
			const state = store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return;
			}
			insertElement(await pickMediaElement(doc, state.canvasSize));
		},

		insertChart(chartType) {
			const state = store.get();
			if (!state.slides[state.currentSlide]) {
				return;
			}
			insertElement(buildChartInsertElement(chartType, state.canvasSize));
		},
		insertSmartArt(layout, defaultItems) {
			const state = store.get();
			if (!state.slides[state.currentSlide]) {
				return;
			}
			insertElement(buildSmartArtInsertElement(layout, defaultItems, state.canvasSize));
		},
		insertEquation(omml) {
			const state = store.get();
			if (!state.slides[state.currentSlide]) {
				return;
			}
			insertElement(buildEquationInsertElement(omml, state.canvasSize));
		},
		insertActionButton(shapeType) {
			const state = store.get();
			if (!state.slides[state.currentSlide]) {
				return;
			}
			insertElement(buildActionButtonInsertElement(shapeType, state.canvasSize));
		},
		insertField(fieldType, value) {
			const state = store.get();
			if (!state.slides[state.currentSlide]) {
				return;
			}
			const displayText =
				value ?? resolveFieldDisplayText(fieldType, { slideNumber: state.currentSlide + 1 });
			insertElement(buildFieldInsertElement(fieldType, displayText, state.canvasSize));
		},

		duplicateSelected: () => void ops.duplicateSelected(),
		deleteSelected: () => ops.deleteSelected(),
	};
}
