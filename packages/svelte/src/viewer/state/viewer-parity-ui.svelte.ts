import type { DeckViewPreferences, Guide } from 'pptx-viewer-shared';
import { DEFAULT_VIEWER_PREFERENCES } from 'pptx-viewer-shared';

import { CompareController } from '../compare/compare-controller.svelte';
import { PresentToolbarChrome } from '../components/presentation-toolbar.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
import { RehearseState } from '../presentation/rehearse-state.svelte';

/** Reactive state for the optional parity dialogs and presentation tools. */
export class ViewerParityUiState {
	readonly compare: CompareController;
	readonly annotations = new PresentationAnnotations();
	/**
	 * The show toolbar's fade/auto-hide state. It lives here, not inside
	 * `PresentationToolbar.svelte`, because PowerPoint's Ctrl+H toggles the show
	 * chrome from the keyboard handler, which is nowhere near that component: a
	 * second visibility flag over there would be overwritten by the next mouse
	 * move, so the shortcut and the countdown share this one.
	 */
	readonly showChrome = new PresentToolbarChrome();
	/** PowerPoint's Ctrl+S "See All Slides" grid, over the running show. */
	allSlidesOpen = $state(false);
	/**
	 * Slide-show right-click menu position, or null when closed. Shown while
	 * presenting when Options > Advanced > "Show menu on right mouse click" is
	 * on.
	 */
	presentationContextMenu = $state<{ x: number; y: number } | null>(null);
	readonly rehearse = new RehearseState();
	setupSlideShowOpen = $state(false);
	headerFooterOpen = $state(false);
	settingsOpen = $state(false);
	shortcutsOpen = $state(false);
	keepAnnotationsOpen = $state(false);
	printSettingsOpen = $state(false);
	subtitlesEnabled = $state(false);
	customShowsOpen = $state(false);
	/**
	 * The custom show a started slide show is restricted to, or null for the
	 * whole deck. Shows were definable and persisted here, but nothing held an
	 * active one, so selecting a show changed nothing about what presented.
	 *
	 * A playback choice for this session, not an edit: it deliberately does NOT
	 * live on `EditorPresentationMetadata`, so selecting a show neither enters
	 * the undo history nor marks the document dirty.
	 */
	activeCustomShowId = $state<string | null>(null);
	selectionPaneOpen = $state(false);
	slideSorterOpen = $state(false);
	/** View tab > Reading View: the deck at full window size, not a slide show. */
	readingViewOpen = $state(false);
	/** View tab > Outline View: the deck as one editable indented text document. */
	outlineViewOpen = $state(false);
	/** View > H/V Guides. Also seeded from the deck's `slideViewPr/@showGuides`. */
	showGuides = $state(false);
	/**
	 * "Snap to shape" (View ▸ Snap Objects to Other Objects): the on-drag
	 * alignment-guide snap. Also seeded from the deck's
	 * `slideViewPr/@snapToObjects` (shared's `DeckViewPreferences.snapToObjects`
	 * field; this binding's own historical name for the same toggle).
	 */
	snapToShape = $state(true);
	guides = $state<Guide[]>([]);
	/**
	 * Also carries the deck-authored `snapToObjects`/`showGuides`/
	 * `gridSpacingCx`/`gridSpacingCy` fields (`DeckViewPreferences`, a superset
	 * of the base `ViewerPreferences` toggles), even though `showGuides` and
	 * `snapToShape` above are the fields this binding actually reads: keeping
	 * them here too is what lets `viewerPreferencesFromViewProperties` seed (and
	 * `viewPropertiesPatchFromPreferences` later read back) a single object.
	 */
	preferences = $state<DeckViewPreferences>({ ...DEFAULT_VIEWER_PREFERENCES });

	constructor(editor: EditorState) {
		this.compare = new CompareController(editor);
	}

	syncAutosave(enabled: boolean): void {
		this.preferences = { ...this.preferences, autoSave: enabled };
	}

	updatePreferences(next: DeckViewPreferences, onAutosaveChange: (enabled: boolean) => void): void {
		this.preferences = next;
		onAutosaveChange(next.autoSave);
	}
}
