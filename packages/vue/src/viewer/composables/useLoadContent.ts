import type {
	MediaPptxElement,
	ParsedSignature,
	PptxCoreProperties,
	PptxElement,
	PptxEmbeddedFont,
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
 * `useLoadContent` — Vue port of the React hook of the same name.
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
 * This is the viewer-first subset; the React hook also populated ~25 extra
 * pieces of presentation metadata (sections, custom shows, embedded fonts,
 * digital signatures, etc.). Those are tracked in PORTING.md and should be
 * added here as the corresponding features are ported.
 */
export interface UseLoadContentResult {
	/** Parsed slides (with image Blob URLs patched in). */
	slides: ShallowRef<PptxSlide[]>;
	/** Slide canvas size in pixels. */
	canvasSize: Ref<CanvasSize>;
	/** Resolved presentation theme. */
	theme: ShallowRef<PptxTheme | undefined>;
	/** Slide masters (for placeholder/background resolution). */
	slideMasters: ShallowRef<PptxSlideMaster[]>;
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
	/** Embedded fonts (for `@font-face` injection). */
	embeddedFonts: ShallowRef<PptxEmbeddedFont[]>;
	/** Parsed digital signatures (empty when unsigned). */
	signatures: ShallowRef<ParsedSignature[]>;
	/** Serialise the current presentation back to `.pptx` bytes. */
	getContent: () => Promise<Uint8Array>;
}

export function useLoadContent(
	content: MaybeRefOrGetter<Uint8Array | ArrayBuffer | null | undefined>,
): UseLoadContentResult {
	const slides = shallowRef<PptxSlide[]>([]);
	const canvasSize = ref<CanvasSize>({
		width: DEFAULT_CANVAS_WIDTH,
		height: DEFAULT_CANVAS_HEIGHT,
	});
	const theme = shallowRef<PptxTheme | undefined>(undefined);
	const slideMasters = shallowRef<PptxSlideMaster[]>([]);
	const mediaDataUrls = shallowRef<Map<string, string>>(new Map());
	const loading = ref(false);
	const error = ref<string | null>(null);
	const isEncrypted = ref(false);
	const handler = shallowRef<PptxHandler | null>(null);
	const coreProperties = shallowRef<PptxCoreProperties | undefined>(undefined);
	const embeddedFonts = shallowRef<PptxEmbeddedFont[]>([]);
	const signatures = shallowRef<ParsedSignature[]>([]);

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
			// Keep an independent copy for signature parsing — the handler may
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

			// Commit reactive state.
			revokeBlobUrls(activeBlobUrls);
			activeBlobUrls = loadBlobUrls;
			handler.value = newHandler;
			slides.value = nextSlides;
			mediaDataUrls.value = nextMediaUrls;
			canvasSize.value = {
				width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
				height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
			};
			theme.value = parsed.theme;
			slideMasters.value = parsed.slideMasters ?? [];
			coreProperties.value = parsed.coreProperties;
			embeddedFonts.value = parsed.embeddedFonts ?? [];
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

	const getContent = async (): Promise<Uint8Array> => {
		if (!handler.value) {
			throw new Error('No presentation is loaded.');
		}
		return handler.value.save(slides.value);
	};

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
		canvasSize,
		theme,
		slideMasters,
		mediaDataUrls,
		loading,
		error,
		isEncrypted,
		handler,
		coreProperties,
		embeddedFonts,
		signatures,
		getContent,
	};
}
