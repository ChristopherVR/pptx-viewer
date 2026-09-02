import type { PptxViewProperties } from 'pptx-viewer-core';
import type { DeckViewPreferences } from 'pptx-viewer-shared';
import {
	viewerPreferencesFromViewProperties,
	viewPropertiesPatchFromPreferences,
} from 'pptx-viewer-shared';
import { watch } from 'vue';
import type { Ref } from 'vue';

/**
 * useDeckViewPreferencesSync: seed the View-tab snap/guide toggles from a
 * loaded deck's `ppt/viewProps.xml`, and write user changes back to it so a
 * save round-trips them.
 *
 * Vue's toggles already live in `useSnapGuides` (`snapToShape`/`snapToGrid`)
 * and `useRibbonUiState` (`showGuides`); this composable is a thin sync layer
 * between those and `data.viewProperties`, not a new store. Grid spacing
 * (`gridSpacingCx`/`Cy`) has no user-facing control in this binding yet (the
 * View-tab has no "set grid spacing" input), so it round-trips read-only
 * through `gridSpacingPx` (`computeGridSpacingPx`) elsewhere; this composable
 * still carries the deck's current grid spacing through every write-back so
 * it is not lost.
 *
 * Deliberately kept OUT of the undo stack: PowerPoint does not undo View-tab
 * toggles, so this never calls `pushHistory`.
 */
export interface UseDeckViewPreferencesSyncInput {
	/** `useLoadContent().viewProperties`, the write target for a save round-trip. */
	viewProperties: Ref<PptxViewProperties | undefined>;
	/** Bumped once per completed load (`useLoadContent`'s `onContentApplied`). */
	loadVersion: Ref<number>;
	/** `useSnapGuides().snapToGrid`. */
	snapToGrid: Ref<boolean>;
	/** `useSnapGuides().snapToShape` (shared's `snapToObjects`). */
	snapToObjects: Ref<boolean>;
	/** `useRibbonUiState().showGuides`. */
	showGuides: Ref<boolean>;
}

/** Placeholders for the `ViewerPreferences` fields this sync does not own. */
const UNMANAGED_DEFAULTS = {
	autoSave: false,
	spellCheck: false,
	showGrid: false,
	showRulers: false,
	reducedMotion: false,
} as const;

export function useDeckViewPreferencesSync(input: UseDeckViewPreferencesSyncInput): void {
	const { viewProperties, loadVersion, snapToGrid, snapToObjects, showGuides } = input;
	let suppressWriteback = false;

	function seed(): void {
		const defaults: DeckViewPreferences = {
			...UNMANAGED_DEFAULTS,
			snapToGrid: snapToGrid.value,
			snapToObjects: snapToObjects.value,
			showGuides: showGuides.value,
		};
		const seeded = viewerPreferencesFromViewProperties(
			{ viewProperties: viewProperties.value },
			defaults,
		);
		suppressWriteback = true;
		snapToGrid.value = seeded.snapToGrid;
		snapToObjects.value = seeded.snapToObjects ?? false;
		showGuides.value = seeded.showGuides ?? false;
		suppressWriteback = false;
	}

	function writeBack(): void {
		if (suppressWriteback) {
			return;
		}
		const patch = viewPropertiesPatchFromPreferences({
			...UNMANAGED_DEFAULTS,
			snapToGrid: snapToGrid.value,
			snapToObjects: snapToObjects.value,
			showGuides: showGuides.value,
			gridSpacingCx: viewProperties.value?.gridSpacing?.cx,
			gridSpacingCy: viewProperties.value?.gridSpacing?.cy,
		});
		viewProperties.value = {
			...viewProperties.value,
			slideViewPr: { ...viewProperties.value?.slideViewPr, ...patch.slideViewPr },
			...(patch.gridSpacing ? { gridSpacing: patch.gridSpacing } : {}),
		};
	}

	watch(loadVersion, seed, { immediate: true });
	// `flush: 'sync'` so this fires INSIDE `seed()`'s synchronous ref writes,
	// while `suppressWriteback` is still true; the default (batched, next-tick)
	// flush would run after `seed()` already reset the flag and write the
	// just-seeded values straight back as if the user had changed them.
	watch([snapToGrid, snapToObjects, showGuides], writeBack, { flush: 'sync' });
}
