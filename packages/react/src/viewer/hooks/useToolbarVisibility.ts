/**
 * useToolbarVisibility: derives per-action and per-tab visibility from the
 * host's `hiddenActions` prop (see `PowerPointViewerProps.hiddenActions`).
 *
 * Keeps the gating logic out of the already large toolbar files
 * (`ViewerToolbarSection.tsx`, `Toolbar.tsx`, `FileSection.tsx`, etc.): each
 * of those simply calls this hook and uses `isHidden` / `isTabVisible` to
 * decide whether to render a button or ribbon tab. Delegates the actual
 * membership check to the shared `isActionHidden` helper so every binding
 * (React/Vue/Angular) agrees on what "hidden" means for a given id.
 */
import { isActionHidden, TOOLBAR_TABS } from 'pptx-viewer-shared';
import type { ToolbarActionId, ToolbarTabId } from 'pptx-viewer-shared';
import { useMemo } from 'react';

/** Every ribbon-tab id the shared catalogue knows about (for the guard below). */
const KNOWN_TAB_IDS = new Set<string>(TOOLBAR_TABS.map((tab) => tab.id));

export interface ToolbarVisibility {
	/** True when `id` is present in the host's `hiddenActions` list. */
	isHidden: (id: ToolbarActionId) => boolean;
	/**
	 * True when a ribbon-section id should render. React's local
	 * `ToolbarSection` union has two contextual ids (`text`, `arrange`) that
	 * are not part of the shared `ToolbarTabId` catalogue; those always
	 * render since hiding them is outside this feature's scope.
	 */
	isTabVisible: (id: string) => boolean;
}

/**
 * Pure derivation, extracted from the hook so it can be unit-tested without
 * a React renderer (matches the convention used by the other small
 * derivation hooks in this directory).
 */
export function computeToolbarVisibility(
	hiddenActions: readonly ToolbarActionId[] | undefined,
): ToolbarVisibility {
	const isHidden = (id: ToolbarActionId): boolean => isActionHidden(id, hiddenActions);
	const isTabVisible = (id: string): boolean =>
		!KNOWN_TAB_IDS.has(id) || !isHidden(id as ToolbarTabId);
	return { isHidden, isTabVisible };
}

/**
 * Builds a stable `{ isHidden, isTabVisible }` pair from the host-supplied
 * `hiddenActions` list. Recomputed only when the list reference changes.
 */
export function useToolbarVisibility(
	hiddenActions: readonly ToolbarActionId[] | undefined,
): ToolbarVisibility {
	return useMemo(() => computeToolbarVisibility(hiddenActions), [hiddenActions]);
}
