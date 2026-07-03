import { ref } from 'vue';
import type { Ref } from 'vue';

import type {
	DrawingTool,
	SupportedShapeType,
	ToolbarSection,
} from '../components/ribbon/ribbon-types';

export interface UseRibbonUiStateResult {
	toolbarSection: Ref<ToolbarSection>;
	newShapeType: Ref<SupportedShapeType>;
	activeTool: Ref<DrawingTool>;
	drawingColor: Ref<string>;
	drawingWidth: Ref<number>;
	/** Right-rail inspector visibility (desktop). */
	inspectorOpen: Ref<boolean>;
	/** Left slides-rail collapse (Quick-Access sidebar toggle). */
	sidebarCollapsed: Ref<boolean>;
	/** Ribbon content expanded (true) vs collapsed to just the tab bar (false). */
	ribbonExpanded: Ref<boolean>;
	overflowOpen: Ref<boolean>;
	/** Status-bar Notes toggle: expands/collapses the desktop notes panel. */
	notesExpanded: Ref<boolean>;
	/** View-tab dot-grid overlay (snap-to-grid state lives in useElementDrag). */
	showGrid: Ref<boolean>;
	/** View ▸ Rulers: horizontal/vertical rulers along the slide edges. */
	showRulers: Ref<boolean>;
	/** View ▸ Spell: draw the browser's native spell-check squiggles while editing. */
	spellCheckEnabled: Ref<boolean>;
	/** Design ▸ Themes gallery overlay. */
	themeGalleryOpen: Ref<boolean>;
	/** Design ▸ Theme editor overlay. */
	themeEditorOpen: Ref<boolean>;
}

/**
 * useRibbonUiState: the plain view-state toggles the Office-style ribbon reads
 * and writes (active tab/tool, panel visibility, grid/ruler/spell-check
 * toggles, theme overlays). No derived logic; a home for the ribbon's flat
 * UI-state refs so `PowerPointViewer.vue` doesn't declare them inline.
 * Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useRibbonUiState(): UseRibbonUiStateResult {
	return {
		toolbarSection: ref<ToolbarSection>('home'),
		newShapeType: ref<SupportedShapeType>('rect'),
		activeTool: ref<DrawingTool>('select'),
		drawingColor: ref('#000000'),
		drawingWidth: ref(2),
		inspectorOpen: ref(true),
		sidebarCollapsed: ref(false),
		ribbonExpanded: ref(true),
		overflowOpen: ref(false),
		notesExpanded: ref(false),
		showGrid: ref(false),
		showRulers: ref(false),
		spellCheckEnabled: ref(true),
		themeGalleryOpen: ref(false),
		themeEditorOpen: ref(false),
	};
}
