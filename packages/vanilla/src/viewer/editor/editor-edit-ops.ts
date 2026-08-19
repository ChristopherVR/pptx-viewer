/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (many independent short-lived `const`s per action); merging them isn't a
   style choice here. */
import type { PptxElement, PptxHandler, SmartArtLayout } from 'pptx-viewer-core';
import { MIN_ELEMENT_SIZE } from 'pptx-viewer-core';
import {
	createGuide,
	DEFAULT_INSERT_CHART_KIND,
	isElementIdInteractive,
	shapeFillChange,
	shapeOutlineChange,
} from 'pptx-viewer-shared';
import type { Guide, InsertChartKind, ShapePresetType } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements } from './editor-active-elements';
import type { AnimationActions } from './editor-animation-actions';
import { createAnimationActions } from './editor-animation-actions';
import { createApplyToSelected } from './editor-apply-to-selected';
import type { ArrangeActions } from './editor-arrange-actions';
import { createArrangeActions } from './editor-arrange-actions';
import type { SlideBackgroundActions } from './editor-background-actions';
import { createSlideBackgroundActions } from './editor-background-actions';
import type { ClipboardActions } from './editor-clipboard-actions';
import { createClipboardActions } from './editor-clipboard-actions';
import type { CommentActions } from './editor-comment-actions';
import { createCommentActions } from './editor-comment-actions';
import type { DeckActions } from './editor-deck-actions';
import { createDeckActions } from './editor-deck-actions';
import { patchShapeStyle } from './editor-format-mutations';
import type { InkActions } from './editor-ink-actions';
import { createInkActions } from './editor-ink-actions';
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
import type { InspectorActions } from './editor-inspector-actions';
import { createInspectorActions } from './editor-inspector-actions';
import { appendElementOnSlide } from './editor-mutations';
import type { EditorOps } from './editor-operations';
import type { SectionActions } from './editor-section-actions';
import { createSectionActions } from './editor-section-actions';
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
		AnimationActions,
		InspectorActions,
		InkActions,
		DeckActions {
	/** Slide section CRUD and ordering actions. */
	sections: SectionActions;
	// Slide-level review comments, shared by desktop and mobile chrome.
	comments: CommentActions;
	toggleFormatPainter(): void;
	setShapeFill(color: string): void;
	setShapeStroke(color: string): void;
	setShapeStrokeWidth(width: number): void;
	setShapeStyle(patch: Partial<import('pptx-viewer-core').ShapeStyle>): void;
	setShapeType(shapeType: string): void;
	/** Commit an inspector geometry edit (X/Y/W/H/rotation). */
	setGeometry(patch: GeometryPatch): void;
	insert(kind: InsertKind, shapeType?: ShapePresetType): void;
	insertImage(): Promise<void>;
	insertMedia(): Promise<void>;
	/** Insert a default chart for the given dropdown entry (defaults to Column). */
	insertChart(chartKind?: InsertChartKind): void;
	insertSmartArt(layout: SmartArtLayout, defaultItems: string[]): void;
	insertEquation(omml: Record<string, unknown>): void;
	updateEquation(id: string, omml: Record<string, unknown>): void;
	insertActionButton(shapeType: string): void;
	insertField(fieldType: string, value?: string): void;
	duplicateSelected(): void;
	deleteSelected(): void;
	/** Select every interactive element on the active slide (Home > Select > Select All). */
	selectAll(): void;
	toggleViewOption(
		option: 'showGrid' | 'showRulers' | 'showGuides' | 'snapToGrid' | 'snapToShape',
	): void;
	/**
	 * Add an alignment guide. Centred by default (View > H/V Guide); `position`
	 * is supplied when the guide was dragged off a ruler strip, where the shared
	 * `rulerDragToGuidePosition` already resolved the drop point.
	 */
	addGuide(axis: Guide['axis'], position?: number): void;
	activateEyedropper(): void;
	toggleSpellCheck(): void;
	replaceSelectedImage(): Promise<void>;
	resetSelectedImage(): void;
}

export interface EditActionsDeps {
	doc: Document;
	store: Store<ViewerState>;
	ops: EditorOps;
	/** Live handler getter (deck-level theme apply); null before a load. */
	getHandler(): PptxHandler | null;
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
			selectedElementIds: [element.id],
		});
		ops.commitChange();
	};

	return {
		...createTextActions(applyToSelected),
		...createArrangeActions({ store, ops, applyToSelected }),
		...createClipboardActions({ store, ops }),
		...createSlideActions({ store, ops, getHandler: deps.getHandler }),
		...createSlideBackgroundActions({ store, ops }),
		...createTransitionActions({ store, ops }),
		...createAnimationActions({ store, ops }),
		...createInspectorActions(applyToSelected),
		...createInkActions({ store, ops }),
		...createDeckActions({ store, ops, getHandler: deps.getHandler }),
		sections: createSectionActions(store, ops),
		comments: createCommentActions({ store, ops }),
		toggleFormatPainter() {
			const state = store.get();
			store.set({
				formatPainterSourceId: state.formatPainterSourceId ? null : state.selectedElementId,
			});
		},

		// Picking a flat colour swatch implies solid fill, so it also clears any
		// active gradient/pattern mode (mirrors the React/Vue "Fill & Stroke" panel).
		// The patch itself comes from the shared `shapeFillChange`/`shapeOutlineChange`
		// decision functions so the two keys can't drift from the other bindings.
		setShapeFill: (color) => applyToSelected((el) => patchShapeStyle(el, shapeFillChange(color))),
		setShapeStroke: (color) =>
			applyToSelected((el) => patchShapeStyle(el, shapeOutlineChange(color))),
		setShapeStrokeWidth: (width) =>
			applyToSelected((el) => patchShapeStyle(el, { strokeWidth: Math.max(0, width) })),
		setShapeStyle: (patch) => applyToSelected((el) => patchShapeStyle(el, patch)),
		setShapeType: (shapeType) =>
			applyToSelected((el) => (el.type === 'shape' ? { shapeType } : {})),

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

		insertChart(chartKind = DEFAULT_INSERT_CHART_KIND) {
			const state = store.get();
			if (!state.slides[state.currentSlide]) {
				return;
			}
			insertElement(buildChartInsertElement(chartKind, state.canvasSize));
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
		updateEquation: (id, omml) => ops.updateEquation(id, omml),
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
		selectAll() {
			const state = store.get();
			// Template-owned elements are only selectable while edit-template mode
			// is on, so the same interactivity rule the pointer uses applies here.
			const ids = getActiveElements(state)
				.filter((element) => isElementIdInteractive(element.id, state.editTemplateMode))
				.map((element) => element.id);
			if (ids.length > 0) {
				ops.select(ids.at(-1) ?? null, ids);
			}
		},
		toggleViewOption(option) {
			const state = store.get();
			store.set({ [option]: !state[option] });
			for (const root of doc.querySelectorAll('.pptxv')) {
				root.classList.toggle(`pptxv-${option}`, !state[option]);
			}
		},
		addGuide(axis, position) {
			const state = store.get();
			const guide = createGuide(`guide-${Date.now()}`, axis, state.canvasSize);
			store.set({
				guides: [...state.guides, position === undefined ? guide : { ...guide, position }],
			});
		},
		activateEyedropper: () => store.set({ eyedropperActive: true }),
		toggleSpellCheck: () => store.set({ spellCheckEnabled: !store.get().spellCheckEnabled }),
		async replaceSelectedImage() {
			const replacement = await pickImageElement(doc, store.get().canvasSize);
			if (!replacement || replacement.type !== 'image') {
				return;
			}
			applyToSelected((el) =>
				el.type === 'image'
					? {
							imageData: replacement.imageData,
							imagePath: replacement.imagePath,
							svgData: replacement.svgData,
							svgPath: replacement.svgPath,
						}
					: {},
			);
		},
		resetSelectedImage: () =>
			applyToSelected((el) =>
				el.type === 'image'
					? {
							imageEffects: undefined,
							cropLeft: undefined,
							cropTop: undefined,
							cropRight: undefined,
							cropBottom: undefined,
						}
					: {},
			),
	};
}
