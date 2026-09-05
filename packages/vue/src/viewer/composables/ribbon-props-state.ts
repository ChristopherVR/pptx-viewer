import { canInteractWithElement, templateSchemeFromTheme } from 'pptx-viewer-shared';

import type { UseRibbonPropsInput } from './ribbon-props-types';

/**
 * buildRibbonPropsState: the state (non-callback) fields of `RibbonProps`,
 * read straight off the editor's refs/computeds. Extracted from
 * `useRibbonProps.ts` to keep that file under the repo's ~300 LOC convention;
 * see `ribbon-props-actions.ts` for the callback half. `useRibbonProps` spreads
 * this together with `buildRibbonPropsActions` and checks the merged object
 * against `RibbonProps`, so the split here is not itself type-checked against
 * the full contract.
 */
export function buildRibbonPropsState(input: UseRibbonPropsInput) {
	return {
		mode: input.ribbonMode.value,
		canEdit: input.canEdit(),
		isNarrowViewport: input.isMobile.value,
		isSidebarCollapsed: input.sidebarCollapsed.value,
		isInspectorPaneOpen: input.inspectorOpen.value,
		isCompactToolbarOpen: input.ribbonExpanded.value,
		toolbarSection: input.toolbarSection.value,
		scale: input.zoom.value,
		canUndo: input.canUndo.value,
		canRedo: input.canRedo.value,
		undoLabel: undefined,
		redoLabel: undefined,
		findReplaceOpen: input.findOpen.value,
		selectedElement: input.selectedElements.value[0] ?? null,
		selectedCount: input.selectedElements.value.length,
		// G10: drives the ribbon's Group button (and, via the shared context-menu
		// builder, the right-click menu's Group/Ungroup entries); mirrors the
		// `a:spLocks/@noGrp` guard `useAlignGroup`'s `onGroup`/`onUngroup` already
		// enforce on the commands themselves.
		selectionGroupable: input.selectedElements.value.every((el) =>
			canInteractWithElement(el, 'group'),
		),
		tableEditorState: input.activeTableSelection.value,
		editTemplateMode: input.editTemplateMode.value,
		newShapeType: input.newShapeType.value,
		activeTool: input.activeTool.value,
		drawingColor: input.drawingColor.value,
		drawingWidth: input.drawingWidth.value,
		clipboardPayload: input.clipboard.value ? { kind: 'element' } : null,
		spellCheckEnabled: input.spellCheckEnabled.value,
		showGrid: input.showGrid.value,
		showRulers: input.showRulers.value,
		showGuides: input.showGuides.value,
		snapToGrid: input.snapToGrid.value,
		snapToShape: input.snapToShape.value,
		isOverflowMenuOpen: input.overflowOpen.value,
		layoutOptions: input.layoutOptions.value,
		currentLayoutPath: input.activeSlide.value?.layoutPath,
		themeFonts: {
			heading: input.theme.value?.fontScheme?.majorFont?.latin,
			body: input.theme.value?.fontScheme?.minorFont?.latin,
		},
		embeddedFontFamilies: input.embeddedFontFamilies.value,
		customFontFamilies: input.customFontFamilies.value,
		templateScheme: templateSchemeFromTheme(input.theme.value?.colorScheme),
		customShows: input.customShows.value,
		activeCustomShowId: input.activeCustomShowId.value,
		isCurrentSlideInActiveShow: input.isCurrentSlideInActiveShow.value,
		hasMacros: false,
		isThemeEditorOpen: input.themeEditorOpen.value,
		isThemeGalleryOpen: input.themeGalleryOpen.value,
		isCommentsPanelOpen: input.showComments.value,
		slideCommentCount: input.activeComments.value.length,
		formatPainterActive: input.formatPainterActive.value,
		canActivateFormatPainter: input.canActivateFormatPainter.value,
		isSelectionPaneOpen: input.showSelectionPane.value,
		eyedropperActive: input.eyedropperActive.value,
		showSubtitles: input.showSubtitles.value,
		activeSlide: input.activeSlide.value,
		activeSlideHidden: Boolean(input.activeSlide.value?.hidden),
		presentationProperties: input.presentationProperties.value,
		isCollaborating: input.collab.status.value === 'connected',
		collaboratorCount: input.collab.connectedCount.value,
	};
}
