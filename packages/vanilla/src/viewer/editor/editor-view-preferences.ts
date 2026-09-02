/**
 * editor-view-preferences.ts: deck view-preferences seeding + write-back for
 * the vanilla binding.
 *
 * Wraps the shared `viewer-preferences` decision functions (CLAUDE.md Rule 2:
 * shared decides, this file only maps `ViewerState`'s three round-trippable
 * toggles onto the descriptor and back). `showGrid` / `showRulers` are
 * viewer-local UI prefs with no `p:viewPr` equivalent and are passed through
 * untouched; only `snapToGrid`, `showGuides`, and vanilla's `snapToShape`
 * (== OOXML `snapToObjects`, "snap to other shapes") round-trip through
 * `ppt/viewProps.xml`.
 */
import type { PptxViewProperties } from 'pptx-viewer-core';
import type { DeckViewPreferences } from 'pptx-viewer-shared';
import {
	viewerPreferencesFromViewProperties,
	viewPropertiesPatchFromPreferences,
} from 'pptx-viewer-shared';

import type { ViewerState } from '../state';

/** The `ViewerState` view-toggle keys that round-trip through `p:viewPr`. */
export type DeckViewToggleOption = 'showGuides' | 'snapToGrid' | 'snapToShape';

const DECK_VIEW_TOGGLE_OPTIONS: ReadonlySet<string> = new Set<DeckViewToggleOption>([
	'showGuides',
	'snapToGrid',
	'snapToShape',
]);

export function isDeckViewToggleOption(option: string): option is DeckViewToggleOption {
	return DECK_VIEW_TOGGLE_OPTIONS.has(option);
}

type ToggleState = Pick<
	ViewerState,
	'showGrid' | 'showRulers' | 'snapToGrid' | 'snapToShape' | 'showGuides'
>;

function toDeckViewPreferences(state: ToggleState): DeckViewPreferences {
	return {
		// Not round-tripped through `p:viewPr`; carried through unchanged.
		autoSave: true,
		spellCheck: false,
		reducedMotion: false,
		showGrid: state.showGrid,
		showRulers: state.showRulers,
		snapToGrid: state.snapToGrid,
		snapToObjects: state.snapToShape,
		showGuides: state.showGuides,
	};
}

/**
 * Seed `snapToGrid` / `showGuides` / `snapToShape` from a freshly loaded
 * deck's `ppt/viewProps.xml`, falling back to the current state for anything
 * the file didn't author.
 */
export function seedDeckViewPreferences(
	state: ToggleState,
	viewProperties: PptxViewProperties | undefined,
): Pick<ViewerState, 'snapToGrid' | 'snapToShape' | 'showGuides'> {
	const seeded = viewerPreferencesFromViewProperties(
		{ viewProperties },
		toDeckViewPreferences(state),
	);
	return {
		snapToGrid: seeded.snapToGrid,
		snapToShape: seeded.snapToObjects ?? state.snapToShape,
		showGuides: seeded.showGuides ?? state.showGuides,
	};
}

/**
 * The `viewProperties` a `showGuides` / `snapToGrid` / `snapToShape` toggle
 * flip should write back, so a save round-trips the change into
 * `ppt/viewProps.xml`. Deliberately outside `ViewerState`'s undo history:
 * PowerPoint does not undo view toggles, and the caller commits it with a
 * plain `store.set`, not through the editor's history.
 */
export function patchViewPropertiesForToggle(
	state: ViewerState,
	option: DeckViewToggleOption,
	nextValue: boolean,
): PptxViewProperties {
	const preferences = toDeckViewPreferences({
		...state,
		[option]: nextValue,
	});
	const patch = viewPropertiesPatchFromPreferences(preferences);
	return {
		...state.viewProperties,
		slideViewPr: { ...state.viewProperties?.slideViewPr, ...patch.slideViewPr },
		...(patch.gridSpacing ? { gridSpacing: patch.gridSpacing } : {}),
	};
}
