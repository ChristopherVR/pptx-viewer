/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (many independent short-lived `const`s per action, each computed from the
   previous statement's result); merging them isn't a style choice here. */
import { cloneElement, cloneSlide } from 'pptx-viewer-core';
import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import {
	buildSlideTemplateSlide,
	createBlankSlide,
	makeSlideId,
	partitionTemplateElements,
	resetSlideLayoutPath,
	templateSchemeFromTheme,
} from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

/**
 * New/duplicate/delete-slide actions for the ribbon's Home > Slides group,
 * backed by the shared `slide-operations.ts` factory. Every mutation is
 * history-integrated (matches the element-level actions in `editor-edit-ops`)
 * and renumbers `slideNumber` across the whole deck so it always matches the
 * array index (mirrors the Vue `useSlideOperations` contract).
 *
 * The layout-driven actions (`insertSlideFromLayout`, `applyLayout`,
 * `resetSlide`) mirror React's `SlidesGroup` (New Slide dropdown, Layout, and
 * Reset buttons): they ask the live handler to walk the chosen layout XML and
 * populate placeholders/background, exactly like React's
 * `handleInsertSlideFromLayout`.
 */
export interface SlideActions {
	addSlide(): void;
	duplicateSlide(): void;
	deleteSlide(): void;
	/** Insert a new slide below the current one, keyed to the given layout. */
	insertSlideFromLayout(layoutPath: string, layoutName?: string): void;
	/** Insert a pre-designed starter slide from the shared template catalog. */
	insertSlideFromTemplate(templateId: SlideTemplateId): void;
	/** Resolved deck theme scheme map for template builds and gallery previews. */
	getTemplateScheme(): Record<string, string>;
	/** Re-key the current slide onto another layout (React's Layout button). */
	applyLayout(layoutPath: string): void;
	/** Reset the current slide to its own layout's defaults (React's Reset). */
	resetSlide(): void;
}

export interface SlideActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
	/** Live handler getter (layout XML resolution); null before a load. */
	getHandler(): PptxHandler | null;
}

/** Renumber `slideNumber` so it always matches the 0-based array index + 1. */
function renumber(slides: PptxSlide[]): PptxSlide[] {
	return slides.map((slide, index) => ({ ...slide, slideNumber: index + 1 }));
}

export function createSlideActions(deps: SlideActionsDeps): SlideActions {
	const { store, ops } = deps;

	/**
	 * Walk the layout XML for `index` and merge the handler's result back into
	 * the slide, but only while it still carries the id we started from (guards
	 * against a concurrent edit having moved/replaced it). History-integrated.
	 */
	function resolveLayout(index: number, layoutPath: string, expectedId: string): void {
		const handler = deps.getHandler();
		if (!handler) {
			return;
		}
		void handler.applyLayoutToSlide(index, layoutPath, [...store.get().slides]).then(
			(updated) => {
				const current = store.get();
				if (current.slides[index]?.id === expectedId) {
					ops.pushHistory();
					// Core returns the slide with the TARGET layout's inherited artwork
					// merged in, which this viewer holds in its own store; partitioning
					// the result again swaps that artwork over instead of leaving the
					// previous layout's decoration on screen.
					const partition = partitionTemplateElements([updated]);
					const slides = [...current.slides];
					slides[index] = partition.slides[0]!;
					store.set({
						slides,
						templateElementsBySlideId: {
							...current.templateElementsBySlideId,
							[updated.id]: partition.templateElementsBySlideId[updated.id] ?? [],
						},
					});
					ops.commitChange();
				}
				return undefined;
			},
			() => {
				// Layout couldn't be resolved; the slide keeps its layoutPath so the
				// renderer can still resolve placeholders.
				return undefined;
			},
		);
	}

	return {
		addSlide() {
			const state = store.get();
			if (!state.editable) {
				return;
			}
			ops.pushHistory();
			const insertAt = state.currentSlide + 1;
			const slide = createBlankSlide(insertAt + 1);
			const slides = renumber([
				...state.slides.slice(0, insertAt),
				slide,
				...state.slides.slice(insertAt),
			]);
			store.set({
				slides,
				currentSlide: insertAt,
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},

		duplicateSlide() {
			const state = store.get();
			const source = state.slides[state.currentSlide];
			if (!state.editable || !source) {
				return;
			}
			ops.pushHistory();
			const insertAt = state.currentSlide + 1;
			const copy = { ...cloneSlide(source), id: makeSlideId() };
			const sourceTemplate = state.templateElementsBySlideId[source.id] ?? [];
			const slides = renumber([
				...state.slides.slice(0, insertAt),
				copy,
				...state.slides.slice(insertAt),
			]);
			store.set({
				slides,
				templateElementsBySlideId: {
					...state.templateElementsBySlideId,
					[copy.id]: sourceTemplate.map(cloneElement),
				},
				currentSlide: insertAt,
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},

		deleteSlide() {
			const state = store.get();
			if (!state.editable || state.slides.length <= 1) {
				return;
			}
			ops.pushHistory();
			const slides = renumber(state.slides.filter((_, i) => i !== state.currentSlide));
			const currentSlide = Math.min(state.currentSlide, slides.length - 1);
			const templateElementsBySlideId = { ...state.templateElementsBySlideId };
			delete templateElementsBySlideId[state.slides[state.currentSlide].id];
			store.set({
				slides,
				templateElementsBySlideId,
				currentSlide,
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},

		insertSlideFromLayout(layoutPath, layoutName) {
			const state = store.get();
			if (!state.editable || !layoutPath) {
				return;
			}
			ops.pushHistory();
			const insertAt = state.currentSlide + 1;
			const draft: PptxSlide = {
				...createBlankSlide(insertAt + 1),
				layoutPath,
				...(layoutName ? { layoutName } : {}),
			};
			const slides = renumber([
				...state.slides.slice(0, insertAt),
				draft,
				...state.slides.slice(insertAt),
			]);
			store.set({
				slides,
				currentSlide: insertAt,
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
			resolveLayout(insertAt, layoutPath, draft.id);
		},

		insertSlideFromTemplate(templateId) {
			const state = store.get();
			if (!state.editable) {
				return;
			}
			ops.pushHistory();
			const insertAt = state.currentSlide + 1;
			const slide = buildSlideTemplateSlide(templateId, makeSlideId(), insertAt + 1, {
				slideWidth: state.canvasSize.width,
				slideHeight: state.canvasSize.height,
				scheme: templateSchemeFromTheme(state.colorScheme),
			});
			const slides = renumber([
				...state.slides.slice(0, insertAt),
				slide,
				...state.slides.slice(insertAt),
			]);
			store.set({
				slides,
				currentSlide: insertAt,
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},

		getTemplateScheme() {
			return templateSchemeFromTheme(store.get().colorScheme);
		},

		applyLayout(layoutPath) {
			const state = store.get();
			const target = state.slides[state.currentSlide];
			if (!state.editable || !target || !layoutPath) {
				return;
			}
			resolveLayout(state.currentSlide, layoutPath, target.id);
		},

		resetSlide() {
			const state = store.get();
			const target = state.slides[state.currentSlide];
			// The layout-path decision itself comes from the shared
			// `resetSlideLayoutPath` function (React/Vue/Angular parity); this
			// keeps the extra `editable` gate the ribbon button's own disabled
			// state already relies on.
			const path = resetSlideLayoutPath(target);
			if (!state.editable || !target || !path) {
				return;
			}
			resolveLayout(state.currentSlide, path, target.id);
		},
	};
}
