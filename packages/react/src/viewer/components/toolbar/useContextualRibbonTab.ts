import type { PptxElement } from 'pptx-viewer-core';
import type { ResolvedCustomization, RibbonContextualTabId } from 'pptx-viewer-shared';
import { resolveActiveRibbonTab, visibleContextualTabs } from 'pptx-viewer-shared';
import { useEffect, useState } from 'react';

export interface ContextualRibbonTab {
	/** The contextual tabs the selection brings up, in ribbon order. */
	visible: RibbonContextualTabId[];
	/** The contextual tab being shown, or null when a fixed tab is. */
	active: RibbonContextualTabId | null;
	/** True for the one render between losing the tab and the fallback landing. */
	fellBack: boolean;
	select: (tab: RibbonContextualTabId | null) => void;
}

/**
 * Which contextual tab (Shape Format, Picture Format, ...) the ribbon shows.
 * Choosing one is local ribbon state; a fixed-tab click clears it. When the
 * selection changes so the chosen tab disappears, the shared
 * `resolveActiveRibbonTab` falls back to Home, and `onFallback` moves the
 * viewer's own section there too. Selecting an element never switches tabs
 * on its own, as in PowerPoint.
 */
export function useContextualRibbonTab(
	selectedElement: PptxElement | null | undefined,
	customization: ResolvedCustomization,
	onFallback: () => void,
): ContextualRibbonTab {
	const visible = visibleContextualTabs(selectedElement ?? null, customization);
	const [chosen, setChosen] = useState<RibbonContextualTabId | null>(null);
	const resolved = chosen ? resolveActiveRibbonTab<'home'>(chosen, visible, 'home') : null;
	const active = resolved && resolved !== 'home' ? resolved : null;
	const fellBack = chosen !== null && active === null;
	useEffect(() => {
		if (fellBack) {
			setChosen(null);
			onFallback();
		}
	}, [fellBack, onFallback]);
	return { visible, active, fellBack, select: setChosen };
}
