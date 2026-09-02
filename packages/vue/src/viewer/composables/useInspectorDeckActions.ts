import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxHandler,
	PptxSlide,
	PptxSlideMaster,
	PptxTagCollection,
} from 'pptx-viewer-core';
import type { SlideSizeEmu, SlideSizeRescaleMode } from 'pptx-viewer-shared';
import { scaleSlidesForSizeChange } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref, ShallowRef } from 'vue';

import type { CanvasSize } from '../types';

/**
 * A slide-size change awaiting the user's Maximize / Ensure Fit choice
 * (`pptx.slideSize.rescale*`, `SlideSizeRescalePrompt.vue`). Set when the deck
 * has at least one element and the chosen size differs from the current one;
 * `chooseSlideSizeRescale`/`cancelSlideSizeRescale` resolve it.
 */
export interface PendingSlideSizeRescale {
	oldSize: SlideSizeEmu;
	newSize: SlideSizeEmu;
	newCanvas: CanvasSize;
}

export interface UseInspectorDeckActionsInput {
	handler: ShallowRef<PptxHandler | null>;
	slideMasters: ShallowRef<PptxSlideMaster[]>;
	canvasSize: Ref<CanvasSize>;
	/** The deck's `p:sldSz` in EMU (`useLoadContent().slideSize`). */
	slideSize: Ref<SlideSizeEmu | undefined>;
	/** The editable deck, so a confirmed rescale can restate every slide's elements. */
	slides: Ref<PptxSlide[]>;
	coreProperties: ShallowRef<PptxCoreProperties | undefined>;
	appProperties: ShallowRef<PptxAppProperties | undefined>;
	customProperties: ShallowRef<PptxCustomProperty[]>;
	tagCollections: ShallowRef<PptxTagCollection[]>;
	markDirty: () => void;
	/** Snapshot `slides` onto the undo stack before a rescale mutates it. */
	pushHistory: () => void;
	/**
	 * Re-serialise the deck and swap it back in as the active content so slide
	 * colours re-resolve against the newly-applied theme (mirrors React's
	 * `refreshContentAfterThemeChange`). Optional; theme switching still updates
	 * the master `themePath`s and marks the deck dirty without it.
	 */
	refreshContent?: () => Promise<void>;
}

export interface UseInspectorDeckActionsResult {
	/** Apply a packaged theme part by archive path (React's `handleApplyTheme`). */
	applyThemeByPath: (themePath: string, applyToAllMasters: boolean) => void;
	/** Resize the slide canvas (inspector SLIDE SIZE card's raw W/H inputs). */
	updateCanvasSize: (size: CanvasSize) => void;
	/**
	 * Adopt a slide size chosen by preset or orientation. Sets BOTH the EMU size
	 * (what the save writes to `p:sldSz`) and the pixel canvas (what the stage
	 * lays out at), because deriving one from the other loses preset identity.
	 *
	 * When the new size differs from the current one AND the deck already has
	 * at least one element, this does NOT apply immediately: it opens the
	 * Maximize / Ensure Fit rescale prompt via {@link pendingSlideSizeRescale}
	 * instead, mirroring PowerPoint's own "some content is off-slide" choice.
	 */
	updateSlideSize: (size: SlideSizeEmu, canvas: CanvasSize) => void;
	/** The rescale prompt's state, or `null` when it is not showing. */
	pendingSlideSizeRescale: Ref<PendingSlideSizeRescale | null>;
	/**
	 * Resolve the pending rescale: scale every slide's elements (one undo
	 * entry, pushed first) and then apply the new size.
	 */
	chooseSlideSizeRescale: (mode: SlideSizeRescaleMode) => void;
	/** Dismiss the prompt without changing the slide size. */
	cancelSlideSizeRescale: () => void;
	/** Patch document core properties (Title / Author / ...). */
	updateCoreProperties: (patch: Partial<PptxCoreProperties>) => void;
	/** Patch application properties (Company / Application). */
	updateAppProperties: (patch: Partial<PptxAppProperties>) => void;
	/** Replace the custom document-property list. */
	updateCustomProperties: (next: PptxCustomProperty[]) => void;
	/** Replace the document tag collections (inspector TAGS card). */
	updateTagCollections: (next: PptxTagCollection[]) => void;
	/** Set a layout/master's background colour (SLIDE BACKGROUND card, template-edit mode). */
	setTemplateBackground: (path: string, backgroundColor: string) => void;
	/** Read a layout/master's current background colour. */
	getTemplateBackgroundColor: (path: string) => string | undefined;
}

/**
 * useInspectorDeckActions: deck-level mutations driven by the no-selection
 * inspector (Properties tab), the Vue port of the corresponding pieces of
 * React's `useThemeHandlers` (theme-by-path apply) and the viewer-level
 * canvas-size / document-property setters wired into
 * `PresentationPropertiesPanel`.
 */
export function useInspectorDeckActions(
	input: UseInspectorDeckActionsInput,
): UseInspectorDeckActionsResult {
	const {
		handler,
		slideMasters,
		canvasSize,
		slideSize,
		slides,
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		markDirty,
		pushHistory,
		refreshContent,
	} = input;

	const pendingSlideSizeRescale = ref<PendingSlideSizeRescale | null>(null);

	function applyThemeByPath(themePath: string, applyToAllMasters: boolean): void {
		void (async () => {
			const current = handler.value;
			if (!current) {
				return;
			}
			await current.setPresentationTheme(themePath, applyToAllMasters);
			slideMasters.value = slideMasters.value.map((master, index) =>
				applyToAllMasters || index === 0 ? { ...master, themePath } : master,
			);
			markDirty();
			await refreshContent?.();
		})();
	}

	function updateCanvasSize(size: CanvasSize): void {
		const width = Math.max(1, Math.round(size.width));
		const height = Math.max(1, Math.round(size.height));
		if (!Number.isFinite(width) || !Number.isFinite(height)) {
			return;
		}
		canvasSize.value = { width, height };
		markDirty();
	}

	function applySlideSize(size: SlideSizeEmu, canvas: CanvasSize): void {
		slideSize.value = size;
		updateCanvasSize(canvas);
	}

	function updateSlideSize(size: SlideSizeEmu, canvas: CanvasSize): void {
		if (size.widthEmu <= 0 || size.heightEmu <= 0) {
			return;
		}
		const current = slideSize.value;
		const sizeChanged =
			current !== undefined &&
			(current.widthEmu !== size.widthEmu || current.heightEmu !== size.heightEmu);
		const hasContent = slides.value.some((slide) => slide.elements.length > 0);
		if (current && sizeChanged && hasContent) {
			pendingSlideSizeRescale.value = { oldSize: current, newSize: size, newCanvas: canvas };
			return;
		}
		applySlideSize(size, canvas);
	}

	function chooseSlideSizeRescale(mode: SlideSizeRescaleMode): void {
		const pending = pendingSlideSizeRescale.value;
		if (!pending) {
			return;
		}
		pushHistory();
		slides.value = scaleSlidesForSizeChange(slides.value, pending.oldSize, pending.newSize, mode);
		applySlideSize(pending.newSize, pending.newCanvas);
		pendingSlideSizeRescale.value = null;
	}

	function cancelSlideSizeRescale(): void {
		pendingSlideSizeRescale.value = null;
	}

	function updateCoreProperties(patch: Partial<PptxCoreProperties>): void {
		coreProperties.value = { ...(coreProperties.value ?? {}), ...patch };
		markDirty();
	}

	function updateAppProperties(patch: Partial<PptxAppProperties>): void {
		appProperties.value = { ...(appProperties.value ?? {}), ...patch };
		markDirty();
	}

	function updateCustomProperties(next: PptxCustomProperty[]): void {
		customProperties.value = next;
		markDirty();
	}

	function updateTagCollections(next: PptxTagCollection[]): void {
		tagCollections.value = next;
		markDirty();
	}

	function setTemplateBackground(path: string, backgroundColor: string): void {
		const current = handler.value;
		if (!current) {
			return;
		}
		current.setTemplateBackground(path, backgroundColor);
		slideMasters.value = slideMasters.value.map((master) =>
			master.path === path ? { ...master, backgroundColor } : master,
		);
		markDirty();
	}

	function getTemplateBackgroundColor(path: string): string | undefined {
		return handler.value?.getTemplateBackgroundColor(path);
	}

	return {
		applyThemeByPath,
		updateCanvasSize,
		updateSlideSize,
		pendingSlideSizeRescale,
		chooseSlideSizeRescale,
		cancelSlideSizeRescale,
		updateCoreProperties,
		updateAppProperties,
		updateCustomProperties,
		updateTagCollections,
		setTemplateBackground,
		getTemplateBackgroundColor,
	};
}
