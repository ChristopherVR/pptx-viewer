/**
 * The ribbon's tab registry. Mirrors React's `TOOLBAR_SECTIONS`
 * (`packages/react/src/viewer/constants/toolbar.ts`) tab order and i18n keys,
 * but only lists the tabs this binding currently renders content for
 * (File / Home / Insert / Draw / Design / Transitions / Animations / View).
 * Add a tab by appending one entry here plus one `<Tab>.svelte` component
 * wired into `Ribbon.svelte`'s pane switch; later waves add Slide Show/
 * Record/Review/Help the same way.
 */
export type RibbonTabId =
	| 'file'
	| 'home'
	| 'insert'
	| 'draw'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'view';

export interface RibbonTabDef {
	id: RibbonTabId;
	/** Shared i18n dictionary key (`pptx.ribbon.tab.*`), same keys React uses. */
	labelKey: string;
}

export const RIBBON_TABS: readonly RibbonTabDef[] = [
	{ id: 'file', labelKey: 'pptx.ribbon.tab.file' },
	{ id: 'home', labelKey: 'pptx.ribbon.tab.home' },
	{ id: 'insert', labelKey: 'pptx.ribbon.tab.insert' },
	{ id: 'draw', labelKey: 'pptx.ribbon.tab.draw' },
	{ id: 'design', labelKey: 'pptx.ribbon.tab.design' },
	{ id: 'transitions', labelKey: 'pptx.ribbon.tab.transitions' },
	{ id: 'animations', labelKey: 'pptx.ribbon.tab.animations' },
	{ id: 'view', labelKey: 'pptx.ribbon.tab.view' },
];

export const DEFAULT_RIBBON_TAB: RibbonTabId = 'home';

export function isRibbonTab(id: string): id is RibbonTabId {
	return RIBBON_TABS.some((tab) => tab.id === id);
}
