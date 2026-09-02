import { untrack } from 'svelte';

import type { Translator } from '../../i18n/translator';
import type { EditorController } from '../editor/editor-controller.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import type { ViewerLoadDetail } from '../types';
import {
	removeGoogleWebfontsLink,
	resolveWebfontHref,
	syncGoogleWebfontsLink,
} from './google-webfonts';
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
	/**
	 * Called synchronously right after a completed load is committed to editor
	 * state, before the commit's effects flush. Collaboration re-adopts the
	 * shared doc's slides here so a slow bootstrap load that lands mid-session
	 * cannot clobber content already synced from the room (and the placeholder
	 * deck is never published into the doc); the per-load session seeding that
	 * belongs to the new deck (the authored custom show) rides along.
	 */
	onContentApplied?(): void;
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
			// The host's own deck: a room that already holds slides outranks it.
			untrack(() => void deps.loader.load(raw, 'bootstrap'));
		}
	});

	let announcedLoadCount = 0;
	$effect(() => {
		const count = deps.loader.loadCount;
		if (count > 0 && count !== announcedLoadCount) {
			announcedLoadCount = count;
			deps.viewer.reset(deps.loader.slides.length, deps.getInitialSlide());
			// Seed the editable slide array from the freshly-loaded presentation.
			untrack(() => {
				deps.editor.setSlides(
					deps.loader.slides,
					deps.loader.slideMasters,
					deps.loader.notesMaster,
					deps.loader.handoutMaster,
					deps.loader.sections,
					deps.loader.coreProperties,
					deps.loader.appProperties,
					deps.loader.customProperties,
					deps.loader.headerFooter,
					deps.loader.presentationProperties,
					deps.loader.customShows,
				);
				// Seeded separately from setSlides for the same reason as the tag
				// parts below: the Home tab's font dropdown leads with the deck's
				// theme fonts and the families it embeds, neither of which is
				// content the undo stack owns.
				deps.editor.theme = deps.loader.presentationTheme;
				// Also reseeds the File > Fonts "Embed fonts" toggle: a deck that
				// arrives with embedded fonts keeps them on save, so the switch must
				// start "on" or turning it off would be the only honest position.
				deps.editor.adoptEmbeddedFontFamilies(deps.loader.embeddedFonts.map((font) => font.name));
				// Seeded separately from setSlides (which clears them) so the
				// parsed tag parts survive the load without becoming an undo step.
				deps.editor.adoptTagCollections(deps.loader.tagCollections);
				// Wave 4 B5: seed the comment @-mention typeahead's author list.
				// Read-only round-trip metadata, like `theme` above, not an undo step.
				deps.editor.modernCommentAuthors = deps.loader.modernCommentAuthors;
				deps.editor.commentAuthors = deps.loader.commentAuthors;
				// Must run before this commit's effects flush: a live collab
				// session re-adopts the shared doc's slides so the load cannot
				// clobber (or publish over) already-synced room content.
				deps.onContentApplied?.();
			});
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

	// Google-hosted webfonts for referenced families that are neither installed
	// nor embedded (Microsoft 365 "cloud fonts" have no browser equivalent);
	// the probe is session-cached, so only unseen families hit the network.
	if (typeof document !== 'undefined') {
		$effect(() => {
			let cancelled = false;
			void resolveWebfontHref(deps.loader.slides, deps.loader.embeddedFonts).then((href) => {
				if (cancelled) {
					return null;
				}
				syncGoogleWebfontsLink(document, href);
				return href;
			});
			return () => {
				cancelled = true;
				removeGoogleWebfontsLink(document);
			};
		});
	}
}
