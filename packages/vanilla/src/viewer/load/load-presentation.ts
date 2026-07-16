import type {
	MediaPptxElement,
	ParsedTableStyleMap,
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import {
	collectImagePaths,
	collectMediaElements,
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_CANVAS_WIDTH,
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
	coreProperties?: PptxCoreProperties;
	appProperties?: PptxAppProperties;
	customProperties: PptxCustomProperty[];
	/** Slide canvas size in CSS px. */
	canvasSize: CanvasSize;
	/** Archive-path to displayable URL map for media + poster frames. */
	mediaDataUrls: Map<string, string>;
	/** Presentation theme colours used by scheme-based rendering. */
	colorScheme?: PptxThemeColorScheme;
	/** Parsed presentation table styles keyed by style id. */
	tableStyleMap?: ParsedTableStyleMap;
	slideMasters: PptxSlideMaster[];
	notesMaster?: PptxNotesMaster;
	handoutMaster?: PptxHandoutMaster;
	hasMacros: boolean;
	notesCanvasSize?: CanvasSize;
	/** Blob URLs created during the load; revoke them when replacing/destroying. */
	blobUrls: string[];
}

export async function loadPresentation(buffer: ArrayBuffer): Promise<LoadedPresentation> {
	const handler = new PptxHandler();
	const blobUrls: string[] = [];
	try {
		const parsed = await handler.load(buffer);

		const mediaDataUrls = await resolveMediaUrls(handler, parsed.slides, blobUrls);
		const slides = await resolveImageUrls(handler, parsed.slides);

		return {
			handler,
			slides,
			sections: parsed.sections ?? [],
			coreProperties: parsed.coreProperties,
			appProperties: parsed.appProperties,
			customProperties: parsed.customProperties ?? [],
			canvasSize: {
				width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
				height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
			},
			mediaDataUrls,
			colorScheme: parsed.theme?.colorScheme,
			tableStyleMap: parsed.tableStyleMap,
			slideMasters: parsed.slideMasters ?? [],
			notesMaster: parsed.notesMaster,
			handoutMaster: parsed.handoutMaster,
			hasMacros: parsed.hasMacros ?? false,
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

	const elementPatches = new Map<string, Record<string, string>>();
	for (const ref of refs) {
		const url = resolvedMap.get(ref.path);
		if (!url) {
			continue;
		}
		const existing = elementPatches.get(ref.element.id) ?? {};
		existing[ref.field] = url;
		elementPatches.set(ref.element.id, existing);
	}
	if (elementPatches.size === 0) {
		return slides;
	}

	const patchElements = (elements: PptxElement[]): PptxElement[] => {
		let mutated = false;
		const next = elements.map((el) => {
			let updated = el;
			const patch = elementPatches.get(el.id);
			if (patch) {
				updated = { ...el, ...patch } as PptxElement;
			}
			if (updated.type === 'group' && updated.children?.length) {
				const newChildren = patchElements(updated.children);
				if (newChildren !== updated.children) {
					updated = { ...updated, children: newChildren };
				}
			}
			if (updated !== el) {
				mutated = true;
			}
			return updated;
		});
		return mutated ? next : elements;
	};
	return slides.map((slide) => {
		const newElements = patchElements(slide.elements);
		return newElements === slide.elements ? slide : { ...slide, elements: newElements };
	});
}
