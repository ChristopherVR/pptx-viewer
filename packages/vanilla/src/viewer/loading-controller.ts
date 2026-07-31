import type { PptxHandler } from 'pptx-viewer-core';
import { EncryptedFileError } from 'pptx-viewer-core';
import { partitionTemplateElements } from 'pptx-viewer-shared';

import type { EditorController } from './editor';
import type { Translator } from './i18n';
import type { PptxViewerSource } from './load';
import { loadPresentation, resolveSourceToBuffer, revokeBlobUrls } from './load';
import { clampSlideIndex } from './state';
import type { Store, ViewerState } from './state';
import type { PptxViewerOptions } from './types';

export interface LoadingControllerDeps {
	options: PptxViewerOptions;
	store: Store<ViewerState>;
	getTranslator(): Translator;
	getEditor(): EditorController | undefined;
	/**
	 * Called synchronously right before a successfully parsed deck is committed
	 * to the store. The store notifies subscribers synchronously, so this is the
	 * only point where a collaboration session can suppress publishing the
	 * about-to-land slides into the shared doc ahead of the adoption check in
	 * `onContentApplied` (late-joiner bootstrap protection).
	 */
	onContentApplying?: () => void;
	/** Called synchronously right after a parsed deck was applied to the store. */
	onContentApplied?: () => void;
}

export interface LoadingController {
	load(source: PptxViewerSource): Promise<void>;
	/** Dispose the current handler + Blob URLs (before replacing or on destroy). */
	releaseLoaded(): void;
	getHandler(): PptxHandler | null;
	/** Invalidate any in-flight load so it discards its result on resolution. */
	invalidate(): void;
}

/**
 * Owns the `.pptx` load lifecycle (fetch/parse, stale-load token, handler +
 * Blob URL disposal). Extracted from `PptxViewer` so the class stays under
 * the file-size budget; holds its own private mutable state rather than
 * reaching back into the viewer instance.
 */
export function createLoadingController(deps: LoadingControllerDeps): LoadingController {
	const { options, store } = deps;
	let handler: PptxHandler | null = null;
	let blobUrls: string[] = [];
	let loadToken = 0;

	function releaseLoaded(): void {
		revokeBlobUrls(blobUrls);
		revokeBlobUrls(store.get().mediaDataUrls.values());
		blobUrls = [];
		handler?.dispose();
		handler = null;
	}

	async function load(source: PptxViewerSource): Promise<void> {
		const token = ++loadToken;
		deps.getEditor()?.reset();
		store.set({ loading: true, error: null });
		try {
			const buffer = await resolveSourceToBuffer(source);
			const loaded = await loadPresentation(buffer);
			if (token !== loadToken) {
				revokeBlobUrls(loaded.blobUrls);
				loaded.handler.dispose();
				return;
			}
			releaseLoaded();
			handler = loaded.handler;
			blobUrls = loaded.blobUrls;
			const partition = partitionTemplateElements(loaded.slides);
			deps.onContentApplying?.();
			store.set({
				slides: partition.slides,
				sections: loaded.sections,
				presentationProperties: loaded.presentationProperties,
				headerFooter: loaded.headerFooter,
				coreProperties: loaded.coreProperties,
				appProperties: loaded.appProperties,
				customProperties: loaded.customProperties,
				customShows: loaded.customShows,
				embeddedFonts: loaded.embeddedFonts,
				hasDigitalSignatures: loaded.hasDigitalSignatures,
				digitalSignatureCount: loaded.digitalSignatureCount,
				isPasswordProtected: loaded.isPasswordProtected,
				templateElementsBySlideId: partition.templateElementsBySlideId,
				slideMasters: loaded.slideMasters,
				themeOptions: loaded.themeOptions,
				notesMaster: loaded.notesMaster,
				notesCanvasSize: loaded.notesCanvasSize,
				handoutMaster: loaded.handoutMaster,
				hasMacros: loaded.hasMacros,
				masterViewTab: 'slides',
				handoutSlidesPerPage: loaded.handoutMaster?.slidesPerPage ?? 4,
				masterViewTarget: null,
				canvasSize: loaded.canvasSize,
				mediaDataUrls: loaded.mediaDataUrls,
				colorScheme: loaded.colorScheme,
				fontScheme: loaded.fontScheme,
				themeName: loaded.themeName,
				tagCollections: loaded.tagCollections,
				tableStyleMap: loaded.tableStyleMap,
				currentSlide: clampSlideIndex(options.initialSlide ?? 0, partition.slides.length),
				loading: false,
			});
			deps.onContentApplied?.();
			options.onLoad?.({ slideCount: loaded.slides.length, canvasSize: loaded.canvasSize });
		} catch (error) {
			if (token !== loadToken) {
				return;
			}
			const t = deps.getTranslator();
			const message =
				error instanceof EncryptedFileError
					? t('pptx.security.currentlyProtected')
					: error instanceof Error
						? error.message
						: String(error);
			store.set({ loading: false, error: message });
			options.onError?.(message, error);
		}
	}

	return {
		load,
		releaseLoaded,
		getHandler: () => handler,
		invalidate: () => {
			loadToken++;
		},
	};
}
