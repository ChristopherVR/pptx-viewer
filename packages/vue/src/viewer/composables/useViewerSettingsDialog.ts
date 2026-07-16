import { ref, watch } from 'vue';
import type { Ref } from 'vue';

import { DEFAULT_VIEWER_SETTINGS } from '../components/viewer-settings';
import type { ViewerSettings } from '../components/viewer-settings';

export interface UseViewerSettingsDialogResult {
	showSettings: Ref<boolean>;
	viewerSettings: Ref<ViewerSettings>;
	onSettingsUpdate: (next: ViewerSettings) => void;
}

export interface UseViewerSettingsDialogInput {
	autoSave: Ref<boolean>;
	spellCheck: Ref<boolean>;
	showGrid: Ref<boolean>;
	showRulers: Ref<boolean>;
	snapToGrid: Ref<boolean>;
	reducedMotion: Ref<boolean>;
}

/**
 * useViewerSettingsDialog: File ▸ Settings dialog (general viewer
 * preferences). Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useViewerSettingsDialog(
	input: UseViewerSettingsDialogInput,
): UseViewerSettingsDialogResult {
	const showSettings = ref(false);
	const viewerSettings = ref<ViewerSettings>({
		...DEFAULT_VIEWER_SETTINGS,
		autoSave: input.autoSave.value,
		spellCheck: input.spellCheck.value,
		showGrid: input.showGrid.value,
		showRulers: input.showRulers.value,
		snapToGrid: input.snapToGrid.value,
		reducedMotion: input.reducedMotion.value,
	});

	watch(
		[
			input.autoSave,
			input.spellCheck,
			input.showGrid,
			input.showRulers,
			input.snapToGrid,
			input.reducedMotion,
		],
		([autoSave, spellCheck, showGrid, showRulers, snapToGrid, reducedMotion]) => {
			viewerSettings.value = {
				autoSave,
				spellCheck,
				showGrid,
				showRulers,
				snapToGrid,
				reducedMotion,
			};
		},
	);

	function onSettingsUpdate(next: ViewerSettings): void {
		viewerSettings.value = next;
		input.autoSave.value = next.autoSave;
		input.spellCheck.value = next.spellCheck;
		input.showGrid.value = next.showGrid;
		input.showRulers.value = next.showRulers;
		input.snapToGrid.value = next.snapToGrid;
		input.reducedMotion.value = next.reducedMotion;
	}

	return { showSettings, viewerSettings, onSettingsUpdate };
}
