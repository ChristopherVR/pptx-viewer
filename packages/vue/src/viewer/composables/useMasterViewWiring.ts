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
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import {
	masterViewElements,
	masterViewPseudoSlide,
	updateMasterViewElement,
} from 'pptx-viewer-shared';
import type { MasterViewDocument, MasterViewTarget } from 'pptx-viewer-shared';
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
	/** Every element the master canvas is painting, for the selection overlay. */
	activeMasterViewElements: ComputedRef<PptxElement[]>;
	onNotesMasterBackgroundChange: (backgroundColor: string) => void;
	onHandoutMasterBackgroundChange: (backgroundColor: string) => void;
	onHandoutSlidesPerPageChange: (slidesPerPage: number) => void;
	/**
	 * Write one master-view element edit back to the part that owns it. Vue was
	 * the only binding with no master-view edit affordance at all.
	 */
	onMasterViewElementUpdate: (elementId: string, patch: Partial<PptxElement>) => void;
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

	/** The document + target the shared master-view rules operate on. */
	function masterViewDocument(): MasterViewDocument {
		return {
			slideMasters: options.slideMasters.value,
			notesMaster: options.notesMaster.value,
			handoutMaster: options.handoutMaster.value,
		};
	}

	function masterViewTarget(): MasterViewTarget {
		return {
			tab: state.masterViewTab.value,
			masterIndex: state.activeMasterIndex.value,
			layoutIndex: state.activeLayoutIndex.value,
		};
	}

	const activeMasterViewSlide = computed<PptxSlide | undefined>(() =>
		masterViewPseudoSlide(masterViewDocument(), masterViewTarget()),
	);

	const activeMasterViewElements = computed<PptxElement[]>(() =>
		masterViewElements(masterViewDocument(), masterViewTarget()),
	);

	function onMasterViewElementUpdate(elementId: string, patch: Partial<PptxElement>): void {
		const write = updateMasterViewElement(
			masterViewDocument(),
			masterViewTarget(),
			elementId,
			patch,
		);
		if (!write) {
			return;
		}
		if (write.slideMasters) {
			options.slideMasters.value = write.slideMasters;
		}
		if (write.notesMaster) {
			options.notesMaster.value = write.notesMaster;
		}
		if (write.handoutMaster) {
			options.handoutMaster.value = write.handoutMaster;
		}
		options.markDirty();
	}

	return {
		...state,
		activeMasterViewSlide,
		activeMasterViewElements,
		onNotesMasterBackgroundChange,
		onHandoutMasterBackgroundChange,
		onHandoutSlidesPerPageChange,
		onMasterViewElementUpdate,
	};
}
