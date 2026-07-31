import type { ViewerPreferences } from 'pptx-viewer-shared';
import { DEFAULT_VIEWER_PREFERENCES } from 'pptx-viewer-shared';

import { CompareController } from '../compare/compare-controller.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
import { RehearseState } from '../presentation/rehearse-state.svelte';

/** Reactive state for the optional parity dialogs and presentation tools. */
export class ViewerParityUiState {
	readonly compare: CompareController;
	readonly annotations = new PresentationAnnotations();
	readonly rehearse = new RehearseState();
	setupSlideShowOpen = $state(false);
	headerFooterOpen = $state(false);
	settingsOpen = $state(false);
	shortcutsOpen = $state(false);
	keepAnnotationsOpen = $state(false);
	printSettingsOpen = $state(false);
	subtitlesEnabled = $state(false);
	customShowsOpen = $state(false);
	selectionPaneOpen = $state(false);
	slideSorterOpen = $state(false);
	/** View tab > Reading View: the deck at full window size, not a slide show. */
	readingViewOpen = $state(false);
	showGuides = $state(false);
	snapToShape = $state(true);
	guides = $state<{ axis: 'h' | 'v'; position: number }[]>([]);
	preferences = $state<ViewerPreferences>({ ...DEFAULT_VIEWER_PREFERENCES });

	constructor(editor: EditorState) {
		this.compare = new CompareController(editor);
	}

	syncAutosave(enabled: boolean): void {
		this.preferences = { ...this.preferences, autoSave: enabled };
	}

	updatePreferences(next: ViewerPreferences, onAutosaveChange: (enabled: boolean) => void): void {
		this.preferences = next;
		onAutosaveChange(next.autoSave);
	}
}
