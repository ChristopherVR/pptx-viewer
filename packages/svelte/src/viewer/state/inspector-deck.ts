import type {
	ParsedTableStyleMap,
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxPresentationProperties,
	PptxThemeOption,
} from 'pptx-viewer-core';
import type { CanvasSize, SlideSizeEmu, SlideSizeRescaleMode } from 'pptx-viewer-shared';
import {
	applyTableStyleDelete,
	applyTableStyleMapChange,
	resolveSlideSizeSelection,
	scaleSlidesForSizeChange,
	slideSizeToCanvasPx,
	tableStyleSaveOptions,
} from 'pptx-viewer-shared';
import { getContext, setContext } from 'svelte';

import { createEditorSnapshot, saveEditorDocument } from '../editor/editor-document-state';
import type { EditorState } from '../editor/editor-state.svelte';
import type { PresentationLoader } from './presentation-loader.svelte';

/**
 * Deck-level state and mutations behind the inspector's no-selection
 * Properties tab: the Svelte port of Vue's `useInspectorDeckActions` (itself
 * mirroring the relevant pieces of React's `useThemeHandlers` and the
 * viewer-level canvas-size / document-property setters).
 *
 * Provided from `PowerPointViewer` via Svelte context (see
 * {@link provideInspectorDeck}) so `InspectorPanel` can reach it from any
 * mount point (viewer body, master view, mobile sheets) without threading a
 * prop through every intermediate component.
 */
export interface InspectorDeckActions {
	/** Packaged theme parts (`ppt/theme/*.xml`) selectable in the THEME card. */
	readonly themeOptions: PptxThemeOption[];
	/** Slide canvas size in px (the loader's reactive value). */
	readonly canvasSize: CanvasSize;
	/** Notes page size in px, when the package declares one. */
	readonly notesCanvasSize: CanvasSize | undefined;
	/** The deck's `p:sldSz` in EMU, which is what a save persists. */
	readonly slideSize: SlideSizeEmu | undefined;
	/** Whether any slide has at least one element; gates the Maximize/Ensure Fit rescale prompt. */
	readonly hasContent: boolean;
	/** Apply a packaged theme part by archive path (React's `handleApplyTheme`). */
	applyThemeByPath(themePath: string, applyToAllMasters: boolean): void;
	/** Resize the slide canvas (inspector SLIDE SIZE card's raw W/H inputs). */
	updateCanvasSize(size: CanvasSize): void;
	/**
	 * Adopt an EMU slide size (a preset pick or an orientation flip). Writes the
	 * EMU state AND the pixel canvas, so the stage resizes and the save keeps the
	 * exact authored dimensions.
	 *
	 * `rescaleMode` is set only when the user confirmed the Maximize/Ensure Fit
	 * prompt for a size change that affects existing content: the shared
	 * `scaleSlidesForSizeChange` transform is applied to every slide as ONE
	 * undo step together with the size change (`commitSlides`).
	 */
	updateSlideSize(size: SlideSizeEmu, rescaleMode?: SlideSizeRescaleMode): void;
	/** Patch deck-wide slide-show / print settings (PRESENTATION card). */
	updatePresentationProperties(patch: Partial<PptxPresentationProperties>): void;
	/** Patch document core properties (Title / Author / ...). */
	updateCoreProperties(patch: Partial<PptxCoreProperties>): void;
	/** Patch application properties (Company / Application). */
	updateAppProperties(patch: Partial<PptxAppProperties>): void;
	/** Replace the custom document-property list. */
	updateCustomProperties(next: PptxCustomProperty[]): void;
	/**
	 * Set a layout/master's background colour (SLIDE BACKGROUND card's
	 * template rows, shown while `editTemplateMode` is on). Master Views
	 * covers the same ground but requires leaving the slide.
	 */
	setTemplateBackground(path: string, backgroundColor: string): void;
	/** Read a layout/master's current background colour. */
	getTemplateBackgroundColor(path: string): string | undefined;
	/**
	 * The deck's parsed `ppt/tableStyles.xml` map, for the table properties
	 * panel's "Edit style...". Reached via `useInspectorDeck()` context rather
	 * than prop-drilled, so `TableSection`/`TableStyleEditor` need no chain of
	 * intermediate props through `InspectorPanel`'s ancestors.
	 */
	readonly tableStyleMap: ParsedTableStyleMap | undefined;
	/** Commit a full replacement style map (section edit, create, or delete already applied). */
	updateTableStyleMap(nextMap: ParsedTableStyleMap): void;
	/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
	deleteTableStyle(styleId: string): void;
}

export interface InspectorDeckDeps {
	loader: PresentationLoader;
	editor: EditorState;
}

/** Build the deck-action facade over the loader + history-tracked editor. */
export function createInspectorDeckActions(deps: InspectorDeckDeps): InspectorDeckActions {
	const { loader, editor } = deps;

	/**
	 * Mirror React's `refreshContentAfterThemeChange` / Vue's `refreshContent`:
	 * re-serialise the deck and run it back through the load pipeline so slide
	 * colours re-resolve against the newly-applied theme. Serialises via
	 * `saveEditorDocument` directly (not `editor.save()`) so the dirty flag is
	 * not cleared by the refresh itself.
	 */
	async function refreshContent(): Promise<void> {
		const handler = loader.handler;
		if (!handler) {
			return;
		}
		const bytes = await saveEditorDocument(
			handler,
			{ ...createEditorSnapshot(editor), slides: editor.renderedSlides },
			'pptx',
			undefined,
			editor.embedFonts,
			// Without this the theme round-trip would reload the deck at its
			// load-time `p:sldSz` and silently undo a slide-size pick.
			resolveSlideSizeSelection({ current: loader.slideSize, canvas: loader.canvasSize }).size,
			undefined,
			// Without this the theme round-trip would reload the deck at its
			// load-time `ppt/tableStyles.xml` and silently undo a pending
			// table-style edit/delete.
			tableStyleSaveOptions({
				tableStyleMap: loader.tableStyleMap,
				tableStylesDefaultId: loader.tableStylesDefaultId,
				tableStylesToDelete: loader.tableStylesToDelete,
			}),
		);
		await loader.load(bytes);
	}

	return {
		get themeOptions(): PptxThemeOption[] {
			return loader.themeOptions;
		},
		get canvasSize(): CanvasSize {
			return loader.canvasSize;
		},
		get notesCanvasSize(): CanvasSize | undefined {
			return loader.notesCanvasSize;
		},
		get slideSize(): SlideSizeEmu | undefined {
			return loader.slideSize;
		},
		get hasContent(): boolean {
			return editor.slides.some((slide) => slide.elements.length > 0);
		},
		applyThemeByPath(themePath: string, applyToAllMasters: boolean): void {
			const handler = loader.handler;
			if (!handler) {
				return;
			}
			void (async () => {
				await handler.setPresentationTheme(themePath, applyToAllMasters);
				editor.slideMasters = editor.slideMasters.map((master, index) =>
					applyToAllMasters || index === 0 ? { ...master, themePath } : master,
				);
				editor.commitChange();
				await refreshContent();
			})().catch(() => undefined);
		},
		updateCanvasSize(size: CanvasSize): void {
			const width = Math.round(size.width);
			const height = Math.round(size.height);
			if (!Number.isFinite(width) || !Number.isFinite(height)) {
				return;
			}
			loader.canvasSize = { width: Math.max(1, width), height: Math.max(1, height) };
			editor.commitChange();
		},
		updateSlideSize(size: SlideSizeEmu, rescaleMode?: SlideSizeRescaleMode): void {
			if (!Number.isFinite(size.widthEmu) || !Number.isFinite(size.heightEmu)) {
				return;
			}
			if (size.widthEmu <= 0 || size.heightEmu <= 0) {
				return;
			}
			if (rescaleMode) {
				// Maximize/Ensure Fit: rescale every slide's content through the
				// normal undoable path (one history entry), THEN apply the new size.
				const oldSize = resolveSlideSizeSelection({
					current: loader.slideSize,
					canvas: loader.canvasSize,
				}).size;
				editor.commitSlides(scaleSlidesForSizeChange(editor.slides, oldSize, size, rescaleMode));
			}
			loader.slideSize = { ...size };
			loader.canvasSize = slideSizeToCanvasPx(size);
			editor.commitChange();
		},
		updatePresentationProperties(patch: Partial<PptxPresentationProperties>): void {
			editor.presentationMetadata.updatePresentationProperties({
				...editor.presentationProperties,
				...patch,
			});
		},
		updateCoreProperties(patch: Partial<PptxCoreProperties>): void {
			editor.updateDocumentProperties(
				{ ...(editor.coreProperties ?? {}), ...patch },
				{ ...(editor.appProperties ?? {}) },
				editor.customProperties,
			);
		},
		updateAppProperties(patch: Partial<PptxAppProperties>): void {
			editor.updateDocumentProperties(
				{ ...(editor.coreProperties ?? {}) },
				{ ...(editor.appProperties ?? {}), ...patch },
				editor.customProperties,
			);
		},
		updateCustomProperties(next: PptxCustomProperty[]): void {
			editor.updateDocumentProperties(
				{ ...(editor.coreProperties ?? {}) },
				{ ...(editor.appProperties ?? {}) },
				next,
			);
		},
		setTemplateBackground(path: string, backgroundColor: string): void {
			const handler = loader.handler;
			if (!handler) {
				return;
			}
			handler.setTemplateBackground(path, backgroundColor);
			editor.slideMasters = editor.slideMasters.map((master) =>
				master.path === path ? { ...master, backgroundColor } : master,
			);
			editor.commitChange();
		},
		getTemplateBackgroundColor(path: string): string | undefined {
			return loader.handler?.getTemplateBackgroundColor(path);
		},
		get tableStyleMap(): ParsedTableStyleMap | undefined {
			return loader.tableStyleMap;
		},
		updateTableStyleMap(nextMap: ParsedTableStyleMap): void {
			const result = applyTableStyleMapChange(
				{ tableStyleMap: loader.tableStyleMap, tableStylesToDelete: loader.tableStylesToDelete },
				nextMap,
			);
			loader.tableStyleMap = result.tableStyleMap;
			loader.tableStylesToDelete = result.tableStylesToDelete;
			editor.commitChange();
		},
		deleteTableStyle(styleId: string): void {
			const result = applyTableStyleDelete(
				{ tableStyleMap: loader.tableStyleMap, tableStylesToDelete: loader.tableStylesToDelete },
				styleId,
			);
			loader.tableStyleMap = result.tableStyleMap;
			loader.tableStylesToDelete = result.tableStylesToDelete;
			editor.commitChange();
		},
	};
}

/**
 * Context key for the inspector deck actions. Exported so tests (and
 * out-of-tree mounts) can seed it via `mount(Component, { context: new
 * Map([[INSPECTOR_DECK_CONTEXT_KEY, deck]]) })`; mirrors `I18N_CONTEXT_KEY`.
 */
export const INSPECTOR_DECK_CONTEXT_KEY = Symbol('pptx-svelte-inspector-deck');

/** Provide the deck actions to the component subtree (root component only). */
export function provideInspectorDeck(deck: InspectorDeckActions): void {
	setContext(INSPECTOR_DECK_CONTEXT_KEY, deck);
}

/** Consume the nearest provided deck actions; undefined in standalone mounts. */
export function useInspectorDeck(): InspectorDeckActions | undefined {
	return getContext<InspectorDeckActions | undefined>(INSPECTOR_DECK_CONTEXT_KEY);
}
