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
			store.set({
				slides: partition.slides,
				sections: loaded.sections,
				coreProperties: loaded.coreProperties,
				appProperties: loaded.appProperties,
				customProperties: loaded.customProperties,
				embeddedFonts: loaded.embeddedFonts,
				hasDigitalSignatures: loaded.hasDigitalSignatures,
				digitalSignatureCount: loaded.digitalSignatureCount,
				isPasswordProtected: loaded.isPasswordProtected,
				templateElementsBySlideId: partition.templateElementsBySlideId,
				slideMasters: loaded.slideMasters,
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
				tableStyleMap: loaded.tableStyleMap,
				currentSlide: clampSlideIndex(options.initialSlide ?? 0, partition.slides.length),
				loading: false,
			});
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
