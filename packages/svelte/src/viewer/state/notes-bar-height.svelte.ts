/**
 * Live height of the docked "Speaker notes" strip, handed from `NotesPanel`
 * (which renders it) up to `PowerPointViewer` (which positions the
 * compatibility-toast stack) through a Svelte context. The view-model would
 * need the value threaded through `ViewerMain` and `ViewerBody` as well; a
 * context keeps this to the two components that actually care. Absent a
 * provider (a standalone `NotesPanel`), reporting is a no-op.
 */
import { getContext, setContext } from 'svelte';

const KEY = Symbol('pptx-svelte-notes-bar-height');

interface NotesBarHeightSink {
	report(height: number): void;
}

/** Provide the sink from `PowerPointViewer`; `height` is reactive. */
export function provideNotesBarHeight(): { readonly height: number } {
	let height = $state(0);
	setContext<NotesBarHeightSink>(KEY, {
		report(next) {
			height = next;
		},
	});
	return {
		get height() {
			return height;
		},
	};
}

/** The sink `NotesPanel` reports into, or `undefined` outside a viewer. */
export function useNotesBarHeightSink(): NotesBarHeightSink | undefined {
	return getContext<NotesBarHeightSink | undefined>(KEY);
}
