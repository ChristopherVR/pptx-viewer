import type { ViewerPreferences } from 'pptx-viewer-shared';
import { untrack } from 'svelte';

import type { EditorState } from '../editor/editor-state.svelte';
import type { ViewerOptionsState } from './viewer-options.svelte';
import type { ViewerParityUiState } from './viewer-parity-ui.svelte';

export interface ViewerOptionsWiringDeps {
	optionsState: ViewerOptionsState;
	parityUi: ViewerParityUiState;
	editor: EditorState;
	getAutosaveEnabled(): boolean;
	setAutosaveEnabled(enabled: boolean): void;
	/** Host `onautosavetoggle` callback (skipped for the mount-time hydration). */
	onAutosaveToggle?(enabled: boolean): void;
	getLoadCount(): number;
	/** Protected View: force the viewer read-only after a load. */
	setEditable(editable: boolean): void;
}

function preferencesEqual(a: ViewerPreferences, b: ViewerPreferences): boolean {
	return (Object.keys(a) as (keyof ViewerPreferences)[]).every((key) => a[key] === b[key]);
}

/**
 * `$effect`-based glue between the File > Options store and the legacy
 * viewer state, mirroring React's guarded bidirectional sync:
 *
 *  - options -> legacy: dialog edits (and persisted values on mount) flow
 *    into `parityUi.preferences` and the title-bar autosave toggle;
 *  - legacy -> options: the ribbon View toggles and the autosave switch flow
 *    back into the store (and thus localStorage).
 *
 * Both directions only write when a value actually differs, so the pair
 * converges instead of looping. Also threads the undo depth into the editor
 * history and applies Trust Center's Protected View on each load. Must be
 * called during component initialization (registers effects).
 */
export function useViewerOptionsWiring(deps: ViewerOptionsWiringDeps): void {
	// Options -> scattered legacy state (dialog edits, persisted values).
	let hydrated = false;
	$effect(() => {
		const mapped = deps.optionsState.preferences;
		const notify = hydrated;
		hydrated = true;
		untrack(() => {
			if (!preferencesEqual(mapped, deps.parityUi.preferences)) {
				deps.parityUi.preferences = mapped;
			}
			if (mapped.autoSave !== deps.getAutosaveEnabled()) {
				deps.setAutosaveEnabled(mapped.autoSave);
				if (notify) {
					deps.onAutosaveToggle?.(mapped.autoSave);
				}
			}
		});
	});

	// Legacy state -> options (ribbon View toggles, title-bar autosave).
	$effect(() => {
		const prefs: ViewerPreferences = {
			...deps.parityUi.preferences,
			autoSave: deps.getAutosaveEnabled(),
		};
		untrack(() => deps.optionsState.applyPreferences(prefs));
	});

	// Advanced > maximum undos -> editor history depth.
	$effect(() => {
		const depth = deps.optionsState.historyDepth;
		untrack(() => deps.editor.setHistoryDepth(depth));
	});

	// Trust Center > Protected View: each load starts read-only when enabled.
	let lastLoadCount = 0;
	$effect(() => {
		const count = deps.getLoadCount();
		if (count > 0 && count !== lastLoadCount) {
			lastLoadCount = count;
			if (untrack(() => deps.optionsState.options.trust.openInProtectedView)) {
				untrack(() => deps.setEditable(false));
			}
		}
	});
}
