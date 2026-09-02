import type {
	PptxData,
	PptxHandler,
	PptxPresentationProperties,
	PptxSlide,
	PptxTagCollection,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';
import { applyThemeToData, reResolveElementColors } from 'pptx-viewer-core';
import type { SlideSizeEmu, SlideSizeRescaleMode } from 'pptx-viewer-shared';
import {
	resolveSlideSizeSelection,
	scaleSlidesForSizeChange,
	slideSizeToCanvasPx,
	updateSlide,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

/**
 * Deck-level mutations driven by the no-selection inspector Properties tab
 * (React's `PresentationPropertiesPanel`): presentation show settings, theme
 * apply-by-path, per-slide patches (theme override), and slide-canvas resize.
 * The vanilla counterpart of Vue's `useInspectorDeckActions` plus the
 * presentation-settings piece of its `PresentationSettingsCard` wiring.
 */
export interface DeckActions {
	/** Merge a patch into the presentation-level show/print settings. */
	updatePresentationSettings(patch: Partial<PptxPresentationProperties>): void;
	/** Apply a packaged theme part by archive path (React's `handleApplyTheme`). */
	applyThemeByPath(themePath: string, allMasters: boolean): void;
	/** Re-theme the deck from the inspector's THEME EDITOR card. */
	applyThemeEdit(payload: {
		colorScheme: PptxThemeColorScheme;
		fontScheme: PptxThemeFontScheme;
		name: string;
	}): void;
	/** Replace the deck's `ppt/tags/*.xml` collections (inspector TAGS card). */
	updateTagCollections(next: PptxTagCollection[]): void;
	/** Patch the active slide (inspector THEME OVERRIDE card). */
	updateActiveSlide(patch: Partial<PptxSlide>): void;
	/**
	 * Set a layout/master's background colour (inspector SLIDE BACKGROUND
	 * card's template rows, shown while `editTemplateMode` is on). Master
	 * Views covers the same ground but requires leaving the slide.
	 */
	setTemplateBackground(path: string, backgroundColor: string): void;
	/** Read a layout/master's current background colour. */
	getTemplateBackgroundColor(path: string): string | undefined;
	/** Resize the slide canvas (the SLIDE SIZE card's raw W/H inputs). */
	updateCanvasSize(size: { width: number; height: number }): void;
	/**
	 * Adopt an EMU slide size (a preset pick or an orientation flip). Writes the
	 * EMU state AND the pixel canvas, so the stage resizes and the save keeps the
	 * exact authored dimensions.
	 */
	updateSlideSize(size: SlideSizeEmu): void;
	/**
	 * Adopt an EMU slide size AND rescale every slide's content for it in one
	 * undoable step (PowerPoint's Design > Slide Size "Maximize" / "Ensure Fit"
	 * prompt, shown when the deck has content and the new size does not match
	 * the old one). Unlike {@link updateSlideSize}, this also repositions and
	 * resizes every element (and scales font sizes) through the shared
	 * `scaleSlidesForSizeChange`.
	 */
	applySlideSizeRescale(size: SlideSizeEmu, mode: SlideSizeRescaleMode): void;
}

export interface DeckActionsDeps {
	store: Store<ViewerState>;
	ops: Pick<EditorOps, 'pushHistory' | 'commitChange' | 'updatePresentationProperties'>;
	getHandler(): PptxHandler | null;
}

export function createDeckActions(deps: DeckActionsDeps): DeckActions {
	const { store, ops } = deps;
	return {
		updatePresentationSettings(patch) {
			// Editable guard + history + dirty all live in the underlying op.
			ops.updatePresentationProperties({ ...store.get().presentationProperties, ...patch });
		},

		applyThemeByPath(themePath, allMasters) {
			const handler = deps.getHandler();
			if (!handler || !themePath || !store.get().editable) {
				return;
			}
			void (async () => {
				await handler.setPresentationTheme(themePath, allMasters);
				// A fresh masters array re-renders the stage via the state-sync
				// listener; commitChange marks dirty + notifies the host.
				store.set({
					slideMasters: store
						.get()
						.slideMasters.map((master, index) =>
							allMasters || index === 0 ? { ...master, themePath } : master,
						),
				});
				ops.commitChange();
			})();
		},

		applyThemeEdit({ colorScheme, fontScheme, name }) {
			const state = store.get();
			if (!state.editable) {
				return;
			}
			ops.pushHistory();
			// Core's pure `applyThemeToData` re-resolves every slide's scheme-based
			// colours against the new palette, which is what makes an edited theme
			// visible on the canvas rather than only on the next save.
			const previousColorMap = state.colorScheme ? { ...state.colorScheme } : undefined;
			const result = applyThemeToData(
				{
					slides: state.slides,
					theme: { colorScheme: state.colorScheme, fontScheme: state.fontScheme },
					themeColorMap: previousColorMap,
				} as unknown as PptxData,
				colorScheme,
				fontScheme,
				name,
			);
			// Master/layout elements render as a separate per-slide layer (not part
			// of `slide.elements`), so the slides re-resolve above never touches
			// them; left alone they'd keep painting the old scheme's colours.
			const templateElementsBySlideId = Object.keys(state.templateElementsBySlideId).length
				? Object.fromEntries(
						Object.entries(state.templateElementsBySlideId).map(([slideId, elements]) => [
							slideId,
							reResolveElementColors(elements, previousColorMap ?? {}, colorScheme),
						]),
					)
				: state.templateElementsBySlideId;
			store.set({
				slides: result.slides,
				templateElementsBySlideId,
				colorScheme: result.theme?.colorScheme ?? colorScheme,
				fontScheme: result.theme?.fontScheme ?? fontScheme,
				themeName: name,
			});
			ops.commitChange();
		},

		updateTagCollections(next) {
			if (!store.get().editable) {
				return;
			}
			// Tags live outside the slide tree, so there is nothing for the history
			// snapshot to restore; commitChange still marks the deck dirty so the
			// change reaches the next save.
			store.set({ tagCollections: next });
			ops.commitChange();
		},

		updateActiveSlide(patch) {
			const state = store.get();
			if (!state.editable || !state.slides[state.currentSlide]) {
				return;
			}
			ops.pushHistory();
			store.set({ slides: updateSlide(state.slides, state.currentSlide, patch) });
			ops.commitChange();
		},

		setTemplateBackground(path, backgroundColor) {
			const handler = deps.getHandler();
			if (!handler || !store.get().editable) {
				return;
			}
			handler.setTemplateBackground(path, backgroundColor);
			store.set({
				slideMasters: store
					.get()
					.slideMasters.map((master) =>
						master.path === path ? { ...master, backgroundColor } : master,
					),
			});
			ops.commitChange();
		},

		getTemplateBackgroundColor(path) {
			return deps.getHandler()?.getTemplateBackgroundColor(path);
		},

		updateCanvasSize(size) {
			if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
				return;
			}
			if (!store.get().editable) {
				return;
			}
			store.set({
				canvasSize: {
					width: Math.max(1, Math.round(size.width)),
					height: Math.max(1, Math.round(size.height)),
				},
			});
			ops.commitChange();
		},

		updateSlideSize(size) {
			if (!Number.isFinite(size.widthEmu) || !Number.isFinite(size.heightEmu)) {
				return;
			}
			if (size.widthEmu <= 0 || size.heightEmu <= 0) {
				return;
			}
			if (!store.get().editable) {
				return;
			}
			store.set({ slideSize: { ...size }, canvasSize: slideSizeToCanvasPx(size) });
			ops.commitChange();
		},

		applySlideSizeRescale(size, mode) {
			if (!Number.isFinite(size.widthEmu) || !Number.isFinite(size.heightEmu)) {
				return;
			}
			if (size.widthEmu <= 0 || size.heightEmu <= 0) {
				return;
			}
			const state = store.get();
			if (!state.editable) {
				return;
			}
			const oldSize = resolveSlideSizeSelection({
				current: state.slideSize,
				canvas: state.canvasSize,
			}).size;
			// One history entry for the rescale + size change together, per the
			// Design > Slide Size prompt contract.
			ops.pushHistory();
			store.set({
				slides: scaleSlidesForSizeChange(state.slides, oldSize, size, mode),
				slideSize: { ...size },
				canvasSize: slideSizeToCanvasPx(size),
			});
			ops.commitChange();
		},
	};
}
