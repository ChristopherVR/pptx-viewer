import type { PptxXmlBuilder } from '../builders/fluent';
import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomerData,
	PptxChartData,
	PptxCompatibilityWarning,
	PptxCustomShow,
	PptxEmbeddedFont,
	PptxEmbeddedFontList,
	PptxExportOptions,
	PptxHandoutMaster,
	PptxLayoutOption,
	PptxData,
	PptxElement,
	PptxHeaderFooter,
	PptxKinsoku,
	PptxModifyVerifier,
	PptxNotesMaster,
	PptxPhotoAlbum,
	PptxPresentationProperties,
	PptxSection,
	PptxSlide,
	PptxSlideLayout,
	PptxSlideMaster,
	PptxSmartArtData,
	PptxTagCollection,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxViewProperties,
	ParsedTableStyleMap,
	XmlObject,
} from '../types';

export interface PptxHandlerLoadOptions {
	eagerDecodeImages?: boolean;
	password?: string;
	/**
	 * Maximum total uncompressed bytes accepted from the input ZIP archive.
	 * Defaults to 500 MiB. When the sum of `_data.uncompressedSize` across
	 * all archive entries exceeds this cap, `load()` rejects with a
	 * {@link ZipBombError}. A hard cap of 65 536 archive entries also
	 * applies.
	 */
	maxUncompressedBytes?: number;
	/**
	 * When `false` (default), relationship targets that resolve to
	 * `http://` or `https://` URLs are dropped from rendered slides
	 * (image, picture, background). Set to `true` to allow external image
	 * URLs to flow through to `<img src>`.
	 *
	 * Disabled by default to mitigate SSRF / privacy-leak vectors in
	 * server-side rendering and headless export pipelines.
	 */
	allowExternalImages?: boolean;
}

/**
 * Default maximum uncompressed byte budget for {@link PptxHandlerLoadOptions.maxUncompressedBytes}.
 * 500 MiB.
 */
export const DEFAULT_MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;

/**
 * Hard cap on archive entry count. Beyond this, the package is rejected.
 */
export const MAX_ZIP_ENTRY_COUNT = 65536;

/**
 * Thrown by the load pipeline when a ZIP archive exceeds the configured
 * uncompressed-size budget or the entry-count limit.
 */
export class ZipBombError extends Error {
	public readonly code = 'ZIP_BOMB';

	public readonly uncompressedBytes: number | undefined;

	public readonly limit: number;

	public readonly entryCount: number | undefined;

	constructor(
		message: string,
		details: { uncompressedBytes?: number; limit: number; entryCount?: number },
	) {
		super(message);
		this.name = 'ZipBombError';
		this.uncompressedBytes = details.uncompressedBytes;
		this.limit = details.limit;
		this.entryCount = details.entryCount;
	}
}

/** Output format for the save pipeline. */
export type PptxSaveFormat = 'pptx' | 'ppsx' | 'pptm';

export interface PptxHandlerSaveOptions {
	headerFooter?: PptxHeaderFooter;
	presentationProperties?: PptxPresentationProperties;
	customShows?: PptxCustomShow[];
	sections?: PptxSection[];
	coreProperties?: PptxCoreProperties;
	appProperties?: PptxAppProperties;
	customProperties?: PptxCustomProperty[];
	/** Updated notes master data to save back to notesMaster1.xml. */
	notesMaster?: PptxNotesMaster;
	/** Updated handout master data to save back to handoutMaster1.xml. */
	handoutMaster?: PptxHandoutMaster;
	/**
	 * Updated slide masters to save back to ppt/slideMasters/slideMaster*.xml.
	 * Each entry in the array applies typed mutations (clrMap, hf flags,
	 * background) to the master at its `path`. Masters not listed here pass
	 * through verbatim from the original load.
	 */
	slideMasters?: PptxSlideMaster[];
	/**
	 * Updated slide layouts to save back to ppt/slideLayouts/slideLayout*.xml.
	 * Each entry applies typed mutations (clrMapOverride, attrs, hf flags,
	 * background) to the layout at its `path`. Layouts not listed here pass
	 * through verbatim from the original load.
	 */
	slideLayouts?: PptxSlideLayout[];
	/** Updated tag collections to save back to ppt/tags/tag*.xml. */
	tags?: PptxTagCollection[];
	/** Presentation-level customer data references to author or update. */
	customerData?: PptxCustomerData[];
	/** Photo album metadata to save back to `p:photoAlbum`. */
	photoAlbum?: PptxPhotoAlbum;
	/** East Asian line-break settings to save back to `p:kinsoku`. */
	kinsoku?: PptxKinsoku | null;
	/** Write-protection verifier. Set to `null` to remove, `undefined` to preserve existing. */
	modifyVerifier?: PptxModifyVerifier | null;
	/** View properties to save back to ppt/viewProps.xml. */
	viewProperties?: PptxViewProperties;
	/**
	 * Table style edits to save back to `ppt/tableStyles.xml`. Pass the
	 * `tableStyleMap` from `PptxData` (optionally with edited entries)
	 * to persist user edits. The `def` GUID and any unmodelled XML are
	 * preserved verbatim. Omitting the option round-trips the original
	 * part untouched.
	 */
	tableStyles?: ParsedTableStyleMap;
	/**
	 * Target output format.
	 * - `'pptx'` (default): Standard presentation.
	 * - `'ppsx'`: Slide-show file (opens in presentation mode).
	 * - `'pptm'`: Macro-enabled presentation (requires VBA data).
	 */
	outputFormat?: PptxSaveFormat;
	/**
	 * Embedded fonts to write back (or add) to the saved PPTX.
	 *
	 * Pass the `embeddedFonts` array from `PptxData` to preserve existing
	 * embedded fonts during save. You can also add new fonts by including
	 * entries with `rawFontData` populated.
	 *
	 * When omitted, the save pipeline will automatically re-embed any
	 * fonts that were loaded from the original PPTX and have `rawFontData`
	 * preserved (i.e. the default is lossless round-trip).
	 */
	embeddedFonts?: PptxEmbeddedFont[];
	/** Typed embedded-font list metadata. Set to null to remove fonts and relationships. */
	embeddedFontList?: PptxEmbeddedFontList | null;
	/**
	 * OOXML conformance class for the saved output.
	 * - `'preserve'` (default): use the same conformance as the loaded file.
	 * - `'strict'`: force Strict Open XML (ISO/IEC 29500) namespace URIs.
	 * - `'transitional'`: force Transitional (ECMA-376) namespace URIs.
	 */
	conformance?: 'strict' | 'transitional' | 'preserve';
}

export interface IPptxHandlerRuntime {
	/**
	 * Release all resources held by this runtime (Blob URLs, caches, ZIP).
	 * After calling, the runtime cannot be used further.
	 */
	dispose(): void;

	/**
	 * Revoke all Blob URLs created during image loading.
	 */
	revokeBlobUrls(): void;

	getCompatibilityWarnings(): PptxCompatibilityWarning[];
	getLayoutOptions(): PptxLayoutOption[];
	createXmlBuilder(data: PptxData): PptxXmlBuilder;
	Builder(data: PptxData): PptxXmlBuilder;
	setTemplateBackground(path: string, backgroundColor: string | undefined): void;
	setPresentationTheme(themePath: string, applyToAllMasters?: boolean): Promise<void>;
	getTemplateBackgroundColor(path: string): string | undefined;
	updateThemeColorScheme(colorScheme: PptxThemeColorScheme): Promise<void>;
	updateThemeFontScheme(fontScheme: PptxThemeFontScheme): Promise<void>;
	updateThemeName(name: string): Promise<void>;
	applyTheme(
		colorScheme: PptxThemeColorScheme,
		fontScheme: PptxThemeFontScheme,
		themeName?: string,
	): Promise<void>;
	load(data: ArrayBuffer, options?: PptxHandlerLoadOptions): Promise<PptxData>;
	getChartDataForGraphicFrame(
		slidePath: string,
		graphicFrame: XmlObject | undefined,
	): Promise<PptxChartData | undefined>;
	getSmartArtDataForGraphicFrame(
		slidePath: string,
		graphicFrame: XmlObject | undefined,
	): Promise<PptxSmartArtData | undefined>;
	getImageData(imagePath: string): Promise<string | undefined>;
	/**
	 * Extract a media file from the PPTX archive as an ArrayBuffer.
	 * Returns undefined if the file is not found.
	 */
	getMediaArrayBuffer(mediaPath: string): Promise<ArrayBuffer | undefined>;
	save(slides: PptxSlide[], options?: PptxHandlerSaveOptions): Promise<Uint8Array>;
	exportSlides(slides: PptxSlide[], options: PptxExportOptions): Promise<Map<number, Uint8Array>>;
	/**
	 * Get the available slide layouts for a specific slide, based on the
	 * slide's master. Scans the slide master's relationships to find all
	 * layouts that belong to it.
	 *
	 * @param slideIndex - Zero-based slide index.
	 * @param slides - Current slides array.
	 * @returns Array of layout options belonging to the same slide master.
	 */
	getAvailableLayoutsForSlide(slideIndex: number, slides: PptxSlide[]): Promise<PptxLayoutOption[]>;
	/**
	 * Resolve the editable template (master + layout) elements a slide
	 * inherits, each carrying a `master-` / `layout-` prefixed id. Excludes
	 * placeholders; returns only decorative shapes/pictures/graphic frames.
	 *
	 * @param slideId - The slide's archive path (`PptxSlide.id`).
	 */
	getTemplateElementsForSlide(slideId: string): Promise<PptxElement[]>;
	/**
	 * Scan the loaded PPTX archive for all theme parts.
	 */
	getAvailableThemes(): Promise<Array<{ path: string; name?: string }>>;
	/**
	 * Apply a different layout to an existing slide by updating the slide's
	 * relationship to point to the new layout and re-parsing layout
	 * placeholders / background.
	 *
	 * @param slideIndex - Zero-based slide index.
	 * @param layoutPath - Archive path of the target layout
	 *                     (e.g. `ppt/slideLayouts/slideLayout2.xml`).
	 * @param slides - Current slides array.
	 * @returns The updated slide with new layout path, name, and background.
	 */
	applyLayoutToSlide(
		slideIndex: number,
		layoutPath: string,
		slides: PptxSlide[],
	): Promise<PptxSlide>;
}
