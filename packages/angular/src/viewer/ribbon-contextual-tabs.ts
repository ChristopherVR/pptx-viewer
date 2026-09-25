/**
 * ribbon-contextual-tabs.ts: the ribbon's active-tab state, aware of the
 * contextual tabs (Shape Format, Picture Format, ...) the selection brings up.
 *
 * `visibleContextualTabs` and `resolveActiveRibbonTab` (shared) decide which
 * contextual tabs exist and where the ribbon falls back to; this file only
 * wires them into Angular signals. The active tab is a `linkedSignal` over
 * the visible contextual tabs: a user pick `set()`s it, and when the
 * selection changes so the active contextual tab disappears it recomputes to
 * Home. It never switches TO a contextual tab on its own (PowerPoint shows
 * the tab but leaves you where you were). No effect is involved, so there is
 * no write-in-effect re-entrancy to guard.
 */
import { computed, linkedSignal } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	resolveActiveRibbonTab,
	RIBBON_CONTEXTUAL_TABS,
	visibleContextualTabs,
} from '../internal/shared';
import type { ResolvedCustomization, RibbonContextualTabId } from '../internal/shared';
import type { RibbonTab } from './ribbon-types';

export interface RibbonTabState {
	/** Contextual tabs to append after the fixed tabs, in PowerPoint's order. */
	contextualTabs: Signal<RibbonContextualTabId[]>;
	/** The tab whose content shows. */
	activeTab: WritableSignal<RibbonTab>;
}

export function createRibbonTabState(
	selectedElement: Signal<PptxElement | null>,
	resolved: Signal<ResolvedCustomization>,
	initial: RibbonTab = 'home',
): RibbonTabState {
	const contextualTabs = computed(() => visibleContextualTabs(selectedElement(), resolved()), {
		equal: (a, b) => a.length === b.length && a.every((tab, i) => tab === b[i]),
	});
	const activeTab = linkedSignal<RibbonContextualTabId[], RibbonTab>({
		source: contextualTabs,
		computation: (visible, previous) =>
			resolveActiveRibbonTab<RibbonTab>(previous?.value ?? initial, visible, 'home'),
	});
	return { contextualTabs, activeTab };
}

/** True when `tab` is one of the contextual tabs (its content is gallery groups). */
export function isContextualRibbonTab(tab: RibbonTab): tab is RibbonContextualTabId {
	return RIBBON_CONTEXTUAL_TABS.some((t) => t.id === tab);
}
