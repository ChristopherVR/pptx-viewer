/**
 * usePresentationControls: entering and leaving the slide show, including the
 * two variants that need extra state set up first (presenter view and
 * Rehearse Timings).
 *
 * Rehearsal is interleaved with presentation rather than layered on top of it:
 * the elapsed time for the outgoing slide has to be banked on every slide
 * change and once more on exit, so both wrappers live beside the presentation
 * lifecycle instead of in the SFC where the ordering is easy to break.
 */
import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import type { AuthoredSlideRange } from 'pptx-viewer-shared';
import {
	firstShowSlideIndex,
	presentationEntrySlideIndex,
	resolveShowSlideIndexes,
} from 'pptx-viewer-shared';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import { computed, ref } from 'vue';

import type { SlideAnnotationMap } from './usePresentationAnnotations';
import type { UsePresentationModeWiringResult } from './usePresentationModeWiring';
import { usePresentationModeWiring } from './usePresentationModeWiring';
import type { UseRehearseTimingsResult } from './useRehearseTimings';
import { useRehearseTimings } from './useRehearseTimings';

export interface UsePresentationControlsOptions {
	slides: ShallowRef<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	customShows: ShallowRef<PptxCustomShow[]>;
	/** The custom show selected in the Custom Shows panel, if any. */
	activeCustomShowId: () => string | null;
	/**
	 * The `p:showPr/p:sldRg` slide-range restriction, when the deck is authored
	 * to open into a range. A getter (evaluated lazily, same as
	 * `activeCustomShowId`) so it may be declared after this composable in the
	 * host SFC.
	 */
	authoredRange?: () => AuthoredSlideRange | null | undefined;
	pushHistory: () => void;
}

export interface UsePresentationControlsResult extends Pick<
	UsePresentationModeWiringResult,
	'presenting'
> {
	rehearsal: UseRehearseTimingsResult;
	/** True when the show should open directly in presenter view. */
	startInPresenterView: Ref<boolean>;
	/**
	 * Enter the show "From Current Slide": the active slide when the show
	 * includes it, otherwise the nearest show slide
	 * (`presentationEntrySlideIndex`). Every entry point but "From Beginning"
	 * uses this.
	 */
	startPresenting: () => void;
	/** Enter the show "From Beginning": the show's first slide, unconditionally. */
	presentFromBeginning: () => void;
	startPresenterView: () => void;
	startRehearsal: () => void;
	closePresentation: (payload?: { annotations: SlideAnnotationMap }) => void;
	handlePresentSlideChange: (index: number) => void;
	/**
	 * The custom show a running slide show should follow, or null for the whole
	 * deck. Passed to `PresentationMode` so playback honours the selected show's
	 * membership and order, not just its dialog.
	 */
	activePresentationCustomShow: ComputedRef<PptxCustomShow | null>;
	/**
	 * Which deck index the show should open on, resolved by `startPresenting` /
	 * `presentFromBeginning` at the moment the show is entered. Fed to
	 * `PresentationMode`'s `startIndex` instead of the raw active slide, so a
	 * show authored into a range (or a custom show) never opens on a slide it
	 * does not include.
	 */
	presentationStartIndex: Ref<number>;
}

export function usePresentationControls(
	options: UsePresentationControlsOptions,
): UsePresentationControlsResult {
	const { slides, activeSlideIndex, pushHistory } = options;

	const {
		presenting,
		startPresenting: enterPresentationMode,
		onPresentClose,
		onPresentSlideChange,
	} = usePresentationModeWiring({ slides, activeSlideIndex, pushHistory });

	const startInPresenterView = ref(false);
	const presentationStartIndex = ref(activeSlideIndex.value);

	const activePresentationCustomShow = computed(
		() =>
			options.customShows.value.find((show) => show.id === options.activeCustomShowId()) ?? null,
	);

	/** Deck indexes the running show visits, honouring the custom show + authored range. */
	const showIndexes = computed(() =>
		resolveShowSlideIndexes(
			slides.value,
			activePresentationCustomShow.value,
			options.authoredRange?.() ?? null,
		),
	);

	/** "From Current Slide": every entry point but the explicit "From Beginning" command. */
	function startPresenting(): void {
		presentationStartIndex.value = presentationEntrySlideIndex(
			activeSlideIndex.value,
			showIndexes.value,
		);
		enterPresentationMode();
	}

	/** "From Beginning" (ribbon Start group, Slide Show search command, quick access). */
	function presentFromBeginning(): void {
		presentationStartIndex.value = firstShowSlideIndex(showIndexes.value) ?? activeSlideIndex.value;
		enterPresentationMode();
	}

	const rehearsal = useRehearseTimings({
		onSave: (timings) => {
			pushHistory();
			slides.value = slides.value.map((slide, index) => {
				const advanceAfterMs = timings[index];
				return typeof advanceAfterMs !== 'number'
					? slide
					: {
							...slide,
							transition: {
								...slide.transition,
								type: slide.transition?.type ?? 'none',
								advanceAfterMs,
							},
						};
			});
		},
	});

	function startPresenterView(): void {
		startInPresenterView.value = true;
		startPresenting();
	}

	function startRehearsal(): void {
		startInPresenterView.value = false;
		rehearsal.start();
		startPresenting();
	}

	function closePresentation(payload?: { annotations: SlideAnnotationMap }): void {
		if (rehearsal.rehearsing.value) {
			rehearsal.recordCurrentSlideTime(activeSlideIndex.value);
			rehearsal.finish();
		}
		onPresentClose(payload);
		startInPresenterView.value = false;
	}

	function handlePresentSlideChange(index: number): void {
		if (rehearsal.rehearsing.value) {
			rehearsal.recordCurrentSlideTime(activeSlideIndex.value);
		}
		onPresentSlideChange(index);
	}

	return {
		presenting,
		startPresenting,
		presentFromBeginning,
		rehearsal,
		startInPresenterView,
		startPresenterView,
		startRehearsal,
		closePresentation,
		handlePresentSlideChange,
		activePresentationCustomShow,
		presentationStartIndex,
	};
}
