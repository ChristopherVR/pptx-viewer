/**
 * settings-dialog-tabs.ts: the File > Options dialog's tab list and
 * active-tab resolution, after the host's UI customisation.
 *
 * The filtering itself is the shared `customizeOptionsTabs`; this only maps a
 * requested tab id onto one that is still visible, so a hidden page can never
 * stay selected.
 */
import { VIEWER_OPTIONS_TABS } from '../internal/shared';
import type { ViewerOptionsTabDefinition, ViewerOptionsTabId } from '../internal/shared';

/** The ten File > Options categories the dialog's rail renders, in order. */
export const OPTIONS_DIALOG_TABS: readonly ViewerOptionsTabDefinition[] = VIEWER_OPTIONS_TABS;

/** Resolve the active tab definition, falling back to the first visible category. */
export function resolveOptionsTab(
	id: ViewerOptionsTabId,
	tabs: readonly ViewerOptionsTabDefinition[] = OPTIONS_DIALOG_TABS,
): ViewerOptionsTabDefinition {
	const fallback = (tabs[0] ?? OPTIONS_DIALOG_TABS[0]) as ViewerOptionsTabDefinition;
	return tabs.find((tab) => tab.id === id) ?? fallback;
}

/**
 * The tab id the dialog should show for a requested one: the request when it
 * is still visible, otherwise the first visible category (or the AI page when
 * it is the only one left).
 */
export function resolveVisibleOptionsTabId(
	requested: ViewerOptionsTabId | 'ai',
	tabs: readonly ViewerOptionsTabDefinition[],
	aiVisible: boolean,
): ViewerOptionsTabId | 'ai' {
	if (requested === 'ai' ? aiVisible : tabs.some((tab) => tab.id === requested)) {
		return requested;
	}
	return tabs[0]?.id ?? (aiVisible ? 'ai' : 'general');
}
