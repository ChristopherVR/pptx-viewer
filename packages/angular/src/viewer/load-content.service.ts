import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import type {
	MediaPptxElement,
	ParsedSignature,
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxData,
	PptxElement,
	PptxEmbeddedFont,
	PptxHeaderFooter,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSaveFormat,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
	PptxTagCollection,
	PptxTheme,
	PptxThemeOption,
	ParsedTableStyleMap,
	XmlObject,
} from 'pptx-viewer-core';
import { EncryptedFileError, parseSignatureXml, PptxHandler } from 'pptx-viewer-core';

import {
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_CANVAS_WIDTH,
	collectImagePaths,
	collectMediaElements,
	describeFontEmbedding,
	embeddedFontSaveOptions,
	resolveSlideSizeSelection,
	saveDeckWithPassword,
	slideSizeToCanvasPx,
} from '../internal/shared';
import type { CanvasSize, DeckSaveIntent, SlideSizeEmu } from '../internal/shared';

/**
 * `LoadContentService`: Angular port of the React `useLoadContent` hook and
 * the Vue `useLoadContent` composable.
 *
 * Parses `.pptx` bytes into reactive signals via the framework-agnostic
 * `PptxHandler` from `pptx-viewer-core`. All heavy lifting (ZIP, XML parse,
 * theme/master/layout resolution, media extraction) lives in core and the
 * pure helpers live in `pptx-viewer-shared`; this service only wires the async
 * load into Angular signals and manages Blob-URL / handler lifecycle.
 *
 * Provide it at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [LoadContentService] })`.
 *
 * Originally the viewer-first subset of the React hook; the extra pieces of
 * presentation metadata (sections, custom shows, embedded fonts, digital
 * signatures, …) were added alongside the corresponding features.
 */
@Injectable()
export class LoadContentService {
	/** Parsed slides (with image Blob URLs patched in). */
	readonly slides = signal<PptxSlide[]>([]);
	/**
	 * The full parsed presentation (slides patched with resolved image data
	 * URLs), for whole-deck exports such as the `pptx-viewer-json` download.
	 */
	readonly parsedData = signal<PptxData | undefined>(undefined);
	/** Slide canvas size in pixels. */
	readonly canvasSize = signal<CanvasSize>({
		width: DEFAULT_CANVAS_WIDTH,
		height: DEFAULT_CANVAS_HEIGHT,
	});
	/**
	 * `p:sldSz` in EMU, seeded from the loaded deck and rewritten by the SLIDE
	 * SIZE card's preset/orientation controls.
	 *
	 * It is deliberately NOT derived from {@link canvasSize}: the pixel size is
	 * an integer, and Ledger (12179300 EMU = 1278.5px) loses its
	 * `ppSlideSizeLedgerPaper` identity the moment it round-trips through one.
	 * The shared `resolveSlideSizeSelection` decides which of the two wins; see
	 * {@link slideSizeSelection}.
	 */
	readonly slideSizeEmu = signal<SlideSizeEmu | undefined>(undefined);
	/**
	 * The deck's custom shows (`p:custShow`), in the package's own key space
	 * (`slideRIds` are RELATIONSHIP ids). Seeded on load and carried through
	 * {@link saveSlides}; {@link ViewerCustomShowsService} is the editing surface
	 * over it. Angular used to start this list empty and never write it back, so
	 * the dialog opened blank on a deck with shows and lost anything created in
	 * it.
	 */
	readonly customShows = signal<PptxCustomShow[]>([]);
	/**
	 * The shared Slide Size decision for the deck as it stands: the EMU size a
	 * save must persist, the preset it matches (if any), its orientation and the
	 * canvas size the stage should use. Read by the SLIDE SIZE inspector card and
	 * by {@link saveSlides}.
	 */
	readonly slideSizeSelection = computed(() =>
		resolveSlideSizeSelection({ current: this.slideSizeEmu(), canvas: this.canvasSize() }),
	);
	/** Resolved presentation theme. */
	readonly theme = signal<PptxTheme | undefined>(undefined);
	/** Resolved colour map for the presentation theme (scheme key → hex). */
	readonly themeColorMap = signal<Record<string, string> | undefined>(undefined);
	/** Parsed table-style definitions from `ppt/tableStyles.xml` (banding/diagonals). */
	readonly tableStyleMap = signal<ParsedTableStyleMap | undefined>(undefined);
	/** Slide masters (for placeholder/background resolution). */
	readonly slideMasters = signal<PptxSlideMaster[]>([]);
	/** Notes master, including its editable element tree. */
	readonly notesMaster = signal<PptxNotesMaster | undefined>(undefined);
	/** Handout master, including its editable element tree. */
	readonly handoutMaster = signal<PptxHandoutMaster | undefined>(undefined);
	readonly sections = signal<PptxSection[]>([]);
	readonly presentationProperties = signal<PptxPresentationProperties>({});
	/** Whether the loaded package contains a VBA project. */
	readonly hasMacros = signal(false);
	/** Archive-path → displayable URL map for media + poster frames. */
	readonly mediaDataUrls = signal<Map<string, string>>(new Map());
	/** Embedded font data (name + binary) extracted from the presentation. */
	readonly embeddedFonts = signal<PptxEmbeddedFont[]>([]);
	/**
	 * Shared decision behind File > Fonts > "Embed fonts in the file": whether
	 * the toggle accepts input at all, and which position describes the deck
	 * that is loaded. Surfaced by {@link ViewerDialogsService} to the panel.
	 */
	readonly fontEmbedding = computed(() =>
		describeFontEmbedding(this.embeddedFonts().map((font) => font.name)),
	);
	/**
	 * The toggle's live position, read by {@link saveSlides}. `false` strips
	 * `p:embeddedFontLst`, the `/font` relationships and the `.fntdata` parts;
	 * `true` keeps whatever the deck arrived with (core's default).
	 *
	 * It lives here, next to the fonts it decides the fate of, rather than in
	 * the dialogs service, so the value save reads is seeded by the LOAD and
	 * cannot depend on whether the Fonts panel was ever rendered. Seeded in
	 * {@link load}; the initial `true` covers "no deck yet", where there is
	 * nothing to strip.
	 */
	readonly embedFonts = signal(true);
	/** Core document properties from `docProps/core.xml`. */
	readonly coreProperties = signal<PptxCoreProperties | undefined>(undefined);
	/** Extended application properties from `docProps/app.xml`. */
	readonly appProperties = signal<PptxAppProperties | undefined>(undefined);
	/** Selectable theme parts discovered in the package (path + display name). */
	readonly themeOptions = signal<PptxThemeOption[]>([]);
	/** Notes page size in pixels (from `p:notesSz`), when present. */
	readonly notesCanvasSize = signal<CanvasSize | undefined>(undefined);
	/** Custom document properties (used for `docproperty` field substitution). */
	readonly customProperties = signal<PptxCustomProperty[]>([]);
	/**
	 * `ppt/tags/*.xml` name/value metadata, editable from the inspector's TAGS
	 * card. Tags are how add-ins and automation stamp machine-readable data onto
	 * a deck, so they are carried through save (see {@link saveSlides}) rather
	 * than silently dropped.
	 */
	readonly tagCollections = signal<PptxTagCollection[]>([]);
	/** Header/footer settings (footer/header/date-time text + format) for field substitution. */
	readonly headerFooter = signal<PptxHeaderFooter | undefined>(undefined);
	/** Whether the presentation contains digital signatures. */
	/** Parsed digital signatures (empty when unsigned or parsing fails). */
	readonly signatures = signal<ParsedSignature[]>([]);

	readonly hasDigitalSignatures = signal(false);
	/** Number of digital signatures found. */
	readonly digitalSignatureCount = signal(0);
	/** True while a load is in flight. */
	readonly loading = signal(false);
	/** Error message from the last failed load, or null. */
	readonly error = signal<string | null>(null);
	/** True when the file is password-protected and could not be opened. */
	readonly isEncrypted = signal(false);

	/** Number of loaded slides. */
	readonly slideCount = computed(() => this.slides().length);

	private handler: PptxHandler | null = null;
	private renderToken = 0;
	private activeBlobUrls: string[] = [];

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.renderToken++;
			this.revokeBlobUrls(this.activeBlobUrls);
			this.revokeBlobUrls(Array.from(this.mediaDataUrls().values()));
			this.disposeHandler();
		});
	}

	/**
	 * Serialise the current (loaded) presentation back to `.pptx` bytes.
	 *
	 * `password` carries the File > Info > Protect Presentation state; when set
	 * the bytes are an encrypted OLE2 container rather than a plain ZIP.
	 */
	async getContent(password?: DeckSaveIntent | string | null): Promise<Uint8Array> {
		return this.saveSlides(this.slides(), 'pptx', undefined, password);
	}

	/**
	 * The loaded presentation's core handler, or `undefined` before a deck is
	 * loaded. Exposed for the AI bridge ({@link PptxAiBridge.getHandler}) so the
	 * assistant can reach low-level core APIs when needed.
	 */
	getHandler(): PptxHandler | undefined {
		return this.handler ?? undefined;
	}

	/**
	 * Serialise an explicit set of slides back to `.pptx` bytes (e.g. the
	 * editor's edited deck) using the loaded presentation's handler.
	 *
	 * Document properties (`docProps/core.xml` / `app.xml` / `custom.xml`)
	 * are passed from the live signals so inspector edits (DOCUMENT card)
	 * survive the save, mirroring React's `useSerialize` save options; core's
	 * `PptxDocumentPropertiesUpdater` writes them back into the package.
	 */
	async saveSlides(
		slides: readonly PptxSlide[],
		outputFormat: PptxSaveFormat = 'pptx',
		sections: readonly PptxSection[] = this.sections(),
		password?: DeckSaveIntent | string | null,
	): Promise<Uint8Array> {
		if (!this.handler) {
			throw new Error('No presentation is loaded.');
		}
		const customProperties = this.customProperties();
		const tags = this.tagCollections();
		const customShows = this.customShows();
		// Shared decision (see `deck-save-encryption` in `pptx-viewer-shared`): a
		// password set in the protection dialog routes through `saveEncrypted`, so
		// the produced file is a real encrypted OLE2 container.
		return saveDeckWithPassword(
			this.handler,
			[...slides],
			{
				headerFooter: this.headerFooter(),
				presentationProperties: this.presentationProperties(),
				slideMasters: this.slideMasters(),
				notesMaster: this.notesMaster(),
				handoutMaster: this.handoutMaster(),
				sections: sections.length > 0 ? [...sections] : undefined,
				// Without this the Custom Shows dialog was write-only: shows created
				// in it never reached `p:custShowLst`, and a deck that arrived with
				// shows lost them on save.
				customShows: customShows.length > 0 ? customShows.map((show) => ({ ...show })) : undefined,
				// The only route a slide-size edit has into the saved `p:sldSz`.
				slideSize: this.slideSizeSelection().size,
				coreProperties: this.coreProperties(),
				appProperties: this.appProperties(),
				customProperties: customProperties.length > 0 ? [...customProperties] : undefined,
				tags: tags.length > 0 ? tags.map((col) => ({ ...col, tags: [...col.tags] })) : undefined,
				outputFormat,
				// The Fonts panel's toggle used to move and change nothing; it now
				// decides whether the deck's embedded font data survives the save.
				...embeddedFontSaveOptions(this.embedFonts()),
			},
			password,
		);
	}

	/** Parse the supplied `.pptx` bytes into the reactive signals. */
	async load(raw: Uint8Array | ArrayBuffer | null | undefined): Promise<void> {
		if (!raw) {
			return;
		}
		const token = ++this.renderToken;
		const loadBlobUrls: string[] = [];

		try {
			this.loading.set(true);
			this.error.set(null);
			this.isEncrypted.set(false);

			const buffer =
				raw instanceof Uint8Array
					? raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
					: raw;

			const fileSizeMB = buffer instanceof ArrayBuffer ? buffer.byteLength / (1024 * 1024) : 0;
			if (fileSizeMB > 50) {
				console.warn(
					`[pptx] Large file detected (${fileSizeMB.toFixed(1)} MB). ` +
						`Loading may use significant memory.`,
				);
			}

			// Keep an independent copy for signature parsing; the handler may
			// detach/consume the ArrayBuffer during load.
			const sigBuffer = (buffer as ArrayBuffer).slice(0);

			const previousHandler = this.handler;
			const newHandler = new PptxHandler();
			const parsed = await newHandler.load(buffer as ArrayBuffer);
			if (token !== this.renderToken) {
				newHandler.dispose();
				return;
			}
			previousHandler?.dispose();

			// ── Resolve media Blob URLs (audio/video + poster frames) ──
			const mediaElements: MediaPptxElement[] = [];
			for (const slide of parsed.slides) {
				collectMediaElements(slide.elements, mediaElements);
			}
			this.revokeBlobUrls(Array.from(this.mediaDataUrls().values()));
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

			// Commit reactive state.
			this.revokeBlobUrls(this.activeBlobUrls);
			this.activeBlobUrls = loadBlobUrls;
			this.handler = newHandler;
			this.slides.set(nextSlides);
			this.parsedData.set({ ...parsed, slides: nextSlides });
			this.mediaDataUrls.set(nextMediaUrls);
			// `p:sldSz` in its authored EMU, which is the size a save round-trips.
			// The px canvas is derived from it where the deck reported one, so the
			// two agree and `resolveSlideSizeSelection` keeps the EMU (and with it
			// the preset identity) rather than re-deriving it from integer pixels.
			const slideSizeEmu: SlideSizeEmu | undefined =
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
			this.slideSizeEmu.set(slideSizeEmu);
			this.canvasSize.set(
				slideSizeEmu
					? slideSizeToCanvasPx(slideSizeEmu)
					: {
							width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
							height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
						},
			);
			this.customShows.set(parsed.customShows ?? []);
			this.theme.set(parsed.theme);
			this.themeColorMap.set(parsed.themeColorMap);
			this.tableStyleMap.set(parsed.tableStyleMap);
			this.slideMasters.set(parsed.slideMasters ?? []);
			this.notesMaster.set(parsed.notesMaster);
			this.handoutMaster.set(parsed.handoutMaster);
			this.sections.set(parsed.sections ?? []);
			this.presentationProperties.set(parsed.presentationProperties ?? {});
			this.hasMacros.set(parsed.hasMacros ?? false);
			this.embeddedFonts.set(parsed.embeddedFonts ?? []);
			// Re-seed the Fonts toggle for THIS deck: it has to start in the
			// position that describes what save would do right now (ON when the
			// deck carries embedded fonts, because core re-embeds them), and the
			// previous deck's answer says nothing about this one.
			this.embedFonts.set(this.fontEmbedding().initialEnabled);
			this.coreProperties.set(parsed.coreProperties);
			this.appProperties.set(parsed.appProperties);
			this.themeOptions.set(parsed.themeOptions ?? []);
			this.notesCanvasSize.set(
				typeof parsed.notesWidthEmu === 'number' &&
					typeof parsed.notesHeightEmu === 'number' &&
					parsed.notesWidthEmu > 0 &&
					parsed.notesHeightEmu > 0
					? {
							// EMU → px (EMU_PER_PIXEL = 9525), same rounding as the React port.
							width: Math.round(parsed.notesWidthEmu / 9525),
							height: Math.round(parsed.notesHeightEmu / 9525),
						}
					: undefined,
			);
			this.customProperties.set(parsed.customProperties ?? []);
			this.tagCollections.set(parsed.tags ?? []);
			this.headerFooter.set(parsed.headerFooter);
			this.hasDigitalSignatures.set(parsed.hasDigitalSignatures ?? false);
			this.digitalSignatureCount.set(parsed.digitalSignatureCount ?? 0);

			// Parse the `_xmlsignatures/*.xml` parts into ParsedSignature[] for the
			// signatures panel (best-effort; lazy ZIP/XML import keeps it off the
			// main chunk). Only commit if this load is still current.
			this.signatures.set([]);
			if (parsed.hasDigitalSignatures) {
				const sigs = await parseSignaturesFromBuffer(sigBuffer);
				if (token === this.renderToken) {
					this.signatures.set(sigs);
				}
			}
		} catch (err) {
			if (token === this.renderToken) {
				if (err instanceof EncryptedFileError) {
					this.isEncrypted.set(true);
				} else {
					this.error.set(err instanceof Error ? err.message : String(err));
				}
			}
		} finally {
			if (token === this.renderToken) {
				this.loading.set(false);
			}
		}
	}

	/**
	 * Point the presentation (first master, or every master) at another theme
	 * part in the package, mirroring React's `handleApplyTheme`. Updates the
	 * in-memory ZIP for save round-trip and the `slideMasters` signal so the
	 * change is visible to consumers; callers mark the editor dirty.
	 */
	async setPresentationTheme(themePath: string, applyToAllMasters: boolean): Promise<void> {
		if (!this.handler) {
			return;
		}
		await this.handler.setPresentationTheme(themePath, applyToAllMasters);
		this.slideMasters.update((masters) =>
			masters.map((master, index) =>
				applyToAllMasters || index === 0 ? { ...master, themePath } : master,
			),
		);
	}

	private disposeHandler(): void {
		if (this.handler) {
			this.handler.dispose();
			this.handler = null;
		}
	}

	private revokeBlobUrls(urls: string[]): void {
		for (const url of urls) {
			if (url.startsWith('blob:')) {
				URL.revokeObjectURL(url);
			}
		}
	}
}

/**
 * Parse digital signatures from a `.pptx` ZIP buffer (best-effort; returns an
 * empty array when there are none or parsing fails). Mirrors the Vue port's
 * `parseSignaturesFromBuffer`.
 *
 * `jszip`/`fast-xml-parser` are imported statically on purpose: `PptxHandler`
 * (imported above) already pulls both into the same chunk, so a dynamic import
 * here cannot move them anywhere. It only made bundlers emit
 * INEFFECTIVE_DYNAMIC_IMPORT.
 */
async function parseSignaturesFromBuffer(buffer: ArrayBuffer): Promise<ParsedSignature[]> {
	try {
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
