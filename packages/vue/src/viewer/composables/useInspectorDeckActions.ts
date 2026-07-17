import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxHandler,
	PptxSlideMaster,
	PptxTagCollection,
} from 'pptx-viewer-core';
import type { Ref, ShallowRef } from 'vue';

import type { CanvasSize } from '../types';

export interface UseInspectorDeckActionsInput {
	handler: ShallowRef<PptxHandler | null>;
	slideMasters: ShallowRef<PptxSlideMaster[]>;
	canvasSize: Ref<CanvasSize>;
	coreProperties: ShallowRef<PptxCoreProperties | undefined>;
	appProperties: ShallowRef<PptxAppProperties | undefined>;
	customProperties: ShallowRef<PptxCustomProperty[]>;
	tagCollections: ShallowRef<PptxTagCollection[]>;
	markDirty: () => void;
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
	/** Resize the slide canvas (inspector SLIDE SIZE card). */
	updateCanvasSize: (size: CanvasSize) => void;
	/** Patch document core properties (Title / Author / ...). */
	updateCoreProperties: (patch: Partial<PptxCoreProperties>) => void;
	/** Patch application properties (Company / Application). */
	updateAppProperties: (patch: Partial<PptxAppProperties>) => void;
	/** Replace the custom document-property list. */
	updateCustomProperties: (next: PptxCustomProperty[]) => void;
	/** Replace the document tag collections (inspector TAGS card). */
	updateTagCollections: (next: PptxTagCollection[]) => void;
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
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		markDirty,
		refreshContent,
	} = input;

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

	return {
		applyThemeByPath,
		updateCanvasSize,
		updateCoreProperties,
		updateAppProperties,
		updateCustomProperties,
		updateTagCollections,
	};
}
