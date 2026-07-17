/**
 * ribbon-types.ts: shared ribbon-tab id type used by {@link RibbonComponent},
 * {@link RibbonTabListComponent}, and {@link RibbonContentComponent}. Kept in
 * its own file (rather than declared in one of those components) so none of
 * them has to import a type from a sibling that also imports it, mirroring
 * the Svelte binding's `ribbon/ribbon-types.ts`.
 */
import type { ToolbarTabId } from '../internal/shared';

/**
 * Ribbon tab identifiers. Includes 'text' and 'arrange' on top of the shared
 * {@link ToolbarTabId} catalogue: two extra content-only tabs that don't get
 * their own tab-bar button (no `TOOLBAR_TABS` entry) but are still reachable
 * as `@switch` cases.
 */
export type RibbonTab = ToolbarTabId | 'text' | 'arrange';
