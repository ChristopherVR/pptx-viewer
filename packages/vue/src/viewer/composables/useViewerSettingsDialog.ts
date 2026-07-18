import type { ViewerOptions, ViewerOptionsStore } from 'pptx-viewer-shared';
import { applyPreferenceToOptions, viewerOptionsToPreferences } from 'pptx-viewer-shared';
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
	/**
	 * The File > Options store (see `useViewerOptionsStore`). When provided, the
	 * six legacy `ViewerSettings` toggles stay the behavior source and are kept
	 * in sync with the options model both ways, mirroring React's guarded
	 * bidirectional sync in `PowerPointViewer.tsx`.
	 */
	optionsStore?: ViewerOptionsStore;
	/** Reactive snapshot of `optionsStore` (from `useViewerOptionsStore`). */
	viewerOptions?: Ref<ViewerOptions>;
}

/**
 * useViewerSettingsDialog: File > Options dialog state plus the two-way sync
 * between the full options model and the scattered legacy viewer state (the
 * six `ViewerSettings` toggles the ribbon / title bar drive directly).
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

	const legacyRefs: Record<keyof ViewerSettings, Ref<boolean>> = {
		autoSave: input.autoSave,
		spellCheck: input.spellCheck,
		showGrid: input.showGrid,
		showRulers: input.showRulers,
		snapToGrid: input.snapToGrid,
		reducedMotion: input.reducedMotion,
	};

	/** Guard so options -> legacy writes do not echo straight back into the store. */
	let syncingFromOptions = false;

	// Options -> scattered legacy state (dialog edits, persisted values). The
	// sync watchers flush synchronously so the guard flag reliably brackets the
	// legacy-ref writes an options change triggers.
	if (input.viewerOptions) {
		watch(
			input.viewerOptions,
			(next) => {
				const mapped = viewerOptionsToPreferences(next);
				syncingFromOptions = true;
				try {
					for (const key of Object.keys(mapped) as (keyof ViewerSettings)[]) {
						if (legacyRefs[key].value !== mapped[key]) {
							legacyRefs[key].value = mapped[key];
						}
					}
				} finally {
					syncingFromOptions = false;
				}
			},
			{ immediate: true, flush: 'sync' },
		);
	}

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
			const next: ViewerSettings = {
				autoSave,
				spellCheck,
				showGrid,
				showRulers,
				snapToGrid,
				reducedMotion,
			};
			viewerSettings.value = next;
			// Legacy state -> options (ribbon View toggles, title-bar autosave).
			const store = input.optionsStore;
			if (!store || syncingFromOptions) {
				return;
			}
			const current = store.getOptions();
			const mapped = viewerOptionsToPreferences(current);
			let updated = current;
			for (const key of Object.keys(mapped) as (keyof ViewerSettings)[]) {
				if (mapped[key] !== next[key]) {
					updated = applyPreferenceToOptions(updated, key, next[key]);
				}
			}
			if (updated !== current) {
				store.setOptions(updated);
			}
		},
		{ flush: 'sync' },
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
