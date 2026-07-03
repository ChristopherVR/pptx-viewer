import { ref } from 'vue';
import type { Ref } from 'vue';

import { DEFAULT_VIEWER_SETTINGS } from '../components/viewer-settings';
import type { ViewerSettings } from '../components/viewer-settings';

export interface UseViewerSettingsDialogResult {
	showSettings: Ref<boolean>;
	viewerSettings: Ref<ViewerSettings>;
	onSettingsUpdate: (next: ViewerSettings) => void;
}

/**
 * useViewerSettingsDialog: File ▸ Settings dialog (general viewer
 * preferences). Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useViewerSettingsDialog(): UseViewerSettingsDialogResult {
	const showSettings = ref(false);
	const viewerSettings = ref<ViewerSettings>({ ...DEFAULT_VIEWER_SETTINGS });
	function onSettingsUpdate(next: ViewerSettings): void {
		viewerSettings.value = next;
	}

	return { showSettings, viewerSettings, onSettingsUpdate };
}
