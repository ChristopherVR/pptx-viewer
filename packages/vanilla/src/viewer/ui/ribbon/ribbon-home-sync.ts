import type { PptxElement } from 'pptx-viewer-core';

import type { HomeTabSyncState } from './home/home-tab';
import type { RibbonSelectionState } from './ribbon-types';

/** Map the ribbon's latest selection push onto the Home tab's sync payload. */
export function buildHomeSyncState(
	editable: boolean,
	selectedElement: PptxElement | undefined,
	extra: RibbonSelectionState,
): HomeTabSyncState {
	return {
		editable,
		selectedElement,
		hasClipboard: extra.hasClipboard,
		formatPainterActive: extra.formatPainterActive ?? false,
		slideCount: extra.slideCount,
		selectedCount: extra.selectedCount ?? 0,
		selectionGroupable: extra.selectionGroupable ?? true,
		layouts: extra.layouts ?? [],
		layoutPreviews: extra.layoutPreviews,
		currentLayoutPath: extra.currentLayoutPath,
		themeFonts: extra.themeFonts,
		embeddedFontFamilies: extra.embeddedFontFamilies,
		customFontFamilies: extra.customFontFamilies,
		recentColors: extra.recentColors ?? [],
		themeColorMap: extra.themeColorMap,
		canMergeShapes: extra.canMergeShapes,
		canCrop: extra.canCrop,
		cropActive: extra.cropActive,
	};
}
