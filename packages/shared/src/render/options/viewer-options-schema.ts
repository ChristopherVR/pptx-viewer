import type { ViewerOptionsTabDefinition, ViewerOptionsTabId } from './viewer-options-controls';
import {
	ADD_INS_TAB,
	ADVANCED_TAB,
	QUICK_ACCESS_TAB,
	RIBBON_TAB,
	TRUST_TAB,
} from './viewer-options-tabs-advanced';
import {
	ACCESSIBILITY_TAB,
	GENERAL_TAB,
	LANGUAGE_TAB,
	PROOFING_TAB,
	SAVE_TAB,
} from './viewer-options-tabs-core';

/**
 * The ten File > Options categories, in PowerPoint's order. Bindings render
 * the dialog's category list and panes from this array.
 */
export const VIEWER_OPTIONS_TABS: readonly ViewerOptionsTabDefinition[] = [
	GENERAL_TAB,
	PROOFING_TAB,
	SAVE_TAB,
	LANGUAGE_TAB,
	ACCESSIBILITY_TAB,
	ADVANCED_TAB,
	RIBBON_TAB,
	QUICK_ACCESS_TAB,
	ADD_INS_TAB,
	TRUST_TAB,
];

export function getViewerOptionsTab(id: ViewerOptionsTabId): ViewerOptionsTabDefinition {
	const tab = VIEWER_OPTIONS_TABS.find((entry) => entry.id === id);
	if (!tab) {
		throw new Error(`Unknown viewer options tab: ${id}`);
	}
	return tab;
}
