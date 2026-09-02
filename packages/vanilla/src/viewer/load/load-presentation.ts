import type {
	MediaPptxElement,
	ParsedTableStyleMap,
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxEmbeddedFont,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxTagCollection,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemeOption,
	PptxViewProperties,
} from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import type { CanvasSize, SlideSizeEmu } from 'pptx-viewer-shared';
import {
	applyImagePathPatches,
	collectAnimationSoundPaths,
	collectImagePaths,
	collectMediaElements,
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_CANVAS_WIDTH,
	resolveTableCellImageUrls,
	resolveTableStyleImageUrls,
} from 'pptx-viewer-shared';

/**
 * The vanilla load pipeline: parse a `.pptx` buffer with `pptx-viewer-core`'s
 * `PptxHandler` and resolve all media / picture URLs, exactly like the Vue
 * binding's `useLoadContent` (minus the framework reactivity). Chart data
 * enrichment happens inside `PptxHandler.load` (core's slide loader calls
 * `enrichChartData` for every chart), so loaded chart elements arrive
 * render-ready here too.
 */
export interface LoadedPresentation {
	/** The live handler (owns the archive; caller must `dispose()` it). */
	handler: PptxHandler;
	/** Parsed slides with image/media URLs patched in. */
	slides: PptxSlide[];
	/** Parsed presentation sections. */
	sections: PptxSection[];
	presentationProperties: PptxPresentationProperties;
	/**
	 * View properties (`ppt/viewProps.xml`, `p:viewPr`): grid spacing, snap /
	 * guide toggles, last view, splitter state, etc. `gridSpacing` lives here,
	 * NOT on `presentationProperties` -- `p:gridSpacing` is a child of
	 * `p:viewPr`, and a real PowerPoint file never populates it under
	 * `p:presentationPr`.
	 */
	viewProperties?: PptxViewProperties;
	headerFooter: PptxHeaderFooter;
	coreProperties?: PptxCoreProperties;
	appProperties?: PptxAppProperties;
	customProperties: PptxCustomProperty[];
	customShows: PptxCustomShow[];
	embeddedFonts: PptxEmbeddedFont[];
	hasDigitalSignatures: boolean;
	digitalSignatureCount: number;
	isPasswordProtected: boolean;
	/** Slide canvas size in CSS px. */
	canvasSize: CanvasSize;
	/**
	 * `p:sldSz` verbatim, in EMU. Kept even when it matches no preset so a save
	 * re-emits the authored dimensions rather than a lossy pixel round-trip.
	 */
	slideSize?: SlideSizeEmu;
	/** Archive-path to displayable URL map for media + poster frames. */
	mediaDataUrls: Map<string, string>;
	/** Presentation theme colours used by scheme-based rendering. */
	colorScheme?: PptxThemeColorScheme;
	/** Presentation theme fonts used by table-style font resolution. */
	fontScheme?: PptxThemeFontScheme;
	/** The theme part's name, seeding the inspector's THEME EDITOR card. */
	themeName?: string;
	/** Tag collections from `ppt/tags/*.xml` (inspector TAGS card). */
	tagCollections: PptxTagCollection[];
	/** Parsed presentation table styles keyed by style id. */
	tableStyleMap?: ParsedTableStyleMap;
	slideMasters: PptxSlideMaster[];
	/** Theme parts discovered in the package (inspector THEME card). */
	themeOptions: PptxThemeOption[];
	notesMaster?: PptxNotesMaster;
	handoutMaster?: PptxHandoutMaster;
	hasMacros: boolean;
	notesCanvasSize?: CanvasSize;
	/** Blob URLs created during the load; revoke them when replacing/destroying. */
	blobUrls: string[];
}

export interface LoadPresentationOptions {
	/**
	 * Trust Center > "Allow external content" (default false, matching core's
	 * own SSRF/privacy-safe default). When false, `PptxHandler.getImageData`
	 * silently drops `http(s)://` image references instead of fetching them.
	 */
	allowExternalImages?: boolean;
}

export async function loadPresentation(
	buffer: ArrayBuffer,
	options?: LoadPresentationOptions,
): Promise<LoadedPresentation> {
	const handler = new PptxHandler();
	const blobUrls: string[] = [];
	try {
		const parsed = await handler.load(buffer, {
			allowExternalImages: options?.allowExternalImages,
		});

		const getImageData = (path: string): Promise<string | undefined> => handler.getImageData(path);
		const mediaDataUrls = await resolveMediaUrls(handler, parsed.slides, blobUrls);
		const imageResolvedSlides = await resolveImageUrls(handler, parsed.slides);
		const slides = await resolveTableCellImageUrls(imageResolvedSlides, getImageData);
		const tableStyleMap = await resolveTableStyleImageUrls(parsed.tableStyleMap, getImageData);

		return {
			handler,
			slides,
			sections: parsed.sections ?? [],
			presentationProperties: parsed.presentationProperties ?? {},
			viewProperties: parsed.viewProperties,
			headerFooter: parsed.headerFooter ?? {},
			coreProperties: parsed.coreProperties,
			appProperties: parsed.appProperties,
			customProperties: parsed.customProperties ?? [],
			customShows: parsed.customShows ?? [],
			embeddedFonts: parsed.embeddedFonts ?? [],
			hasDigitalSignatures: parsed.hasDigitalSignatures ?? false,
			digitalSignatureCount: parsed.digitalSignatureCount ?? 0,
			isPasswordProtected: parsed.isPasswordProtected ?? false,
			canvasSize: {
				width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
				height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
			},
			mediaDataUrls,
			colorScheme: parsed.theme?.colorScheme,
			fontScheme: parsed.theme?.fontScheme,
			themeName: parsed.theme?.name,
			tagCollections: parsed.tags ?? [],
			tableStyleMap,
			slideMasters: parsed.slideMasters ?? [],
			themeOptions: parsed.themeOptions ?? [],
			notesMaster: parsed.notesMaster,
			handoutMaster: parsed.handoutMaster,
			hasMacros: parsed.hasMacros ?? false,
			slideSize:
				typeof parsed.widthEmu === 'number' &&
				typeof parsed.heightEmu === 'number' &&
				parsed.widthEmu > 0 &&
				parsed.heightEmu > 0
					? {
							widthEmu: parsed.widthEmu,
							heightEmu: parsed.heightEmu,
							type: parsed.slideSizeType ?? '',
						}
					: undefined,
			notesCanvasSize:
				typeof parsed.notesWidthEmu === 'number' &&
				typeof parsed.notesHeightEmu === 'number' &&
				parsed.notesWidthEmu > 0 &&
				parsed.notesHeightEmu > 0
					? {
							width: Math.round(parsed.notesWidthEmu / 9525),
							height: Math.round(parsed.notesHeightEmu / 9525),
						}
					: undefined,
			blobUrls,
		};
	} catch (error) {
		revokeBlobUrls(blobUrls);
		handler.dispose();
		throw error;
	}
}

/** Revoke every `blob:` URL in the list (safe for data: URLs, which are skipped). */
export function revokeBlobUrls(urls: Iterable<string>): void {
	for (const url of urls) {
		if (url.startsWith('blob:')) {
			URL.revokeObjectURL(url);
		}
	}
}

/** Resolve audio/video Blob URLs + poster-frame data URLs for media elements. */
async function resolveMediaUrls(
	handler: PptxHandler,
	slides: PptxSlide[],
	blobUrls: string[],
): Promise<Map<string, string>> {
	const mediaElements: MediaPptxElement[] = [];
	for (const slide of slides) {
		collectMediaElements(slide.elements, mediaElements);
	}
	const urls = new Map<string, string>();
	await Promise.all(
		mediaElements.map(async (mediaElement) => {
			const mediaPath = mediaElement.mediaPath;
			if (!mediaPath) {
				mediaElement.mediaMissing = true;
				return;
			}
			try {
				const isAudioVideo =
					mediaElement.mediaType === 'audio' || mediaElement.mediaType === 'video';
				if (isAudioVideo) {
					const arrayBuffer = await handler.getMediaArrayBuffer(mediaPath);
					if (arrayBuffer) {
						const mimeType = mediaElement.mediaMimeType || 'application/octet-stream';
						const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType }));
						blobUrls.push(blobUrl);
						urls.set(mediaPath, blobUrl);
					} else {
						mediaElement.mediaMissing = true;
					}
				} else {
					const dataUrl = await handler.getImageData(mediaPath);
					if (dataUrl) {
						urls.set(mediaPath, dataUrl);
					} else {
						mediaElement.mediaMissing = true;
					}
				}
			} catch {
				mediaElement.mediaMissing = true;
			}
		}),
	);

	// Native-animation `p:stSnd` sounds that back no visible media element
	// (PowerPoint's animation sound library) have no entry above; resolve
	// them into the same map so `onPlayActionSound`'s lookup finds them.
	const soundPaths = collectAnimationSoundPaths(slides).filter((path) => !urls.has(path));
	await Promise.all(
		soundPaths.map(async (soundPath) => {
			try {
				const arrayBuffer = await handler.getMediaArrayBuffer(soundPath);
				if (arrayBuffer) {
					const blobUrl = URL.createObjectURL(new Blob([arrayBuffer]));
					blobUrls.push(blobUrl);
					urls.set(soundPath, blobUrl);
				}
			} catch {
				/* Non-critical: the sound simply will not play. */
			}
		}),
	);
	return urls;
}

/** Resolve lazily-loaded picture URLs and patch them into the slide tree. */
async function resolveImageUrls(handler: PptxHandler, slides: PptxSlide[]): Promise<PptxSlide[]> {
	const { paths, refs } = collectImagePaths(slides);
	if (paths.size === 0) {
		return slides;
	}

	const resolvedMap = new Map<string, string>();
	await Promise.all(
		Array.from(paths).map(async (path) => {
			try {
				const url = await handler.getImageData(path);
				if (url) {
					resolvedMap.set(path, url);
				}
			} catch {
				// Non-critical: image will show as broken.
			}
		}),
	);

	return slides.map((slide) => {
		const newElements = applyImagePathPatches(slide.elements, resolvedMap, refs);
		return newElements === slide.elements ? slide : { ...slide, elements: newElements };
	});
}
