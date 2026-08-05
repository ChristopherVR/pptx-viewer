/**
 * usePresentationVisibilityPause - a hidden tab is a paused show.
 *
 * While the slide show is mounted, hiding the document (switching tabs,
 * minimising the window) pauses the stage's playing media, the cross-slide
 * persistent audio, and the pending auto-advance timer; everything resumes
 * when the document is visible again. The media rules live in the shared
 * `attachPresentationVisibilityPause`; this composable only ties its lifetime
 * to the presentation overlay and hands it the binding's auto-advance hooks.
 *
 * Unmounting the overlay is the show's EXIT (the host `v-if`s it on
 * `presenting`), so teardown also stops all cross-slide persistent audio: a
 * track that "plays across slides" still ends with the show, never after it.
 */
import { attachPresentationVisibilityPause, stopAllPersistentAudio } from 'pptx-viewer-shared';
import { onBeforeUnmount, onMounted } from 'vue';
import type { Ref } from 'vue';

export interface PresentationVisibilityPauseInput {
	/** The presentation overlay root; only media inside it is paused. */
	root: Ref<HTMLElement | null>;
	/** Cancel the pending auto-advance timer (the tab was hidden). */
	cancelAutoAdvance: () => void;
	/** Re-arm the auto-advance timer for the current slide (tab visible again). */
	rearmAutoAdvance: () => void;
}

export function usePresentationVisibilityPause(input: PresentationVisibilityPauseInput): void {
	let detach: (() => void) | undefined;

	onMounted(() => {
		detach = attachPresentationVisibilityPause({
			root: input.root.value ?? undefined,
			onHidden: input.cancelAutoAdvance,
			onVisible: input.rearmAutoAdvance,
		});
	});

	onBeforeUnmount(() => {
		detach?.();
		detach = undefined;
		// Presentation exit (not a slide change): cross-slide audio ends with it.
		stopAllPersistentAudio();
	});
}
