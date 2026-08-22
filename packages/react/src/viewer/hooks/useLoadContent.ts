import type {
	PptxAppProperties,
	MediaPptxElement,
	PptxElement,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxEmbeddedFont,
	PptxHeaderFooter,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideMaster,
	PptxTheme,
	PptxThemeOption,
	PptxCustomShow,
	PptxSection,
	PptxPresentationProperties,
	PptxTagCollection,
	PptxViewProperties,
	ParsedTableStyleMap,
} from 'pptx-viewer-core';
import { PptxHandler, EncryptedFileError } from 'pptx-viewer-core';
import type { SlideSizeEmu } from 'pptx-viewer-shared';
import { resolveAuthoredCustomShowId } from 'pptx-viewer-shared';
/**
 * useLoadContent: Handles loading/parsing PPTX content into viewer state.
 *
 * Extracts the heavy loading useEffect from PowerPointViewer so the
 * orchestrator stays lean.
 */
import { useEffect, useRef } from 'react';

import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../constants';
import type { CanvasSize } from '../types';
import { partitionTemplateElements } from '../utils/template-editing';
import {
	collectMediaElements,
	collectImagePaths,
	collectTableCellImagePaths,
	applyTableCellImagePatches,
	collectTableStyleImagePaths,
	applyTableStyleImagePatches,
	buildInitialGuides,
} from './load-content-helpers';
import type { EditorHistoryResult } from './useEditorHistory';

/* ------------------------------------------------------------------ */
/*  Input / Output types                                              */
/* ------------------------------------------------------------------ */

export interface UseLoadContentInput {
	content: ArrayBuffer | Uint8Array | null | undefined;
	clearSelection: () => void;
	history: EditorHistoryResult;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	setTemplateElementsBySlideId: React.Dispatch<React.SetStateAction<Record<string, PptxElement[]>>>;
	mediaDataUrls: Map<string, string>;
	setCanvasSize: React.Dispatch<React.SetStateAction<CanvasSize>>;
	/** Seeds the EMU `p:sldSz` that a save persists (see `ViewerCoreState.slideSizeEmu`). */
	setSlideSizeEmu: React.Dispatch<React.SetStateAction<SlideSizeEmu | undefined>>;
	setHeaderFooter: React.Dispatch<React.SetStateAction<PptxHeaderFooter>>;
	setLayoutOptions: React.Dispatch<React.SetStateAction<Array<{ path: string; name: string }>>>;
	setSlideMasters: React.Dispatch<React.SetStateAction<PptxSlideMaster[]>>;
	setTheme: React.Dispatch<React.SetStateAction<PptxTheme | undefined>>;
	setTableStyleMap: React.Dispatch<React.SetStateAction<ParsedTableStyleMap | undefined>>;
	setThemeOptions: React.Dispatch<React.SetStateAction<PptxThemeOption[]>>;
	setCustomShows: React.Dispatch<React.SetStateAction<PptxCustomShow[]>>;
	/**
	 * Seeds the running show from `p:showPr/p:custShow/@id`, so a deck authored
	 * to open into a custom show plays that subset instead of the whole deck.
	 * A later manual pick still wins: this only fires on load.
	 */
	setActiveCustomShowId: React.Dispatch<React.SetStateAction<string | null>>;
	setSections: React.Dispatch<React.SetStateAction<PptxSection[]>>;
	setPresentationProperties: React.Dispatch<React.SetStateAction<PptxPresentationProperties>>;
	setViewProperties: React.Dispatch<React.SetStateAction<PptxViewProperties | undefined>>;
	setNotesMaster: React.Dispatch<React.SetStateAction<PptxNotesMaster | undefined>>;
	setHandoutMaster: React.Dispatch<React.SetStateAction<PptxHandoutMaster | undefined>>;
	setNotesCanvasSize: React.Dispatch<React.SetStateAction<CanvasSize | undefined>>;
	setCustomProperties: React.Dispatch<React.SetStateAction<PptxCustomProperty[]>>;
	setTagCollections: React.Dispatch<React.SetStateAction<PptxTagCollection[]>>;
	setCoreProperties: React.Dispatch<React.SetStateAction<PptxCoreProperties | undefined>>;
	setAppProperties: React.Dispatch<React.SetStateAction<PptxAppProperties | undefined>>;
	setEmbeddedFonts: React.Dispatch<React.SetStateAction<PptxEmbeddedFont[]>>;
	setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
	setHasMacros: React.Dispatch<React.SetStateAction<boolean>>;
	setHasDigitalSignatures: React.Dispatch<React.SetStateAction<boolean>>;
	setDigitalSignatureCount: React.Dispatch<React.SetStateAction<number>>;
	setGuides: React.Dispatch<
		React.SetStateAction<Array<{ id: string; axis: 'h' | 'v'; position: number }>>
	>;
	setLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setError: React.Dispatch<React.SetStateAction<string | null>>;
	setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
	setIsEncrypted: React.Dispatch<React.SetStateAction<boolean>>;
	/**
	 * Called after a parse fully applies to viewer state (setSlides & co.).
	 * Collaboration uses this to re-adopt the shared doc's slides when a local
	 * load lands mid-session and would otherwise clobber remotely-synced state.
	 */
	onContentApplied?: () => void;
}

export interface UseLoadContentResult {
	handlerRef: React.MutableRefObject<PptxHandler | null>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useLoadContent({
	content,
	clearSelection,
	history,
	setSlides,
	setTemplateElementsBySlideId,
	mediaDataUrls,
	setCanvasSize,
	setSlideSizeEmu,
	setHeaderFooter,
	setLayoutOptions,
	setSlideMasters,
	setTheme,
	setTableStyleMap,
	setThemeOptions,
	setCustomShows,
	setActiveCustomShowId,
	setSections,
	setPresentationProperties,
	setViewProperties,
	setNotesMaster,
	setHandoutMaster,
	setNotesCanvasSize,
	setCustomProperties,
	setTagCollections,
	setCoreProperties,
	setAppProperties,
	setEmbeddedFonts,
	setActiveSlideIndex,
	setHasMacros,
	setHasDigitalSignatures,
	setDigitalSignatureCount,
	setGuides,
	setLoading,
	setError,
	setIsDirty,
	setIsEncrypted,
	onContentApplied,
}: UseLoadContentInput): UseLoadContentResult {
	const handlerRef = useRef<PptxHandler | null>(null);
	const originalBufferRef = useRef<ArrayBuffer | null>(null);
	const renderTokenRef = useRef(0);

	useEffect(() => {
		if (!content) {
			return;
		}
		let cancelled = false;
		const token = ++renderTokenRef.current;

		// Track Blob URLs created in this load cycle so they can be revoked
		// on unmount or when a new file is loaded.
		const loadBlobUrls: string[] = [];

		(async () => {
			try {
				setLoading(true);
				setError(null);
				const buffer =
					content instanceof Uint8Array
						? content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)
						: content;
				originalBufferRef.current = buffer instanceof ArrayBuffer ? buffer : null;

				// ── Large file warning ──────────────────────────────────────
				const fileSizeMB = buffer instanceof ArrayBuffer ? buffer.byteLength / (1024 * 1024) : 0;
				if (fileSizeMB > 50) {
					console.warn(
						`[pptx] Large file detected (${fileSizeMB.toFixed(1)} MB). ` +
							`Loading may use significant memory.`,
					);
				}

				// Capture the previous handler so we can dispose it AFTER the new
				// load resolves. Disposing too early would yank Blob URLs that
				// are still being painted by the previous render, causing flashes
				// of broken images while the new file loads.
				const previousHandler = handlerRef.current;

				const handler = new PptxHandler();
				const parsed = await handler.load(buffer as ArrayBuffer);
				if (cancelled || token !== renderTokenRef.current) {
					handler.dispose();
					return;
				}

				// New load succeeded: now safe to dispose the previous handler.
				if (previousHandler) {
					previousHandler.dispose();
				}
				handlerRef.current = null;

				// ── Resolve media Blob URLs (audio/video) ───────────────────
				const mediaElements: MediaPptxElement[] = [];
				for (const slide of parsed.slides) {
					collectMediaElements(slide.elements, mediaElements);
				}
				// Revoke old media Blob URLs before replacing
				for (const url of mediaDataUrls.values()) {
					if (url.startsWith('blob:')) {
						URL.revokeObjectURL(url);
					}
				}
				mediaDataUrls.clear();
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
									const blob = new Blob([arrayBuffer], { type: mimeType });
									const blobUrl = URL.createObjectURL(blob);
									loadBlobUrls.push(blobUrl);
									mediaDataUrls.set(mediaPath, blobUrl);
								} else {
									mediaElement.mediaMissing = true;
								}
							} else {
								const dataUrl = await handler.getImageData(mediaPath);
								if (dataUrl) {
									mediaDataUrls.set(mediaPath, dataUrl);
								} else {
									mediaElement.mediaMissing = true;
								}
							}
						} catch {
							mediaElement.mediaMissing = true;
						}
					}),
				);

				// ── Resolve image Blob URLs (lazy-loaded pictures) ──────────
				// With eagerDecodeImages=false (default), picture elements have
				// imagePath but no imageData after parse.  Resolve them now
				// using getImageData which returns Blob URLs in browsers.
				const { paths: imagePaths, refs: imageRefs } = collectImagePaths(parsed.slides);
				let nextSlides = parsed.slides;
				if (imagePaths.size > 0) {
					// Load unique paths in parallel, then fan out to all refs
					const resolvedMap = new Map<string, string>();
					await Promise.all(
						Array.from(imagePaths).map(async (path) => {
							try {
								const url = await handler.getImageData(path);
								if (url) {
									resolvedMap.set(path, url);
								}
							} catch {
								// Non-critical: image will show as broken
							}
						}),
					);
					// Build a per-element-id patch map (id → { field: url, ... })
					// outside the transform loop so we don't repeat lookups.
					const elementPatches = new Map<string, Record<string, string>>();
					for (const ref of imageRefs) {
						const url = resolvedMap.get(ref.path);
						if (!url) {
							continue;
						}
						const id = ref.element.id;
						const existing = elementPatches.get(id) ?? {};
						existing[ref.field] = url;
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

				// ── Resolve table cell image-fill Blob URLs ─────────────────
				// Same lazy-load story as picture elements above: a cell's
				// `a:tcPr/a:blipFill` parses to an archive path
				// (`backgroundImageFillPath`), resolved here to a displayable URL.
				const { paths: tableImagePaths, refs: tableImageRefs } =
					collectTableCellImagePaths(nextSlides);
				if (tableImagePaths.size > 0) {
					const resolvedTableMap = new Map<string, string>();
					await Promise.all(
						Array.from(tableImagePaths).map(async (path) => {
							try {
								const url = await handler.getImageData(path);
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

				// ── Resolve whole-table-STYLE image-fill Blob URLs ──────────
				// Same lazy-load story as the per-cell image fill above, but for a
				// whole `a:tcStyle/a:fill/a:blipFill` on `ppt/tableStyles.xml`
				// (presentation-level, not per-slide).
				let nextTableStyleMap = parsed.tableStyleMap;
				const { paths: tableStyleImagePaths, refs: tableStyleImageRefs } =
					collectTableStyleImagePaths(nextTableStyleMap);
				if (tableStyleImagePaths.size > 0) {
					const resolvedStyleMap = new Map<string, string>();
					await Promise.all(
						Array.from(tableStyleImagePaths).map(async (path) => {
							try {
								const url = await handler.getImageData(path);
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

				handlerRef.current = handler;
				// Separate the inherited master/layout (template) elements that the
				// core loader merged into `slide.elements` into their own per-slide
				// store. They get a dedicated, gated render layer and are merged back
				// at save time (buildSaveSlides) so edits to them persist.
				const partition = partitionTemplateElements(nextSlides);
				setSlides(partition.slides);
				setTemplateElementsBySlideId(partition.templateElementsBySlideId);
				setCanvasSize({
					width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
					height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
				});
				// Keep the authored `p:sldSz` in EMU alongside the pixel canvas: the
				// pixels are what the stage renders, the EMU is what a save writes.
				setSlideSizeEmu(
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
				);
				setHeaderFooter(parsed.headerFooter ?? {});
				setLayoutOptions(parsed.layoutOptions ?? []);
				setSlideMasters(parsed.slideMasters ?? []);
				setTheme(parsed.theme);
				setTableStyleMap(nextTableStyleMap);
				setThemeOptions(parsed.themeOptions ?? []);
				setCustomShows(parsed.customShows ?? []);
				// "Set Up Slide Show > Custom show" is authored intent, not decoration:
				// honour `p:showPr/p:custShow/@id` so the deck opens into the show it
				// names. An id naming no surviving show falls back to the whole deck.
				setActiveCustomShowId(
					resolveAuthoredCustomShowId(parsed.presentationProperties, parsed.customShows) ?? null,
				);
				setSections(parsed.sections ?? []);
				setPresentationProperties(parsed.presentationProperties ?? {});
				setViewProperties(parsed.viewProperties);
				setNotesMaster(parsed.notesMaster);
				setHandoutMaster(parsed.handoutMaster);
				if (
					typeof parsed.notesWidthEmu === 'number' &&
					typeof parsed.notesHeightEmu === 'number' &&
					parsed.notesWidthEmu > 0 &&
					parsed.notesHeightEmu > 0
				) {
					setNotesCanvasSize({
						width: Math.round(parsed.notesWidthEmu / 9525),
						height: Math.round(parsed.notesHeightEmu / 9525),
					});
				} else {
					setNotesCanvasSize(undefined);
				}
				setCustomProperties(parsed.customProperties ?? []);
				setTagCollections(parsed.tags ?? []);
				setCoreProperties(parsed.coreProperties);
				setAppProperties(parsed.appProperties);
				setEmbeddedFonts(parsed.embeddedFonts ?? []);
				setHasMacros(parsed.hasMacros === true);
				setHasDigitalSignatures(parsed.hasDigitalSignatures === true);
				setDigitalSignatureCount(parsed.digitalSignatureCount ?? 0);

				// Initialize drawing guides from parsed presentation + slide data
				setGuides(buildInitialGuides(parsed.presentationGuides, parsed.slides[0]?.guides));

				setActiveSlideIndex(0);
				clearSelection();
				setIsDirty(false);
				history.resetHistory();
				onContentApplied?.();
			} catch (err) {
				if (!cancelled && token === renderTokenRef.current) {
					if (err instanceof EncryptedFileError) {
						setIsEncrypted(true);
					} else {
						// Log unexpected load failures to the console: `setError` only
						// surfaces the message if a UI surface renders it, and a silent
						// swallow here has previously masked real bugs (e.g. a caller
						// missing a newly-required setter) as inexplicable hangs.
						console.error('[pptx] Failed to load presentation content:', err);
						setError(err instanceof Error ? err.message : String(err));
					}
				}
			} finally {
				if (!cancelled && token === renderTokenRef.current) {
					setLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
			// Revoke media Blob URLs created during this load cycle
			for (const url of loadBlobUrls) {
				URL.revokeObjectURL(url);
			}
			// Dispose handler to free core-side Blob URLs and ZIP memory
			if (handlerRef.current) {
				handlerRef.current.dispose();
				handlerRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [content]);

	return { handlerRef };
}
