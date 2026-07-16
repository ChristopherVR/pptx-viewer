import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useViewerSettingsDialog } from './useViewerSettingsDialog';

describe('useViewerSettingsDialog', () => {
	it('writes setting changes through to live viewer state', () => {
		const autoSave = ref(true);
		const spellCheck = ref(true);
		const showGrid = ref(false);
		const showRulers = ref(false);
		const snapToGrid = ref(false);
		const reducedMotion = ref(false);
		const settings = useViewerSettingsDialog({
			autoSave,
			spellCheck,
			showGrid,
			showRulers,
			snapToGrid,
			reducedMotion,
		});

		settings.onSettingsUpdate({
			autoSave: false,
			spellCheck: false,
			showGrid: true,
			showRulers: true,
			snapToGrid: true,
			reducedMotion: true,
		});

		expect(autoSave.value).toBeFalsy();
		expect(spellCheck.value).toBeFalsy();
		expect(showGrid.value).toBeTruthy();
		expect(showRulers.value).toBeTruthy();
		expect(snapToGrid.value).toBeTruthy();
		expect(reducedMotion.value).toBeTruthy();
	});
});
