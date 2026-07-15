import type {
	MediaPptxElement,
	ParsedSignature,
	ParsedTableStyleMap,
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxElement,
	PptxEmbeddedFont,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxLayoutOption,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSaveFormat,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxTheme,
	XmlObject,
} from 'pptx-viewer-core';
import { PptxHandler, EncryptedFileError, parseSignatureXml } from 'pptx-viewer-core';
import { onScopeDispose, ref, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue';

import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../constants';
import type { CanvasSize } from '../types';
import { collectImagePaths, collectMediaElements } from './load-content-helpers';
import type { TemplateElementMap } from './template-editing';
import { buildSaveSlides, partitionTemplateElements } from './template-editing';

/**
 * Parse digital signatures from a `.pptx` ZIP buffer (best-effort; returns an
 * empty array when there are none or parsing fails). `jszip`/`fast-xml-parser`
 * are loaded lazily so they stay out of the main chunk.
 */
async function parseSignaturesFromBuffer(buffer: ArrayBuffer): Promise<ParsedSignature[]> {
	try {
		const [{ default: JSZip }, { XMLParser }] = await Promise.all([
			import('jszip'),
			import('fast-xml-parser'),
		]);
		const zip = await JSZip.loadAsync(buffer);
		const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
		const result: ParsedSignature[] = [];
		for (const path of Object.keys(zip.files)) {
			if (path.startsWith('_xmlsignatures/') && path.endsWith('.xml')) {
				const xml = await zip.files[path].async('string');
				result.push(parseSignatureXml(parser.parse(xml) as XmlObject, path));
			}
		}
		return result;
	} catch {
		return [];
	}
}

/**
 * `useLoadContent`: Vue port of the React hook of the same name.
 *
 * Watches a reactive `content` source and parses it into reactive viewer
 * state via the framework-agnostic `PptxHandler` from `pptx-viewer-core`.
 * The heavy lifting (ZIP, XML parse, theme/master/layout resolution, media
 * extraction) all lives in core; this composable only wires the async load
 * into Vue reactivity and manages Blob-URL / handler lifecycle.
 *
 * Differences vs. React:
 *  - The `useEffect(..., [content])` cleanup pattern becomes a `watch` with a
 *    cancellation token plus `onScopeDispose` for unmount cleanup.
 *  - State setters become returned `ref`s mutated in place.
 *
 * Originally the viewer-first subset of the React hook; the extra pieces of
 * presentation metadata (sections, custom shows, embedded fonts, digital
 * signatures, etc.) were added alongside the corresponding features.
 */
export interface UseLoadContentResult {
	/** Parsed slides (with image Blob URLs patched in), template elements removed. */
	slides: ShallowRef<PptxSlide[]>;
	/**
	 * Master/layout (template) elements pulled out of each slide at load time,
	 * keyed by `slide.id`. Edited in `editTemplateMode` and merged back (behind the
	 * slide content) by every save path via {@link buildSaveSlides}.
	 */
	templateElementsBySlideId: ShallowRef<TemplateElementMap>;
	/** Slide canvas size in pixels. */
	canvasSize: Ref<CanvasSize>;
	/** Resolved presentation theme. */
	theme: ShallowRef<PptxTheme | undefined>;
	/** Theme colour map (`accent1`→hex, …) used to re-resolve colours on theme switch. */
	themeColorMap: ShallowRef<Record<string, string> | undefined>;
	/** Slide masters (for placeholder/background resolution). */
	slideMasters: ShallowRef<PptxSlideMaster[]>;
	/** Slide-layout choices for the New-Slide gallery (`{ path, name }`). */
	layoutOptions: ShallowRef<PptxLayoutOption[]>;
	/** Archive-path → displayable URL map for media + poster frames. */
	mediaDataUrls: ShallowRef<Map<string, string>>;
	/** True while a load is in flight. */
	loading: Ref<boolean>;
	/** Error message from the last failed load, or null. */
	error: Ref<string | null>;
	/** True when the file is password-protected and could not be opened. */
	isEncrypted: Ref<boolean>;
	/** The live `PptxHandler` for the loaded file (or null). */
	handler: ShallowRef<PptxHandler | null>;
	/** Parsed document core properties (title/author/subject/…). */
	coreProperties: ShallowRef<PptxCoreProperties | undefined>;
	/** Parsed custom document properties (name/type/value), empty when none. */
	customProperties: ShallowRef<PptxCustomProperty[]>;
	/** Parsed application properties (manager/company/…), or undefined. */
	appProperties: ShallowRef<PptxAppProperties | undefined>;
	/** Embedded fonts (for `@font-face` injection). */
	embeddedFonts: ShallowRef<PptxEmbeddedFont[]>;
	/** Parsed digital signatures (empty when unsigned). */
	signatures: ShallowRef<ParsedSignature[]>;
	/**
	 * Parsed `ppt/tableStyles.xml` map (GUID → style entry), or `undefined`
	 * when the presentation has no table styles part. Feeds table banding /
	 * header colour resolution by table-style GUID.
	 */
	tableStyleMap: ShallowRef<ParsedTableStyleMap | undefined>;
	/** Ordered presentation sections (`p:sectionLst`), empty when none. */
	sections: ShallowRef<PptxSection[]>;
	/** Named custom slide shows (`p:custShowLst`), empty when none. */
	customShows: ShallowRef<PptxCustomShow[]>;
	/** Presentation-level slide-show properties (`presentationPr.xml`); reactive so Set Up Slide Show persists. */
	presentationProperties: ShallowRef<PptxPresentationProperties>;
	/** Presentation-level header/footer settings, or `undefined`. */
	headerFooter: ShallowRef<PptxHeaderFooter | undefined>;
	/** Parsed notes master, or `undefined` when absent. */
	notesMaster: ShallowRef<PptxNotesMaster | undefined>;
	/** Parsed handout master, or `undefined` when absent. */
	handoutMaster: ShallowRef<PptxHandoutMaster | undefined>;
	/** Serialise the current presentation back to `.pptx` bytes. */
	getContent: () => Promise<Uint8Array>;
	/** Serialise to a specific OpenXML format (pptx / ppsx / pptm). */
	saveAs: (format: PptxSaveFormat) => Promise<Uint8Array>;
}

export function useLoadContent(
	content: MaybeRefOrGetter<Uint8Array | ArrayBuffer | null | undefined>,
): UseLoadContentResult {
	const slides = shallowRef<PptxSlide[]>([]);
	const templateElementsBySlideId = shallowRef<TemplateElementMap>({});
	const canvasSize = ref<CanvasSize>({
		width: DEFAULT_CANVAS_WIDTH,
		height: DEFAULT_CANVAS_HEIGHT,
	});
	const theme = shallowRef<PptxTheme | undefined>(undefined);
	const themeColorMap = shallowRef<Record<string, string> | undefined>(undefined);
	const slideMasters = shallowRef<PptxSlideMaster[]>([]);
	const layoutOptions = shallowRef<PptxLayoutOption[]>([]);
	const mediaDataUrls = shallowRef<Map<string, string>>(new Map());
	const loading = ref(false);
	const error = ref<string | null>(null);
	const isEncrypted = ref(false);
	const handler = shallowRef<PptxHandler | null>(null);
	const coreProperties = shallowRef<PptxCoreProperties | undefined>(undefined);
	const customProperties = shallowRef<PptxCustomProperty[]>([]);
	const appProperties = shallowRef<PptxAppProperties | undefined>(undefined);
	const embeddedFonts = shallowRef<PptxEmbeddedFont[]>([]);
	const signatures = shallowRef<ParsedSignature[]>([]);
	const tableStyleMap = shallowRef<ParsedTableStyleMap | undefined>(undefined);
	const sections = shallowRef<PptxSection[]>([]);
	const customShows = shallowRef<PptxCustomShow[]>([]);
	const presentationProperties = shallowRef<PptxPresentationProperties>({});
	const headerFooter = shallowRef<PptxHeaderFooter | undefined>(undefined);
	const notesMaster = shallowRef<PptxNotesMaster | undefined>(undefined);
	const handoutMaster = shallowRef<PptxHandoutMaster | undefined>(undefined);

	let renderToken = 0;
	let activeBlobUrls: string[] = [];

	const disposeHandler = () => {
		if (handler.value) {
			handler.value.dispose();
			handler.value = null;
		}
	};

	const revokeBlobUrls = (urls: string[]) => {
		for (const url of urls) {
			if (url.startsWith('blob:')) {
				URL.revokeObjectURL(url);
			}
		}
	};

	const load = async (raw: Uint8Array | ArrayBuffer) => {
		const token = ++renderToken;
		const loadBlobUrls: string[] = [];

		try {
			loading.value = true;
			error.value = null;
			isEncrypted.value = false;

			const buffer =
				raw instanceof Uint8Array
					? raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
					: raw;
			// Keep an independent copy for signature parsing; the handler may
			// consume/transfer `buffer` during load.
			const signatureBuffer = buffer.slice(0);

			const fileSizeMB = buffer instanceof ArrayBuffer ? buffer.byteLength / (1024 * 1024) : 0;
			if (fileSizeMB > 50) {
				console.warn(
					`[pptx] Large file detected (${fileSizeMB.toFixed(1)} MB). ` +
						`Loading may use significant memory.`,
				);
			}

			// Keep the previous handler alive until the new load resolves so
			// in-flight Blob URLs aren't yanked mid-paint.
			const previousHandler = handler.value;

			const newHandler = new PptxHandler();
			const parsed = await newHandler.load(buffer as ArrayBuffer);
			if (token !== renderToken) {
				newHandler.dispose();
				return;
			}

			if (previousHandler) {
				previousHandler.dispose();
			}

			// ── Resolve media Blob URLs (audio/video + poster frames) ──
			const mediaElements: MediaPptxElement[] = [];
			for (const slide of parsed.slides) {
				collectMediaElements(slide.elements, mediaElements);
			}
			revokeBlobUrls(Array.from(mediaDataUrls.value.values()));
			const nextMediaUrls = new Map<string, string>();
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
							const arrayBuffer = await newHandler.getMediaArrayBuffer(mediaPath);
							if (arrayBuffer) {
								const mimeType = mediaElement.mediaMimeType || 'application/octet-stream';
								const blob = new Blob([arrayBuffer], { type: mimeType });
								const blobUrl = URL.createObjectURL(blob);
								loadBlobUrls.push(blobUrl);
								nextMediaUrls.set(mediaPath, blobUrl);
							} else {
								mediaElement.mediaMissing = true;
							}
						} else {
							const dataUrl = await newHandler.getImageData(mediaPath);
							if (dataUrl) {
								nextMediaUrls.set(mediaPath, dataUrl);
							} else {
								mediaElement.mediaMissing = true;
							}
						}
					} catch {
						mediaElement.mediaMissing = true;
					}
				}),
			);

			// ── Resolve lazily-loaded picture Blob URLs ──
			const { paths: imagePaths, refs: imageRefs } = collectImagePaths(parsed.slides);
			let nextSlides = parsed.slides;
			if (imagePaths.size > 0) {
				const resolvedMap = new Map<string, string>();
				await Promise.all(
					Array.from(imagePaths).map(async (path) => {
						try {
							const url = await newHandler.getImageData(path);
							if (url) {
								resolvedMap.set(path, url);
							}
						} catch {
							// Non-critical: image will show as broken.
						}
					}),
				);

				const elementPatches = new Map<string, Record<string, string>>();
				for (const refEntry of imageRefs) {
					const url = resolvedMap.get(refEntry.path);
					if (!url) {
						continue;
					}
					const id = refEntry.element.id;
					const existing = elementPatches.get(id) ?? {};
					existing[refEntry.field] = url;
					elementPatches.set(id, existing);
				}

				if (elementPatches.size > 0) {
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
					nextSlides = parsed.slides.map((s) => {
						const newElements = patchElements(s.elements);
						return newElements === s.elements ? s : { ...s, elements: newElements };
					});
				}
			}

			// Pull master/layout (template) elements out of each slide into their own
			// store so the editor can gate / route / merge them back independently.
			const partitioned = partitionTemplateElements(nextSlides);

			// Commit reactive state.
			revokeBlobUrls(activeBlobUrls);
			activeBlobUrls = loadBlobUrls;
			handler.value = newHandler;
			slides.value = partitioned.slides;
			templateElementsBySlideId.value = partitioned.templateElementsBySlideId;
			mediaDataUrls.value = nextMediaUrls;
			canvasSize.value = {
				width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
				height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
			};
			theme.value = parsed.theme;
			themeColorMap.value = parsed.themeColorMap;
			slideMasters.value = parsed.slideMasters ?? [];
			layoutOptions.value = parsed.layoutOptions ?? [];
			coreProperties.value = parsed.coreProperties;
			customProperties.value = parsed.customProperties ?? [];
			appProperties.value = parsed.appProperties;
			embeddedFonts.value = parsed.embeddedFonts ?? [];
			tableStyleMap.value = parsed.tableStyleMap;
			sections.value = parsed.sections ?? [];
			customShows.value = parsed.customShows ?? [];
			presentationProperties.value = parsed.presentationProperties ?? {};
			headerFooter.value = parsed.headerFooter;
			notesMaster.value = parsed.notesMaster;
			handoutMaster.value = parsed.handoutMaster;
			signatures.value =
				parsed.hasDigitalSignatures && signatureBuffer instanceof ArrayBuffer
					? await parseSignaturesFromBuffer(signatureBuffer)
					: [];
		} catch (err) {
			if (token === renderToken) {
				if (err instanceof EncryptedFileError) {
					isEncrypted.value = true;
				} else {
					error.value = err instanceof Error ? err.message : String(err);
				}
			}
		} finally {
			if (token === renderToken) {
				loading.value = false;
			}
		}
	};

	const saveAs = async (format: PptxSaveFormat): Promise<Uint8Array> => {
		if (!handler.value) {
			throw new Error('No presentation is loaded.');
		}
		// Merge the separately-stored template (master/layout) elements back in
		// front of (behind) each slide's content before serialising, so template
		// edits persist. Persist edited document metadata (core properties,
		// sections, custom shows, header/footer) into the saved file.
		return handler.value.save(buildSaveSlides(slides.value, templateElementsBySlideId.value), {
			coreProperties: coreProperties.value,
			customProperties: customProperties.value,
			appProperties: appProperties.value,
			sections: sections.value,
			customShows: customShows.value,
			presentationProperties: presentationProperties.value,
			headerFooter: headerFooter.value,
			slideMasters: slideMasters.value,
			notesMaster: notesMaster.value,
			handoutMaster: handoutMaster.value,
			outputFormat: format,
		});
	};

	const getContent = (): Promise<Uint8Array> => saveAs('pptx');

	watch(
		() => toValue(content),
		(value) => {
			if (!value) {
				return;
			}
			void load(value);
		},
		{ immediate: true },
	);

	onScopeDispose(() => {
		renderToken++;
		revokeBlobUrls(activeBlobUrls);
		revokeBlobUrls(Array.from(mediaDataUrls.value.values()));
		disposeHandler();
	});

	return {
		slides,
		templateElementsBySlideId,
		layoutOptions,
		canvasSize,
		theme,
		themeColorMap,
		slideMasters,
		mediaDataUrls,
		loading,
		error,
		isEncrypted,
		handler,
		coreProperties,
		customProperties,
		appProperties,
		embeddedFonts,
		signatures,
		tableStyleMap,
		sections,
		customShows,
		presentationProperties,
		headerFooter,
		notesMaster,
		handoutMaster,
		saveAs,
		getContent,
	};
}
