import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
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
	PptxTagCollection,
	PptxTheme,
	PptxThemeOption,
	PptxViewProperties,
	XmlObject,
} from 'pptx-viewer-core';
import {
	PptxHandler,
	EncryptedFileError,
	decodeXmlEntities,
	parseSignatureXml,
} from 'pptx-viewer-core';
import type { DeckSaveIntent, DeckSavePurpose, SlideSizeEmu } from 'pptx-viewer-shared';
import {
	embeddedFontSaveOptions,
	resolveSlideSizeSelection,
	saveDeckWithPassword,
} from 'pptx-viewer-shared';
import { onScopeDispose, ref, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue';

import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../constants';
import type { CanvasSize } from '../types';
import {
	applyTableCellImagePatches,
	applyTableStyleImagePatches,
	collectAnimationSoundPaths,
	collectImagePaths,
	collectMediaElements,
	collectTableCellImagePaths,
	collectTableStyleImagePaths,
} from './load-content-helpers';
import type { TemplateElementMap } from './template-editing';
import { buildSaveSlides, partitionTemplateElements } from './template-editing';

/**
 * Parse digital signatures from a `.pptx` ZIP buffer (best-effort; returns an
 * empty array when there are none or parsing fails).
 *
 * `jszip`/`fast-xml-parser` are imported statically on purpose: `PptxHandler`
 * (imported above) already pulls both into the same chunk, so a dynamic import
 * here cannot move them anywhere. It only made bundlers emit
 * INEFFECTIVE_DYNAMIC_IMPORT.
 *
 * The parser options mirror core's loader parser rather than taking
 * fast-xml-parser's defaults, and `packages/angular` carries the identical
 * copy of this function (see the note there). Two reasons, one cosmetic and
 * one structural:
 *
 * - fast-xml-parser decodes the five predefined entities but NOT numeric
 *   character references, so a certificate DN written
 *   `CN=M&#xFC;ller CA` was rendered verbatim in the signatures panel instead
 *   of `CN=Müller CA`. Non-ASCII signer names are exactly the ones a producer
 *   is most likely to escape that way, so the panel garbled the names it most
 *   needed to get right. `decodeXmlEntities` is the same helper core's parser
 *   uses, so both now agree on what a DN says.
 * - `processEntities: false` removes DTD handling from a path that reads
 *   attacker-supplied bytes. fast-xml-parser 5.9.2 expands no entities and
 *   rejects external ones outright, so nothing here was exploitable; this is
 *   forward-stability, and it also stops a package with a large DTD entity
 *   (which the default rejects with a size-cap throw) from silently
 *   collapsing every signature to "none found" via the catch below.
 */
export async function parseSignaturesFromBuffer(buffer: ArrayBuffer): Promise<ParsedSignature[]> {
	try {
		const zip = await JSZip.loadAsync(buffer);
		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			parseAttributeValue: false,
			parseTagValue: false,
			processEntities: false,
			tagValueProcessor: (_tagName: string, tagValue: string) => decodeXmlEntities(tagValue),
			attributeValueProcessor: (_attrName: string, attrValue: string) =>
				decodeXmlEntities(attrValue),
		});
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
	/**
	 * The slide size in EMU (`p:sldSz`), seeded from the loaded deck and updated
	 * by the inspector's preset / orientation controls.
	 *
	 * Held ALONGSIDE {@link canvasSize} rather than derived from it because the
	 * pixel round-trip is lossy: Ledger is 12179300 EMU = 1278.5px, and rounding
	 * that to an integer pixel and back moves it far enough to lose the deck's
	 * `ppSlideSizeLedgerPaper` identity. `resolveSlideSizeSelection` decides
	 * which of the two wins whenever they disagree.
	 */
	slideSize: Ref<SlideSizeEmu | undefined>;
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
	/** Parsed `ppt/tags/tag*.xml` collections (name/value pairs), empty when none. */
	tagCollections: ShallowRef<PptxTagCollection[]>;
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
	/**
	 * View properties (`ppt/viewProps.xml`, `p:viewPr`): grid spacing, snap /
	 * guide toggles, last view, splitter state, etc. `gridSpacing` lives here,
	 * NOT on `presentationProperties` -- `p:gridSpacing` is a child of
	 * `p:viewPr`, and a real PowerPoint file never populates it under
	 * `p:presentationPr`.
	 */
	viewProperties: ShallowRef<PptxViewProperties | undefined>;
	/** Presentation-level header/footer settings, or `undefined`. */
	headerFooter: ShallowRef<PptxHeaderFooter | undefined>;
	/** Parsed notes master, or `undefined` when absent. */
	notesMaster: ShallowRef<PptxNotesMaster | undefined>;
	/** Parsed handout master, or `undefined` when absent. */
	handoutMaster: ShallowRef<PptxHandoutMaster | undefined>;
	/** Theme parts discovered in the package (`{ path, name }`), empty when none. */
	themeOptions: ShallowRef<PptxThemeOption[]>;
	/** Notes page size in pixels (`p:notesSz`), or `undefined` when absent. */
	notesCanvasSize: Ref<CanvasSize | undefined>;
	/** Serialise the current presentation back to `.pptx` bytes. */
	getContent: () => Promise<Uint8Array>;
	/**
	 * Serialise for bytes this viewer will read back itself: the autosave
	 * crash-recovery snapshot, and the re-serialise-then-reload cycle behind
	 * "apply theme". Always a plain ZIP even when the deck is password
	 * protected, because neither reader can supply the password (see
	 * `deck-save-encryption` in `pptx-viewer-shared` for the rationale and the
	 * privacy tradeoff it accepts).
	 */
	getRecoverySnapshot: () => Promise<Uint8Array>;
	/** Serialise to a specific OpenXML format (pptx / ppsx / pptm). */
	saveAs: (format: PptxSaveFormat) => Promise<Uint8Array>;
}

export interface UseLoadContentOptions {
	/**
	 * Called after a parse fully applies to viewer state (slides & co.).
	 * Collaboration uses this to re-adopt the shared doc's slides when a local
	 * load lands mid-session and would otherwise clobber remotely-synced state.
	 */
	onContentApplied?: () => void;
	/**
	 * The File > Info > Protect Presentation state, read at save time. When it
	 * yields a password the deck is serialised through `saveEncrypted` (an OLE2
	 * container), not `save` (a plain ZIP). A getter rather than a value so the
	 * secret is always the current one, no matter when the dialog set it.
	 */
	getSaveIntent?: () => DeckSaveIntent;
	/**
	 * The File > Fonts "Embed fonts in the file" toggle, read at save time.
	 * `false` strips `p:embeddedFontLst`, the `/font` relationships and the
	 * `.fntdata` parts; the default (omitted, or `true`) keeps whatever the deck
	 * arrived with. A getter, not a value, for the same reason as
	 * {@link getSaveIntent}: the composable is created before the panel that
	 * owns the flag, and the answer must be the current one.
	 */
	getEmbedFonts?: () => boolean;
	/**
	 * Trust Center > "Allow external content (remote images and media)", read
	 * at load time. `false` (core's own default) makes `getImageData` drop any
	 * `http://`/`https://` image URL instead of fetching it; omitted defaults to
	 * `true` (fetch them), matching this option's own default. A getter, not a
	 * value, so a later options-store change is picked up on the next load
	 * without re-wiring this composable, the same convention as
	 * {@link getSaveIntent} and {@link getEmbedFonts}.
	 */
	getAllowExternalImages?: () => boolean;
}

export function useLoadContent(
	content: MaybeRefOrGetter<Uint8Array | ArrayBuffer | null | undefined>,
	options?: UseLoadContentOptions,
): UseLoadContentResult {
	const slides = shallowRef<PptxSlide[]>([]);
	const templateElementsBySlideId = shallowRef<TemplateElementMap>({});
	const canvasSize = ref<CanvasSize>({
		width: DEFAULT_CANVAS_WIDTH,
		height: DEFAULT_CANVAS_HEIGHT,
	});
	const slideSize = ref<SlideSizeEmu | undefined>(undefined);
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
	const tagCollections = shallowRef<PptxTagCollection[]>([]);
	const embeddedFonts = shallowRef<PptxEmbeddedFont[]>([]);
	const signatures = shallowRef<ParsedSignature[]>([]);
	const tableStyleMap = shallowRef<ParsedTableStyleMap | undefined>(undefined);
	const sections = shallowRef<PptxSection[]>([]);
	const customShows = shallowRef<PptxCustomShow[]>([]);
	const presentationProperties = shallowRef<PptxPresentationProperties>({});
	const viewProperties = shallowRef<PptxViewProperties | undefined>(undefined);
	const headerFooter = shallowRef<PptxHeaderFooter | undefined>(undefined);
	const notesMaster = shallowRef<PptxNotesMaster | undefined>(undefined);
	const handoutMaster = shallowRef<PptxHandoutMaster | undefined>(undefined);
	const themeOptions = shallowRef<PptxThemeOption[]>([]);
	const notesCanvasSize = ref<CanvasSize | undefined>(undefined);

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
			const parsed = await newHandler.load(buffer as ArrayBuffer, {
				allowExternalImages: options?.getAllowExternalImages?.(),
			});
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

			// Native-animation `p:stSnd` sounds that back no visible media element
			// (PowerPoint's animation sound library) have no entry above; resolve
			// them into the same map so `onPlayActionSound`'s lookup finds them.
			const soundPaths = collectAnimationSoundPaths(parsed.slides).filter(
				(path) => !nextMediaUrls.has(path),
			);
			await Promise.all(
				soundPaths.map(async (soundPath) => {
					try {
						const arrayBuffer = await newHandler.getMediaArrayBuffer(soundPath);
						if (arrayBuffer) {
							const blobUrl = URL.createObjectURL(new Blob([arrayBuffer]));
							loadBlobUrls.push(blobUrl);
							nextMediaUrls.set(soundPath, blobUrl);
						}
					} catch {
						/* Non-critical: the sound simply will not play. */
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

			// ── Resolve table cell image-fill Blob URLs ──
			const { paths: tableImagePaths, refs: tableImageRefs } =
				collectTableCellImagePaths(nextSlides);
			if (tableImagePaths.size > 0) {
				const resolvedTableMap = new Map<string, string>();
				await Promise.all(
					Array.from(tableImagePaths).map(async (path) => {
						try {
							const url = await newHandler.getImageData(path);
							if (url) {
								resolvedTableMap.set(path, url);
							}
						} catch {
							// Non-critical: the cell falls back to no image fill.
						}
					}),
				);
				if (resolvedTableMap.size > 0) {
					nextSlides = nextSlides.map((s) => {
						const newElements = applyTableCellImagePatches(
							s.elements,
							resolvedTableMap,
							tableImageRefs,
						);
						return newElements === s.elements ? s : { ...s, elements: newElements };
					});
				}
			}

			// ── Resolve whole-table-STYLE image-fill Blob URLs ──
			let nextTableStyleMap = parsed.tableStyleMap;
			const { paths: tableStyleImagePaths, refs: tableStyleImageRefs } =
				collectTableStyleImagePaths(nextTableStyleMap);
			if (tableStyleImagePaths.size > 0) {
				const resolvedStyleMap = new Map<string, string>();
				await Promise.all(
					Array.from(tableStyleImagePaths).map(async (path) => {
						try {
							const url = await newHandler.getImageData(path);
							if (url) {
								resolvedStyleMap.set(path, url);
							}
						} catch {
							// Non-critical: the style section falls back to no image fill.
						}
					}),
				);
				if (resolvedStyleMap.size > 0 && nextTableStyleMap) {
					nextTableStyleMap = applyTableStyleImagePatches(
						nextTableStyleMap,
						resolvedStyleMap,
						tableStyleImageRefs,
					);
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
			// `p:sldSz` verbatim, so a preset deck keeps its identity through a
			// save even though the viewer lays out in rounded pixels.
			slideSize.value =
				typeof parsed.widthEmu === 'number' &&
				typeof parsed.heightEmu === 'number' &&
				parsed.widthEmu > 0 &&
				parsed.heightEmu > 0
					? {
							widthEmu: parsed.widthEmu,
							heightEmu: parsed.heightEmu,
							type: parsed.slideSizeType ?? '',
						}
					: undefined;
			theme.value = parsed.theme;
			themeColorMap.value = parsed.themeColorMap;
			slideMasters.value = parsed.slideMasters ?? [];
			layoutOptions.value = parsed.layoutOptions ?? [];
			coreProperties.value = parsed.coreProperties;
			customProperties.value = parsed.customProperties ?? [];
			appProperties.value = parsed.appProperties;
			tagCollections.value = parsed.tags ?? [];
			embeddedFonts.value = parsed.embeddedFonts ?? [];
			tableStyleMap.value = nextTableStyleMap;
			sections.value = parsed.sections ?? [];
			customShows.value = parsed.customShows ?? [];
			presentationProperties.value = parsed.presentationProperties ?? {};
			viewProperties.value = parsed.viewProperties;
			headerFooter.value = parsed.headerFooter;
			notesMaster.value = parsed.notesMaster;
			handoutMaster.value = parsed.handoutMaster;
			themeOptions.value = parsed.themeOptions ?? [];
			// 9525 EMU per pixel (matches React's useLoadContent conversion).
			notesCanvasSize.value =
				typeof parsed.notesWidthEmu === 'number' &&
				typeof parsed.notesHeightEmu === 'number' &&
				parsed.notesWidthEmu > 0 &&
				parsed.notesHeightEmu > 0
					? {
							width: Math.round(parsed.notesWidthEmu / 9525),
							height: Math.round(parsed.notesHeightEmu / 9525),
						}
					: undefined;
			signatures.value =
				parsed.hasDigitalSignatures && signatureBuffer instanceof ArrayBuffer
					? await parseSignaturesFromBuffer(signatureBuffer)
					: [];
			options?.onContentApplied?.();
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

	const serialize = async (
		format: PptxSaveFormat,
		purpose: DeckSavePurpose,
	): Promise<Uint8Array> => {
		if (!handler.value) {
			throw new Error('No presentation is loaded.');
		}
		// Merge the separately-stored template (master/layout) elements back in
		// front of (behind) each slide's content before serialising, so template
		// edits persist. Persist edited document metadata (core properties,
		// sections, custom shows, header/footer, tag collections) into the
		// saved file.
		// Routed through the shared decision so a password set in the protection
		// dialog produces an encrypted OLE2 file, exactly as in the other four
		// bindings - unless `purpose` says these bytes are a recovery snapshot,
		// which stays a plain ZIP so it can be reopened without the password
		// (see `deck-save-encryption` in `pptx-viewer-shared`).
		return saveDeckWithPassword(
			handler.value,
			buildSaveSlides(slides.value, templateElementsBySlideId.value),
			{
				coreProperties: coreProperties.value,
				customProperties: customProperties.value,
				appProperties: appProperties.value,
				sections: sections.value,
				customShows: customShows.value,
				presentationProperties: presentationProperties.value,
				headerFooter: headerFooter.value,
				// Design > Slide Size. Without this the card resized the stage and
				// the saved `p:sldSz` still said whatever the deck arrived with, so
				// every slide-size edit was discarded at the file boundary.
				slideSize: resolveSlideSizeSelection({
					current: slideSize.value,
					canvas: canvasSize.value,
				}).size,
				slideMasters: slideMasters.value,
				notesMaster: notesMaster.value,
				handoutMaster: handoutMaster.value,
				tags: tagCollections.value.length > 0 ? tagCollections.value : undefined,
				outputFormat: format,
				// The Fonts panel's toggle used to move and change nothing; it now
				// decides whether the deck's embedded font data survives the save.
				...embeddedFontSaveOptions(options?.getEmbedFonts?.() ?? true),
			},
			{ ...options?.getSaveIntent?.(), purpose },
		);
	};

	const saveAs = (format: PptxSaveFormat): Promise<Uint8Array> => serialize(format, 'user-file');

	const getContent = (): Promise<Uint8Array> => saveAs('pptx');

	// Autosave used to call `getContent()`, so protecting a deck wrote an
	// ENCRYPTED recovery snapshot that nothing could reopen. Recovery gets its
	// own serialisation now, and the decision lives in shared.
	const getRecoverySnapshot = (): Promise<Uint8Array> => serialize('pptx', 'recovery-snapshot');

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
		slideSize,
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
		tagCollections,
		embeddedFonts,
		signatures,
		tableStyleMap,
		sections,
		customShows,
		presentationProperties,
		viewProperties,
		headerFooter,
		notesMaster,
		handoutMaster,
		themeOptions,
		notesCanvasSize,
		saveAs,
		getContent,
		getRecoverySnapshot,
	};
}
