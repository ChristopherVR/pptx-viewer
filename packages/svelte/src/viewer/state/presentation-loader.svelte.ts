import type {
	ParsedTableStyleMap,
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';
import { EncryptedFileError, PptxHandler } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from 'pptx-viewer-shared';

import { resolveLazyImages, resolveMediaUrls, revokeBlobUrls } from './loader-helpers';

/**
 * Reactive load pipeline for the Svelte viewer: the runes port of the Vue
 * `useLoadContent` composable's viewer subset.
 *
 * All heavy lifting (ZIP, XML parse, theme/master/layout resolution, chart
 * enrichment via `PptxSlideLoaderService.enrichChartData`) happens inside
 * `PptxHandler.load` in `pptx-viewer-core`; this class only wires the async
 * load into Svelte reactivity and manages Blob-URL / handler lifecycle.
 */
export class PresentationLoader {
	/** Parsed slides with lazily-loaded image URLs patched in. */
	slides = $state.raw<PptxSlide[]>([]);
	/** Parsed slide-master hierarchy for the dedicated master workspace. */
	slideMasters = $state.raw<PptxSlideMaster[]>([]);
	notesMaster = $state.raw<PptxNotesMaster | undefined>(undefined);
	handoutMaster = $state.raw<PptxHandoutMaster | undefined>(undefined);
	sections = $state.raw<PptxSection[]>([]);
	coreProperties = $state.raw<PptxCoreProperties | undefined>(undefined);
	appProperties = $state.raw<PptxAppProperties | undefined>(undefined);
	customProperties = $state.raw<PptxCustomProperty[]>([]);
	/** Whether the loaded package contains a VBA project. */
	hasMacros = $state(false);
	notesCanvasSize = $state.raw<CanvasSize | undefined>(undefined);
	/** Slide canvas size in pixels. */
	canvasSize = $state.raw<CanvasSize>({
		width: DEFAULT_CANVAS_WIDTH,
		height: DEFAULT_CANVAS_HEIGHT,
	});
	/** Archive-path -> displayable URL map for media + poster frames. */
	mediaDataUrls = $state.raw<Map<string, string>>(new Map());
	/** Presentation theme colours used to resolve scheme-based table styles. */
	colorScheme = $state.raw<PptxThemeColorScheme | undefined>(undefined);
	/** Parsed presentation table-style definitions keyed by style id. */
	tableStyleMap = $state.raw<ParsedTableStyleMap | undefined>(undefined);
	/** True while a load is in flight. */
	loading = $state(false);
	/** Error message from the last failed load, or null. */
	error = $state<string | null>(null);
	/** True when the file is password-protected and could not be opened. */
	isEncrypted = $state(false);
	/** The live `PptxHandler` for the loaded file (or null). */
	handler = $state.raw<PptxHandler | null>(null);
	/** Incremented after each successful load (drives `load` callbacks). */
	loadCount = $state(0);

	#renderToken = 0;
	#activeBlobUrls: string[] = [];

	/** Parse a `.pptx` buffer into reactive viewer state. */
	async load(raw: Uint8Array | ArrayBuffer): Promise<void> {
		const token = ++this.#renderToken;
		const loadBlobUrls: string[] = [];

		try {
			this.loading = true;
			this.error = null;
			this.isEncrypted = false;

			const buffer =
				raw instanceof Uint8Array
					? raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
					: raw;

			// Keep the previous handler alive until the new load resolves so
			// in-flight Blob URLs are not yanked mid-paint.
			const previousHandler = this.handler;

			const newHandler = new PptxHandler();
			const parsed = await newHandler.load(buffer as ArrayBuffer);
			if (token !== this.#renderToken) {
				newHandler.dispose();
				return;
			}
			previousHandler?.dispose();

			// Audio/video Blob URLs + poster frames, then lazy picture URLs.
			revokeBlobUrls(this.mediaDataUrls.values());
			const media = await resolveMediaUrls(newHandler, parsed.slides);
			loadBlobUrls.push(...media.blobUrls);
			const nextSlides = await resolveLazyImages(newHandler, parsed.slides);

			// Commit reactive state.
			revokeBlobUrls(this.#activeBlobUrls);
			this.#activeBlobUrls = loadBlobUrls;
			this.handler = newHandler;
			this.slides = nextSlides;
			this.slideMasters = parsed.slideMasters ?? [];
			this.notesMaster = parsed.notesMaster;
			this.handoutMaster = parsed.handoutMaster;
			this.sections = parsed.sections ?? [];
			this.coreProperties = parsed.coreProperties;
			this.appProperties = parsed.appProperties;
			this.customProperties = parsed.customProperties ?? [];
			this.hasMacros = parsed.hasMacros ?? false;
			this.notesCanvasSize =
				parsed.notesWidthEmu && parsed.notesHeightEmu
					? { width: parsed.notesWidthEmu / 9525, height: parsed.notesHeightEmu / 9525 }
					: undefined;
			this.mediaDataUrls = media.urls;
			this.colorScheme = parsed.theme?.colorScheme;
			this.tableStyleMap = parsed.tableStyleMap;
			this.canvasSize = {
				width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
				height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
			};
			this.loadCount += 1;
		} catch (err) {
			if (token === this.#renderToken) {
				if (err instanceof EncryptedFileError) {
					this.isEncrypted = true;
				} else {
					this.error = err instanceof Error ? err.message : String(err);
				}
			}
		} finally {
			if (token === this.#renderToken) {
				this.loading = false;
			}
		}
	}

	/** Cancel in-flight loads, revoke Blob URLs, dispose the handler. */
	dispose(): void {
		this.#renderToken++;
		revokeBlobUrls(this.#activeBlobUrls);
		this.#activeBlobUrls = [];
		revokeBlobUrls(this.mediaDataUrls.values());
		this.handler?.dispose();
		this.handler = null;
	}
}
