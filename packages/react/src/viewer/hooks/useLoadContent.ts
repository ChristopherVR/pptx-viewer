import type {
	PptxAppProperties,
	MediaPptxElement,
	PptxElement,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxEmbeddedFont,
	PptxHeaderFooter,
	PptxHandoutMaster,
	PptxModernCommentAuthor,
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
import type {
	CompatibilityWarningToast,
	ReadOnlyRecommendation,
	SlideSizeEmu,
} from 'pptx-viewer-shared';
import {
	applyImagePathPatches,
	compatibilityWarningToasts,
	readOnlyRecommendation,
	resolveAuthoredCustomShowId,
	resolveTableCellImageUrls,
	resolveTableStyleImageUrls,
	seedRecentColors,
} from 'pptx-viewer-shared';
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
	buildInitialGuides,
	resolveMediaElementSource,
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
	setModernCommentAuthors: React.Dispatch<React.SetStateAction<PptxModernCommentAuthor[]>>;
	/** Seeds the "Recent Colors" row (`p:clrMru`) every colour picker shares. */
	setRecentColors: React.Dispatch<React.SetStateAction<string[]>>;
	setTheme: React.Dispatch<React.SetStateAction<PptxTheme | undefined>>;
	setTableStyleMap: React.Dispatch<React.SetStateAction<ParsedTableStyleMap | undefined>>;
	setTableStylesDefaultId: React.Dispatch<React.SetStateAction<string | undefined>>;
	setTableStylesToDelete: React.Dispatch<React.SetStateAction<string[]>>;
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
	/** Whether the loaded deck recommends opening read-only (`p:modifyVerifier` / "Mark as Final"). */
	setReadOnlyRecommendation: React.Dispatch<React.SetStateAction<ReadOnlyRecommendation>>;
	/** Deck + slide compatibility-warning toast stack for this load. */
	setCompatToasts: React.Dispatch<React.SetStateAction<CompatibilityWarningToast[]>>;
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
	/**
	 * File > Options > Trust Center > "Allow external content". Forwarded to
	 * `PptxHandler.load` as `allowExternalImages`; core defaults this to
	 * `false` (drop `http(s)://` image sources) regardless of what this flag
	 * says unless it is passed through explicitly.
	 */
	allowExternalImages?: boolean;
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
	setModernCommentAuthors,
	setRecentColors,
	setTheme,
	setTableStyleMap,
	setTableStylesDefaultId,
	setTableStylesToDelete,
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
	setReadOnlyRecommendation,
	setCompatToasts,
	setLoading,
	setError,
	setIsDirty,
	setIsEncrypted,
	onContentApplied,
	allowExternalImages,
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
				// Trust Center > "Allow external content" (default off, matching
				// core's own SSRF/privacy-safe default): only pass `true` through
				// when the option is explicitly on.
				const parsed = await handler.load(buffer as ArrayBuffer, { allowExternalImages });
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
				// Shared with the other four bindings (G17): a LINKED media
				// element's `mediaPath` is already the verbatim external URL by
				// the time it reaches here, and `resolveMediaElementSource` hands
				// it straight back instead of attempting an archive lookup that
				// can only ever find embedded parts.
				await Promise.all(
					mediaElements.map(async (mediaElement) => {
						const resolved = await resolveMediaElementSource(mediaElement, handler);
						if (resolved.missing || !resolved.mediaPath || !resolved.url) {
							mediaElement.mediaMissing = true;
							return;
						}
						mediaDataUrls.set(resolved.mediaPath, resolved.url);
						if (resolved.isBlobUrl) {
							loadBlobUrls.push(resolved.url);
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
					// The per-element-id patch map + group-recursing tree walk are the
					// shared `applyImagePathPatches` / `walkAndPatchElements`
					// (loader/element-patch-walker.ts), which every binding's
					// `useLoadContent` used to hand-roll identically.
					nextSlides = parsed.slides.map((s) => {
						const newElements = applyImagePathPatches(s.elements, resolvedMap, imageRefs);
						return newElements === s.elements ? s : { ...s, elements: newElements };
					});
				}

				// ── Resolve table cell + whole-table-STYLE image-fill Blob URLs ──
				// Same lazy-load story as picture elements above: a cell's
				// `a:tcPr/a:blipFill` (per-slide) and a `a:tcStyle/a:fill/a:blipFill`
				// on `ppt/tableStyles.xml` (presentation-level) each parse to an
				// archive path, resolved here to a displayable URL. The collect +
				// resolve + patch orchestration is the shared
				// `resolveTableCellImageUrls` / `resolveTableStyleImageUrls`
				// (loader/lazy-image-resolution.ts).
				nextSlides = await resolveTableCellImageUrls(nextSlides, (path) =>
					handler.getImageData(path),
				);
				const nextTableStyleMap = await resolveTableStyleImageUrls(parsed.tableStyleMap, (path) =>
					handler.getImageData(path),
				);

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
				setModernCommentAuthors(parsed.modernCommentAuthors ?? []);
				setRecentColors(seedRecentColors({ mruColors: parsed.mruColors }));
				setTheme(parsed.theme);
				setTableStyleMap(nextTableStyleMap);
				setTableStylesDefaultId(parsed.tableStylesDefaultId);
				setTableStylesToDelete([]);
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

				// Whether this deck asks to be opened read-only, and the deck + slide
				// compatibility-warning toast stack: both reset wholesale on every
				// load, matching every other setter here.
				setReadOnlyRecommendation(readOnlyRecommendation(parsed));
				setCompatToasts(
					compatibilityWarningToasts([
						...(parsed.warnings ?? []),
						...parsed.slides.flatMap((slide) => slide.warnings ?? []),
					]),
				);

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
