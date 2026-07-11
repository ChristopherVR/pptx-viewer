import type { RibbonTabId } from './ribbon-types';

/**
 * The ribbon tab registry: id + i18n label key, in display order.
 *
 * Mirrors React's `TOOLBAR_SECTIONS` (see `packages/react/src/viewer/constants/toolbar.ts`)
 * tab order/labels, but this wave only implements content for `file` / `home`
 * / `insert` / `design` / `transitions` / `animations` / `view`. The
 * remaining entries are commented out rather than omitted so a later wave
 * adds one registry line + one tab-content module per tab, matching this
 * file's shape.
 */
export interface RibbonTabDef {
	id: RibbonTabId;
	labelKey: string;
}

export const RIBBON_TABS: readonly RibbonTabDef[] = [
	{ id: 'file', labelKey: 'pptx.ribbon.tab.file' },
	{ id: 'home', labelKey: 'pptx.ribbon.tab.home' },
	{ id: 'insert', labelKey: 'pptx.ribbon.tab.insert' },
	// Future waves (registry entries only, content module not yet written):
	// { id: 'draw', labelKey: 'pptx.ribbon.tab.draw' },
	{ id: 'design', labelKey: 'pptx.ribbon.tab.design' },
	{ id: 'transitions', labelKey: 'pptx.ribbon.tab.transitions' },
	{ id: 'animations', labelKey: 'pptx.ribbon.tab.animations' },
	// { id: 'slideShow', labelKey: 'pptx.ribbon.tab.slideShow' },
	// { id: 'record', labelKey: 'pptx.ribbon.tab.record' },
	// { id: 'review', labelKey: 'pptx.ribbon.tab.review' },
	{ id: 'view', labelKey: 'pptx.ribbon.tab.view' },
	// { id: 'help', labelKey: 'pptx.ribbon.tab.help' },
];

/** The default active tab on mount. */
export const DEFAULT_RIBBON_TAB: RibbonTabId = 'home';

/** True when `id` is a known ribbon tab (guards persisted/host-supplied tab ids). */
export function isRibbonTab(id: string): id is RibbonTabId {
	return RIBBON_TABS.some((tab) => tab.id === id);
}
