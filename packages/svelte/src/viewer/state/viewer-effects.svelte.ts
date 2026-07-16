import { untrack } from 'svelte';

import type { Translator } from '../../i18n/translator';
import type { EditorController } from '../editor/editor-controller.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import type { ViewerLoadDetail } from '../types';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerState } from './viewer-state.svelte';

export interface ViewerEffectsDeps {
	getSource(): Uint8Array | ArrayBuffer | null | undefined;
	getEditable(): boolean;
	getInitialSlide(): number;
	getTranslator(): Translator;
	loader: PresentationLoader;
	viewer: ViewerState;
	editor: EditorState;
	controller: EditorController;
	getOnload(): ((detail: ViewerLoadDetail) => void) | undefined;
	getOnerror(): ((message: string) => void) | undefined;
	getOnslidechange(): ((index: number) => void) | undefined;
}

/**
 * All of `PowerPointViewer`'s `$effect`-based wiring in one place: keeps
 * `editor.editable` in sync with the host prop (closing any open selection/
 * inline edit when it turns off), resets selection on slide navigation,
 * drives the load pipeline from the `source` prop, and announces
 * load/error/slide-change to the host callbacks. Extracted purely to keep
 * the component's own script under the file-size budget; runs during the
 * component's setup exactly as if inlined, since Svelte 5 effects only
 * require being registered synchronously during initialization.
 */
export function useViewerEffects(deps: ViewerEffectsDeps): void {
	$effect(() => {
		deps.editor.editable = deps.getEditable();
		if (!deps.getEditable()) {
			deps.controller.closeInline();
			deps.editor.select(null);
		}
	});

	let lastSyncedSlide = -1;
	$effect(() => {
		const index = deps.viewer.current;
		if (index !== lastSyncedSlide) {
			lastSyncedSlide = index;
			untrack(() => {
				deps.controller.closeInline();
				deps.editor.select(null);
			});
		}
	});

	$effect(() => {
		const raw = deps.getSource();
		if (raw) {
			// untrack: load()'s synchronous prefix reads loader state (e.g. the
			// previous handler); without this the effect would re-run, and
			// re-load, every time a load commits.
			untrack(() => void deps.loader.load(raw));
		}
	});

	let announcedLoadCount = 0;
	$effect(() => {
		const count = deps.loader.loadCount;
		if (count > 0 && count !== announcedLoadCount) {
			announcedLoadCount = count;
			deps.viewer.reset(deps.loader.slides.length, deps.getInitialSlide());
			// Seed the editable slide array from the freshly-loaded presentation.
			untrack(() =>
				deps.editor.setSlides(
					deps.loader.slides,
					deps.loader.slideMasters,
					deps.loader.notesMaster,
					deps.loader.handoutMaster,
					deps.loader.sections,
				),
			);
			deps.getOnload()?.({
				slideCount: deps.loader.slides.length,
				canvasSize: deps.loader.canvasSize,
			});
		}
	});

	let announcedError: string | null = null;
	$effect(() => {
		const t = deps.getTranslator();
		const message = deps.loader.isEncrypted ? t('pptx.encryptedFile.message') : deps.loader.error;
		if (message && message !== announcedError) {
			announcedError = message;
			deps.getOnerror()?.(message);
		}
	});

	let announcedSlide = -1;
	$effect(() => {
		const index = deps.viewer.current;
		if (deps.loader.loadCount > 0 && index !== announcedSlide) {
			announcedSlide = index;
			deps.getOnslidechange()?.(index);
		}
	});
}
