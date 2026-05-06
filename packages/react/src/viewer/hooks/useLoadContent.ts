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
	ParsedTableStyleMap,
} from 'pptx-viewer-core';
import { PptxHandler, EncryptedFileError } from 'pptx-viewer-core';
/**
 * useLoadContent — Handles loading/parsing PPTX content into viewer state.
 *
 * Extracts the heavy loading useEffect from PowerPointViewer so the
 * orchestrator stays lean.
 */
import { useEffect, useRef } from 'react';

import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../constants';
import type { CanvasSize } from '../types';
import {
	collectMediaElements,
	collectImagePaths,
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
	setHeaderFooter: React.Dispatch<React.SetStateAction<PptxHeaderFooter>>;
	setLayoutOptions: React.Dispatch<React.SetStateAction<Array<{ path: string; name: string }>>>;
	setSlideMasters: React.Dispatch<React.SetStateAction<PptxSlideMaster[]>>;
	setTheme: React.Dispatch<React.SetStateAction<PptxTheme | undefined>>;
	setTableStyleMap: React.Dispatch<React.SetStateAction<ParsedTableStyleMap | undefined>>;
	setThemeOptions: React.Dispatch<React.SetStateAction<PptxThemeOption[]>>;
	setCustomShows: React.Dispatch<React.SetStateAction<PptxCustomShow[]>>;
	setSections: React.Dispatch<React.SetStateAction<PptxSection[]>>;
	setPresentationProperties: React.Dispatch<React.SetStateAction<PptxPresentationProperties>>;
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
	setHeaderFooter,
	setLayoutOptions,
	setSlideMasters,
	setTheme,
	setTableStyleMap,
	setThemeOptions,
	setCustomShows,
	setSections,
	setPresentationProperties,
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

				// New load succeeded — now safe to dispose the previous handler.
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

				handlerRef.current = handler;
				setSlides(nextSlides);
				setTemplateElementsBySlideId({});
				setCanvasSize({
					width: parsed.width ?? DEFAULT_CANVAS_WIDTH,
					height: parsed.height ?? DEFAULT_CANVAS_HEIGHT,
				});
				setHeaderFooter(parsed.headerFooter ?? {});
				setLayoutOptions(parsed.layoutOptions ?? []);
				setSlideMasters(parsed.slideMasters ?? []);
				setTheme(parsed.theme);
				setTableStyleMap(parsed.tableStyleMap);
				setThemeOptions(parsed.themeOptions ?? []);
				setCustomShows(parsed.customShows ?? []);
				setSections(parsed.sections ?? []);
				setPresentationProperties(parsed.presentationProperties ?? {});
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
			} catch (err) {
				if (!cancelled && token === renderTokenRef.current) {
					if (err instanceof EncryptedFileError) {
						setIsEncrypted(true);
					} else {
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
