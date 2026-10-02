/**
 * Framework-neutral types for the ribbon style galleries (Shape Styles,
 * WordArt Styles, Picture Styles, Table Styles, Chart Styles, ...).
 *
 * A binding renders a gallery by asking `buildRibbonGallery(id, context)` for
 * a {@link RibbonGalleryDescriptor} and mapping it onto its own markup: a
 * trigger button, then a grid of tiles whose preview is the ready-made
 * `previewSvg` string. Clicking a tile calls
 * `applyRibbonGalleryItem(id, itemId, context)` and dispatches the returned
 * {@link RibbonGalleryApplyResult} to the binding's existing update path.
 * Everything that decides WHAT a gallery offers, how a tile looks and what
 * OOXML a pick writes lives in shared, so a new entry reaches all five
 * bindings at once.
 *
 * @module render/ribbon-galleries/gallery-types
 */
import type {
	PptxElement,
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	ResolvedStyleMatrix,
	XmlObject,
} from 'pptx-viewer-core';

/** Every gallery the ribbon offers. */
export type RibbonGalleryId =
	| 'shapeStyles'
	| 'shapeEffects'
	| 'wordArtStyles'
	| 'pictureStyles'
	| 'pictureCorrections'
	| 'pictureColor'
	| 'pictureArtisticEffects'
	| 'bullets'
	| 'numbering'
	| 'tableStyles'
	| 'chartStyles'
	| 'chartColors'
	| 'chartQuickLayout'
	| 'smartArtStyles'
	| 'smartArtColors'
	| 'smartArtLayouts'
	| 'smartArtAddShape'
	| 'smartArtAddBullet'
	| 'smartArtTextPane'
	| 'smartArtPromote'
	| 'smartArtDemote'
	| 'smartArtRightToLeft'
	| 'smartArtMoveUp'
	| 'smartArtMoveDown'
	| 'smartArtResetGraphic'
	| 'smartArtConvert'
	| 'themeColors'
	| 'themeFonts';

/** One tile. */
export interface RibbonGalleryItem {
	/** Stable within its gallery; what `applyRibbonGalleryItem` takes. */
	id: string;
	/** i18n key of the tile's accessible name / tooltip. */
	labelKey: string;
	/** `{{name}}` interpolation values for `labelKey`. */
	labelParams?: Readonly<Record<string, string | number>>;
	/** English fallback for bindings whose dictionary lacks `labelKey`. */
	label: string;
	/**
	 * A complete, self-contained `<svg>` element (width/height/viewBox set).
	 * Built only from catalogue data and theme colours, never from user text,
	 * so it is safe to inject as markup.
	 */
	previewSvg: string;
	/**
	 * CSS `filter` the tile's preview carries (the Picture Adjust galleries),
	 * for a host that draws the thumbnail over a real image instead of
	 * `previewSvg`. Omitted when the preset has no CSS-expressible preview.
	 */
	previewFilter?: string;
	/** True when this entry is what the selection currently carries. */
	applied: boolean;
}

/** A titled block of tiles (PowerPoint's "Theme Styles" / "Presets"). */
export interface RibbonGallerySection {
	id: string;
	/** i18n key of the section heading; omitted for an untitled section. */
	titleKey?: string;
	title?: string;
	/** Tiles per row in the dropped-down grid. */
	columns: number;
	/** Preview tile size in CSS px (the SVG's own width/height). */
	tileWidth: number;
	tileHeight: number;
	items: RibbonGalleryItem[];
}

export interface RibbonGalleryDescriptor {
	id: RibbonGalleryId;
	/** i18n key of the gallery trigger / group caption. */
	labelKey: string;
	label: string;
	sections: RibbonGallerySection[];
	/** True when the selection cannot take this gallery (trigger disabled). */
	disabled: boolean;
	/**
	 * Set when the entry is a one-button command (PowerPoint's Add Shape, Reset
	 * Graphic, ...) rather than a gallery: the element draws a plain command, a
	 * click picks its only item and no panel opens.
	 */
	command?: RibbonGalleryCommandView;
}

/** How a command-style entry draws (see {@link RibbonGalleryDescriptor.command}). */
export interface RibbonGalleryCommandView {
	/** SVG path data on a 20px grid. */
	iconPath: string;
	/** Icon above the label (PowerPoint's large button) instead of beside it. */
	large?: boolean;
	/** i18n key and English fallback of the tooltip, e.g. why the command is unavailable. */
	hintKey?: string;
	hint?: string;
}

/**
 * What a gallery needs to know about the deck and the selection. Bindings
 * build it once per render from state they already hold.
 */
export interface RibbonGalleryContext {
	/** The primary selected element, or null. */
	element: PptxElement | null;
	/** `PptxData.themeColorMap`: scheme key -> hex. */
	themeColorMap?: Readonly<Record<string, string>>;
	/** `PptxData.theme`. */
	theme?: PptxTheme;
	/**
	 * The handler's `resolveStyleMatrixReferences`, bound. Shape Styles use it
	 * to resolve `<p:style>` exactly as the load path does; without it they
	 * fall back to an approximation from `themeColorMap`.
	 */
	resolveStyleMatrix?: (styleXml: XmlObject) => ResolvedStyleMatrix;
}

/** What a pick asks the binding to do. */
export type RibbonGalleryApplyResult =
	| {
			kind: 'element';
			elementId: string;
			/** Merge onto the element with the binding's normal update + history path. */
			patch: Partial<PptxElement>;
	  }
	| {
			kind: 'themeColorScheme';
			colorScheme: PptxThemeColorScheme;
			name: string;
	  }
	| {
			kind: 'themeFontScheme';
			fontScheme: PptxThemeFontScheme;
			name: string;
	  };
