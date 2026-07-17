/**
 * Toolbar action / ribbon-tab visibility: a single, framework-agnostic
 * catalogue of every top-level toolbar button and ribbon tab a host app can
 * independently hide. Each binding exposes a `hiddenActions?: ToolbarActionId[]`
 * prop, threads it down to the relevant render sites, and gates them with
 * `isActionHidden`. Default (`undefined` / `[]`) hides nothing, matching
 * today's always-visible behaviour.
 *
 * `TOOLBAR_TABS` is also the canonical ribbon-tab list/order, replacing the
 * copy hand-duplicated in each binding (React's `TOOLBAR_SECTIONS`, Vue's
 * `ribbon-constants.ts`, Angular's `RIBBON_TABS`, etc.) so the tab set can't
 * drift between bindings. Per-tab icons stay in each binding (icon libraries
 * differ per framework); only id + i18n key + order are shared here.
 */

/**
 * A single toolbar button/control that can be hidden independently of the
 * ribbon tab it may also appear inside. `zoom` and `navigation` each cover a
 * whole control cluster (zoom in/out/fit, prev/next) rather than each button
 * in it, matching how hosts actually want to hide/keep them as a unit.
 */
export type ToolbarButtonId =
	| 'share'
	| 'broadcast'
	| 'export'
	| 'undo'
	| 'redo'
	| 'record'
	| 'notes'
	| 'fullscreen'
	| 'zoom'
	| 'navigation';

/** A top-level ribbon tab. `record` intentionally shares its id with the quick-access Record button above: both surface the same recording feature, so hiding one hides the other. */
export type ToolbarTabId =
	| 'file'
	| 'home'
	| 'insert'
	| 'draw'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'slideShow'
	| 'record'
	| 'review'
	| 'view'
	| 'help';

export type ToolbarActionId = ToolbarButtonId | ToolbarTabId;

export interface ToolbarTabDefinition {
	id: ToolbarTabId;
	labelKey: string;
}

export const TOOLBAR_TABS: ToolbarTabDefinition[] = [
	{ id: 'file', labelKey: 'pptx.ribbon.tab.file' },
	{ id: 'home', labelKey: 'pptx.ribbon.tab.home' },
	{ id: 'insert', labelKey: 'pptx.ribbon.tab.insert' },
	{ id: 'draw', labelKey: 'pptx.ribbon.tab.draw' },
	{ id: 'design', labelKey: 'pptx.ribbon.tab.design' },
	{ id: 'transitions', labelKey: 'pptx.ribbon.tab.transitions' },
	{ id: 'animations', labelKey: 'pptx.ribbon.tab.animations' },
	{ id: 'slideShow', labelKey: 'pptx.ribbon.tab.slideShow' },
	{ id: 'record', labelKey: 'pptx.ribbon.tab.record' },
	{ id: 'review', labelKey: 'pptx.ribbon.tab.review' },
	{ id: 'view', labelKey: 'pptx.ribbon.tab.view' },
	{ id: 'help', labelKey: 'pptx.ribbon.tab.help' },
];

/** True when `id` is present in the host's `hiddenActions` list. */
export function isActionHidden(
	id: ToolbarActionId,
	hiddenActions: readonly ToolbarActionId[] | undefined,
): boolean {
	return hiddenActions !== undefined && hiddenActions.includes(id);
}

/** Filters a ribbon-tab list down to the ones the host hasn't hidden. */
export function filterVisibleTabs<T extends { id: ToolbarTabId }>(
	tabs: readonly T[],
	hiddenActions: readonly ToolbarActionId[] | undefined,
): T[] {
	if (hiddenActions === undefined || hiddenActions.length === 0) {
		return [...tabs];
	}
	return tabs.filter((tab) => !isActionHidden(tab.id, hiddenActions));
}
