/**
 * {@link PptxAiBridge} implementation over the vanilla viewer controller.
 *
 * Reads come straight off the reactive store; navigation + selection reuse the
 * public viewer controls; and every write is funnelled through the editor's
 * history layer (`commitSlides` / `applyElementPatch`) so an AI edit is a single
 * undoable step, exactly like a manual one. This module has NO dependency on the
 * optional `ai` SDK, so the viewer can construct the bridge eagerly and only pay
 * for the SDK when the chat panel is actually opened.
 */

import type { PptxData, PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import type {
	PptxAiBridge,
	PptxAiDataUpdater,
	PptxAiDeckMeta,
	PptxAiElementUpdate,
	PptxAiFocusedTarget,
	PptxAiNotifyLevel,
	PptxAiSlidesUpdater,
} from 'pptx-viewer-shared/ai';
import { applyElementUpdate, deckDataFieldChanged } from 'pptx-viewer-shared/ai';

import type { EditorController } from '../editor';
import type { Store, ViewerState } from '../state';

export interface VanillaAiBridgeDeps {
	store: Store<ViewerState>;
	editor: EditorController;
	/** Navigate the viewer to a slide (viewer `goToSlide`). */
	goToSlide(index: number): void;
	/** Ensure editing is on so a write choke point is not silently dropped. */
	ensureEditable(): void;
	/** The loaded core handler, or null when nothing is loaded. */
	getHandler(): PptxHandler | null;
	/**
	 * Apply partial theme updates (colour/font scheme) to the deck and re-render.
	 * Theme scheme state lives outside the slides history snapshot, so this is a
	 * best-effort apply rather than a strictly undoable step.
	 */
	applyThemeUpdates(updates: Partial<PptxTheme>): void;
	/**
	 * The assistant's current focus (picks / pin / live selection), owned by the
	 * AI panel controller. When provided, it backs {@link PptxAiBridge.getFocusedTargets}
	 * so the context builder scopes the model to what the user is pointing at.
	 */
	getFocusedTargets?(): PptxAiFocusedTarget[];
	/** Optional host notification sink (status line / toast / console). */
	notify?(message: string, level?: PptxAiNotifyLevel): void;
}

/** Build the AI bridge that exposes the live vanilla viewer to the AI core. */
export function createVanillaAiBridge(deps: VanillaAiBridgeDeps): PptxAiBridge {
	const { store, editor } = deps;

	const applySlidesUpdate = (updater: PptxAiSlidesUpdater, _label: string): void => {
		const next = updater(structuredClone(store.get().slides));
		deps.ensureEditable();
		editor.commitSlides(next, store.get().currentSlide);
	};

	/**
	 * Reconstruct the presentation-level {@link PptxData} the `pptx-viewer-mcp`
	 * deck tools read/write. Vanilla tracks the full deck (slides, canvas size,
	 * theme, sections, document + presentation properties), so this seam covers
	 * every deck tool. Fields the store does not track are simply omitted, which
	 * degrades only the corresponding sub-tool.
	 */
	const readDeckData = (): PptxData => {
		const state = store.get();
		return {
			slides: state.slides,
			width: state.canvasSize.width,
			height: state.canvasSize.height,
			theme: state.colorScheme ? { colorScheme: state.colorScheme } : undefined,
			sections: state.sections,
			presentationProperties: state.presentationProperties,
			customProperties: state.customProperties,
			coreProperties: state.coreProperties,
			appProperties: state.appProperties,
			viewProperties: state.viewProperties,
			tableStyleMap: state.tableStyleMap,
			tableStylesDefaultId: state.tableStylesDefaultId,
			tags: state.tagCollections,
		} satisfies Partial<PptxData> as PptxData;
	};

	const differs = deckDataFieldChanged;

	return {
		getDeckMeta(): PptxAiDeckMeta {
			const state = store.get();
			return {
				slideCount: state.slides.length,
				activeSlideIndex: state.currentSlide,
				title: deckTitle(state.slides),
				width: state.canvasSize.width,
				height: state.canvasSize.height,
			};
		},
		getSlides: () => store.get().slides,
		getActiveSlideIndex: () => store.get().currentSlide,
		getTheme(): PptxTheme | undefined {
			const { colorScheme } = store.get();
			return colorScheme ? { colorScheme } : undefined;
		},
		getHandler: () => deps.getHandler() ?? undefined,

		goToSlide: (index) => deps.goToSlide(index),
		selectElements(slideIndex, elementIds) {
			deps.goToSlide(slideIndex);
			editor.selectElements(elementIds);
		},

		applySlidesUpdate,
		updateElement(slideIndex, elementId, updates: PptxAiElementUpdate) {
			applySlidesUpdate((slides) => {
				const el = slides[slideIndex]?.elements.find((e) => e.id === elementId);
				if (el) {
					applyElementUpdate(el, updates);
				}
				return slides;
			}, `Update ${elementId}`);
		},
		applyTheme: (updates) => deps.applyThemeUpdates(updates),

		getDeckData: () => readDeckData(),
		applyDeckData(updater: PptxAiDataUpdater, _label: string) {
			const before = readDeckData();
			const after = updater(structuredClone(before));
			deps.ensureEditable();
			// Fan out only the top-level deck fields that actually changed; each
			// routes through its own undoable editor op (theme is intentionally left
			// to applyTheme, so it is not applied here). Slides + canvas + sections +
			// presentation/document properties are all editor-tracked and undoable.
			if (differs(before.slides, after.slides)) {
				editor.commitSlides(after.slides, store.get().currentSlide);
			}
			if (before.width !== after.width || before.height !== after.height) {
				editor.getEditActions().updateCanvasSize({ width: after.width, height: after.height });
			}
			const nextSections = after.sections ?? before.sections ?? [];
			if (differs(before.sections, nextSections)) {
				editor.updateSections(nextSections);
			}
			const nextPresProps = after.presentationProperties ?? before.presentationProperties ?? {};
			if (differs(before.presentationProperties, nextPresProps)) {
				editor.updatePresentationProperties(nextPresProps);
			}
			// The editor commits core / app / custom document properties as one unit,
			// so touch the combined op when any of the three changed.
			const nextCore = after.coreProperties ?? before.coreProperties;
			const nextApp = after.appProperties ?? before.appProperties;
			const nextCustom = after.customProperties ?? before.customProperties ?? [];
			if (
				differs(before.coreProperties, nextCore) ||
				differs(before.appProperties, nextApp) ||
				differs(before.customProperties, nextCustom)
			) {
				editor.updateDocumentProperties(nextCore ?? {}, nextApp ?? {}, nextCustom);
			}
			if (differs(before.viewProperties, after.viewProperties)) {
				// Not undo-tracked, mirroring the manual View > Grid/Guides/Snap
				// toggle (view preferences live outside the undo history).
				store.set({ viewProperties: after.viewProperties });
			}
			if (differs(before.tableStyleMap, after.tableStyleMap)) {
				editor.getEditActions().updateTableStyleMap(after.tableStyleMap ?? {});
			}
			if (differs(before.tableStylesDefaultId, after.tableStylesDefaultId)) {
				// No manual UI sets this in the vanilla binding yet (a pre-existing
				// gap, not introduced here), so there is no dedicated editor action;
				// commit it the same way `viewProperties` does, outside undo history.
				store.set({ tableStylesDefaultId: after.tableStylesDefaultId });
			}
			const nextTags = after.tags ?? before.tags ?? [];
			if (differs(before.tags, nextTags)) {
				editor.getEditActions().updateTagCollections(nextTags);
			}
		},

		getFocusedTargets: deps.getFocusedTargets ? () => deps.getFocusedTargets?.() ?? [] : undefined,
		notify: deps.notify,
	};
}

/** First non-empty text run on the first slide, used as a friendly deck title. */
function deckTitle(slides: PptxSlide[]): string | undefined {
	for (const el of slides[0]?.elements ?? []) {
		if (el.type === 'text' && el.text?.trim()) {
			return el.text.trim().slice(0, 120);
		}
	}
	return undefined;
}
