import type { PptxElement } from 'pptx-viewer-core';

import type {
	RibbonDrawState,
	RibbonEditState,
	RibbonNavState,
	RibbonSelectionState,
} from './ribbon-types';
import type { ViewToggleState } from './tabs/view-tab';

/** The imperative handle `createRibbon` returns (split out to keep `ribbon.ts` in budget). */
export interface Ribbon {
	el: HTMLElement;
	update(state: RibbonNavState): void;
	setEditState(state: RibbonEditState): void;
	setNotesExpanded(expanded: boolean): void;
	setAutosaveStatus(label: string, kind: 'idle' | 'saving' | 'saved' | 'error'): void;
	/** Show/hide the whole editing surface (Home/Insert tab content + find/replace). */
	setEditable(editable: boolean): void;
	/** Reflect the current selection across the Home tab's Font/Paragraph/Arrange groups. */
	updateSelection(selectedElement: PptxElement | undefined, extra: RibbonSelectionState): void;
	/** Reflect the current Draw tab tool/colour/width (store-driven). */
	setDrawState(state: RibbonDrawState): void;
	setTemplateEditing(active: boolean): void;
	/** Reflect the View tab's Show toggles (rulers/grid/guides/snapping). */
	setViewOptions(options: ViewToggleState): void;
	setHasMacros(hasMacros: boolean): void;
	setSubtitlesVisible(visible: boolean): void;
	/** Reflect the active slide's `hidden` flag on the Hide Slide toggle. */
	setHideSlideActive(active: boolean): void;
	/** Reflect the inspector panel's open state on the quick-access toggle. */
	setInspectorOpen(open: boolean): void;
	/**
	 * Show or hide the docked Find & Replace panel. Same action as Home >
	 * Editing > Find; exposed so the editor keymap can drive Ctrl/Cmd+F, which
	 * this binding had no shortcut for at all.
	 */
	toggleFindReplace(): void;
	openEquationEditor(id: string, omml: Record<string, unknown>): void;
	/**
	 * Hide ribbon tabs unticked in Options > Customize Ribbon. The File tab
	 * always survives; a hidden active tab falls back to Home (or the first
	 * remaining tab).
	 */
	setHiddenOptionTabs(tabIds: readonly string[]): void;
	/** Leave the File backstage and show the normal default ribbon tab. */
	showDefaultTab(): void;
	/** Apply Options > General ScreenTip style to the tab-bar tooltips. */
	applyScreenTips(tip: (label: string) => string | undefined): void;
}
