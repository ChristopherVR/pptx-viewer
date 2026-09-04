/** Headers and footers used when a classic ChartML chart is printed. */
export interface PptxChartPrintHeaderFooter {
	oddHeader?: string;
	oddFooter?: string;
	evenHeader?: string;
	evenFooter?: string;
	firstHeader?: string;
	firstFooter?: string;
	alignWithMargins?: boolean;
	differentOddEven?: boolean;
	differentFirst?: boolean;
	/** Original subtree retained for foreign attributes and extension children. */
	rawXml?: unknown;
}

/** Required page margins from ChartML `c:pageMargins`, measured in inches. */
export interface PptxChartPageMargins {
	left: number;
	right: number;
	top: number;
	bottom: number;
	header: number;
	footer: number;
	/** Original leaf retained for foreign attributes. */
	rawXml?: unknown;
}

/** Printer page configuration from ChartML `c:pageSetup`. */
export interface PptxChartPageSetup {
	paperSize?: number;
	firstPageNumber?: number;
	orientation?: 'default' | 'portrait' | 'landscape';
	blackAndWhite?: boolean;
	draft?: boolean;
	useFirstPageNumber?: boolean;
	horizontalDpi?: number;
	verticalDpi?: number;
	copies?: number;
	/**
	 * Custom paper height, used when {@link paperSize} is `0`
	 * (`c:pageSetup/@paperHeight`, ST_PositiveUniversalMeasure, e.g. `"297mm"`).
	 * Kept as the raw measure string rather than converted, matching how the
	 * schema stores it.
	 */
	paperHeight?: string;
	/** Custom paper width, used when {@link paperSize} is `0` (`@paperWidth`). */
	paperWidth?: string;
	/** Original leaf retained for foreign attributes. */
	rawXml?: unknown;
}

/** Editable `c:printSettings` content from a classic ChartML chart space. */
export interface PptxChartPrintSettings {
	headerFooter?: PptxChartPrintHeaderFooter | null;
	pageMargins?: PptxChartPageMargins | null;
	pageSetup?: PptxChartPageSetup | null;
	/** `null` removes the legacy header/footer drawing relationship element. */
	legacyDrawingHeaderFooterRelationshipId?: string | null;
	/** Original subtree retained for unknown and extension content. */
	rawXml?: unknown;
}
