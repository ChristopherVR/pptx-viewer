/**
 * mobile-bar-sheet-tap.ts: the mobile bottom bar's tap-to-toggle decision,
 * shared across bindings via `toggleSheet` (`pptx-viewer-shared`).
 *
 * Angular splits the "active sheet" concept across two pre-existing services
 * (`ViewerMobileSheetService` for slides/notes, `ViewerInspectorPanelService`
 * for the format/comments panel), so there is no single ref to toggle the
 * way Svelte/Vanilla do. This module keeps the PRIORITY DECISION itself
 * (`toggleSheet`, imported through `./mobile-chrome-helpers` like the rest of
 * this binding's mobile chrome) in one place, and leaves the actual
 * open/close side effects to the caller (`PowerPointViewerComponent`), which
 * alone knows how to drive both services.
 */
import type { MobileBarSheet } from './mobile-bottom-bar.component';
import { toggleSheet } from './mobile-chrome-helpers';

/** The open/close side effects for one bottom-bar tap, supplied by the caller. */
export interface MobileBarSheetActions {
	openSlides: () => void;
	openInspector: () => void;
	openComments: () => void;
	openNotes: () => void;
	/** Close every sheet across both backing services before opening the next one. */
	closeAll: () => void;
}

/**
 * Apply a bottom-bar tap: decide the next sheet with shared's `toggleSheet`
 * (tapping the open sheet closes it, tapping a different one switches to
 * it), then close everything and open whatever `toggleSheet` decided, if
 * anything.
 */
export function applyMobileBarSheetTap(
	tapped: Exclude<MobileBarSheet, null>,
	current: MobileBarSheet,
	actions: MobileBarSheetActions,
): void {
	const next = toggleSheet(current, tapped);
	actions.closeAll();
	switch (next) {
		case 'slides':
			actions.openSlides();
			break;
		case 'inspector':
			actions.openInspector();
			break;
		case 'comments':
			actions.openComments();
			break;
		case 'notes':
			actions.openNotes();
			break;
	}
}
