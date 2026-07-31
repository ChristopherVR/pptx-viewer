/**
 * useMasterViewWiring: View > Master Views (slide / notes / handout masters).
 *
 * Wraps the plain tab/index state from {@link useMasterViewState} with the
 * edits the overlay can make. The notes and handout masters are edited in
 * place (they are single parts, not per-slide), so each mutation must also
 * mark the deck dirty by hand: they are not part of `slides`, which is what the
 * autosave watcher observes.
 */
import type {
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import type { ComputedRef, ShallowRef } from 'vue';
import { computed } from 'vue';

import type { UseMasterViewStateResult } from './useMasterViewState';
import { useMasterViewState } from './useMasterViewState';

export interface UseMasterViewWiringOptions {
	slideMasters: ShallowRef<PptxSlideMaster[]>;
	notesMaster: ShallowRef<PptxNotesMaster | undefined>;
	handoutMaster: ShallowRef<PptxHandoutMaster | undefined>;
	/** Flag the deck as edited; these parts sit outside the watched `slides` array. */
	markDirty: () => void;
}

export interface UseMasterViewWiringResult extends UseMasterViewStateResult {
	/**
	 * The master (optionally overlaid with the selected layout) rendered as a
	 * pseudo-slide, so the ordinary `SlideStage` can paint it.
	 */
	activeMasterViewSlide: ComputedRef<PptxSlide | undefined>;
	onNotesMasterBackgroundChange: (backgroundColor: string) => void;
	onHandoutMasterBackgroundChange: (backgroundColor: string) => void;
	onHandoutSlidesPerPageChange: (slidesPerPage: number) => void;
}

export function useMasterViewWiring(
	options: UseMasterViewWiringOptions,
): UseMasterViewWiringResult {
	const state = useMasterViewState();

	function onNotesMasterBackgroundChange(backgroundColor: string): void {
		if (!options.notesMaster.value) {
			return;
		}
		options.notesMaster.value = { ...options.notesMaster.value, backgroundColor };
		options.markDirty();
	}

	function onHandoutMasterBackgroundChange(backgroundColor: string): void {
		if (!options.handoutMaster.value) {
			return;
		}
		options.handoutMaster.value = { ...options.handoutMaster.value, backgroundColor };
		options.markDirty();
	}

	function onHandoutSlidesPerPageChange(slidesPerPage: number): void {
		state.handoutSlidesPerPage.value = slidesPerPage;
		if (options.handoutMaster.value) {
			options.handoutMaster.value = { ...options.handoutMaster.value, slidesPerPage };
			options.markDirty();
		}
	}

	const activeMasterViewSlide = computed<PptxSlide | undefined>(() => {
		const master = options.slideMasters.value[state.activeMasterIndex.value];
		if (!master) {
			return undefined;
		}
		const layout =
			state.activeLayoutIndex.value === null
				? undefined
				: master.layouts?.[state.activeLayoutIndex.value];
		return {
			id: layout?.path ?? master.path,
			rId: '',
			slideNumber: 0,
			elements: layout
				? [...(master.elements ?? []), ...(layout.elements ?? [])]
				: (master.elements ?? []),
			backgroundColor: layout?.backgroundColor ?? master.backgroundColor,
			backgroundImage: layout?.backgroundImage ?? master.backgroundImage,
		};
	});

	return {
		...state,
		activeMasterViewSlide,
		onNotesMasterBackgroundChange,
		onHandoutMasterBackgroundChange,
		onHandoutSlidesPerPageChange,
	};
}
