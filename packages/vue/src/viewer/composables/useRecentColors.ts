/**
 * useRecentColors: the deck's "Recent colours" (`p:clrMru`) row, seeded from
 * the loaded deck and folded forward as the user picks colours.
 *
 * `PptxPresentationProperties.mruColors` already round-trips (parsed from
 * `p:presentationPr/p:clrMru`, written back the same way); this composable is
 * the piece that actually reads and writes it. The write-back happens OUTSIDE
 * the undo stack, the same way the view-preferences (grid/snap) writes do:
 * picking a colour is not itself an edit worth an undo step, and undoing a
 * shape edit should not also un-remember the colour it used.
 */
import type { PptxPresentationProperties } from 'pptx-viewer-core';
import { mruColorsPatch, pushRecentColor, seedRecentColors } from 'pptx-viewer-shared';
import { ref, watch } from 'vue';
import type { Ref } from 'vue';

export interface UseRecentColorsInput {
	presentationProperties: Ref<PptxPresentationProperties>;
	/**
	 * Bumped once per fresh document load (`PowerPointViewer.vue`'s
	 * `loadVersion`). Re-seeds `recent` from the newly loaded deck's own
	 * `mruColors` instead of carrying the previous document's list over.
	 */
	loadVersion?: Ref<number>;
}

export interface UseRecentColorsResult {
	/** Most-recent-first list of `#RRGGBB` colours, capped at `RECENT_COLOR_LIMIT`. */
	recent: Ref<string[]>;
	/**
	 * Fold a newly picked colour into `recent` and persist it onto
	 * `presentationProperties.mruColors`. A no-op for anything that is not a
	 * plain 6-digit hex colour (a named colour, `rgb(...)`, a gradient stop
	 * picked mid-drag before it resolves, etc.).
	 */
	push: (hex: string) => void;
}

export function useRecentColors(input: UseRecentColorsInput): UseRecentColorsResult {
	const recent = ref<string[]>(seedRecentColors(input.presentationProperties.value));

	if (input.loadVersion) {
		// `flush: 'sync'`: a fresh load also flips several OTHER refs synchronously
		// in the same tick (`presentationProperties` included); reading `recent`
		// between that write and the default batched flush would still show the
		// previous document's list.
		watch(
			input.loadVersion,
			() => {
				recent.value = seedRecentColors(input.presentationProperties.value);
			},
			{ flush: 'sync' },
		);
	}

	function push(hex: string): void {
		const next = pushRecentColor(recent.value, hex);
		if (next === recent.value) {
			return;
		}
		recent.value = next;
		input.presentationProperties.value = {
			...input.presentationProperties.value,
			...mruColorsPatch(next),
		};
	}

	return { recent, push };
}
