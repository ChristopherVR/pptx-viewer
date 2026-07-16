import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type {
	MediaPptxElement,
	ParsedSignature,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxElement,
	PptxEmbeddedFont,
	PptxHeaderFooter,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSaveFormat,
	PptxSlide,
	PptxSlideMaster,
	PptxTheme,
	XmlObject,
} from 'pptx-viewer-core';
import { EncryptedFileError, parseSignatureXml, PptxHandler } from 'pptx-viewer-core';

import {
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_CANVAS_WIDTH,
	collectImagePaths,
	collectMediaElements,
} from '../internal/shared';
import type { CanvasSize } from '../internal/shared';

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
	/** Slide canvas size in pixels. */
	readonly canvasSize = signal<CanvasSize>({
		width: DEFAULT_CANVAS_WIDTH,
		height: DEFAULT_CANVAS_HEIGHT,
	});
	/** Resolved presentation theme. */
	readonly theme = signal<PptxTheme | undefined>(undefined);
	/** Resolved colour map for the presentation theme (scheme key → hex). */
	readonly themeColorMap = signal<Record<string, string> | undefined>(undefined);
	/** Slide masters (for placeholder/background resolution). */
	readonly slideMasters = signal<PptxSlideMaster[]>([]);
	/** Notes master, including its editable element tree. */
	readonly notesMaster = signal<PptxNotesMaster | undefined>(undefined);
	/** Handout master, including its editable element tree. */
	readonly handoutMaster = signal<PptxHandoutMaster | undefined>(undefined);
	/** Whether the loaded package contains a VBA project. */
	readonly hasMacros = signal(false);
	/** Archive-path → displayable URL map for media + poster frames. */
	readonly mediaDataUrls = signal<Map<string, string>>(new Map());
	/** Embedded font data (name + binary) extracted from the presentation. */
	readonly embeddedFonts = signal<PptxEmbeddedFont[]>([]);
	/** Core document properties from `docProps/core.xml`. */
	readonly coreProperties = signal<PptxCoreProperties | undefined>(undefined);
	/** Custom document properties (used for `docproperty` field substitution). */
	readonly customProperties = signal<PptxCustomProperty[]>([]);
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

	/** Serialise the current (loaded) presentation back to `.pptx` bytes. */
	async getContent(): Promise<Uint8Array> {
		return this.saveSlides(this.slides());
	}

	/**
	 * Serialise an explicit set of slides back to `.pptx` bytes (e.g. the
	 * editor's edited deck) using the loaded presentation's handler.
	 */
	async saveSlides(
		slides: readonly PptxSlide[],
		outputFormat: PptxSaveFormat = 'pptx',
	): Promise<Uint8Array> {
		if (!this.handler) {
			throw new Error('No presentation is loaded.');
		}
		return this.handler.save([...slides], {
			slideMasters: this.slideMasters(),
			notesMaster: this.notesMaster(),
			handoutMaster: this.handoutMaster(),
			outputFormat,
		});
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
			this.mediaDataUrls.set(nextMediaUrls);
			this.canvasSize.set({
				width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
				height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
			});
			this.theme.set(parsed.theme);
			this.themeColorMap.set(parsed.themeColorMap);
			this.slideMasters.set(parsed.slideMasters ?? []);
			this.notesMaster.set(parsed.notesMaster);
			this.handoutMaster.set(parsed.handoutMaster);
			this.hasMacros.set(parsed.hasMacros ?? false);
			this.embeddedFonts.set(parsed.embeddedFonts ?? []);
			this.coreProperties.set(parsed.coreProperties);
			this.customProperties.set(parsed.customProperties ?? []);
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
 * empty array when there are none or parsing fails). `jszip`/`fast-xml-parser`
 * are imported lazily so they stay out of the main chunk. Mirrors the Vue
 * port's `parseSignaturesFromBuffer`.
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
