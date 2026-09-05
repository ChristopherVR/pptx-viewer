import type { PptxChartLegendTextStyle, PptxChartMarker, PptxChartShapeProps } from './chart';
import type { XmlObject } from './common';

export interface PptxChartPivotFormat {
	index: number;
	/**
	 * Typed projection of `spPr` (fill/stroke colour, stroke width, dash
	 * style). When the parser is given a colour resolver (the normal case: the
	 * runtime always supplies one), both a literal `a:srgbClr` and an
	 * `a:schemeClr` theme reference (with its `lumMod`/`lumOff`/`tint`/`shade`
	 * modifiers) resolve to a hex colour here, the same theme +
	 * `c:clrMapOvr` chain the rest of chart parsing uses. Without a resolver
	 * (e.g. a hand-built `PptxChartPivotFormat` with no theme to resolve
	 * against), only the literal case resolves. Either way the authored node
	 * is byte-preserved through {@link shapePropertiesXml} until this field is
	 * set to something that no longer matches what re-parses off the current
	 * XML; setting it then re-derives `shapePropertiesXml` on save (merged
	 * onto whatever was already authored, keeping an unrelated schemeClr
	 * reference alive when the colour itself is unchanged) unless
	 * `shapePropertiesXml` is set explicitly, which wins.
	 */
	shapeProperties?: PptxChartShapeProps;
	/**
	 * Typed projection of `txPr`'s `a:p/a:pPr/a:defRPr` (size/bold/italic/
	 * colour/family), the same shape a legend entry or data-table's text
	 * override models. Colour resolution mirrors {@link shapeProperties}
	 * (theme-resolved `schemeClr` when a colour resolver is supplied, literal
	 * `srgbClr` otherwise). See {@link txPrXml} for the raw fallback.
	 */
	textStyle?: PptxChartLegendTextStyle;
	/**
	 * Typed projection of `marker` (symbol/size/spPr). See {@link markerXml}
	 * for the raw fallback.
	 */
	marker?: PptxChartMarker;
	shapePropertiesXml?: XmlObject | null;
	txPrXml?: XmlObject | null;
	markerXml?: XmlObject | null;
	dataLabelXml?: XmlObject | null;
	extensionListXml?: XmlObject | null;
	rawXml?: XmlObject;
}

/** Editable classic ChartML `c:pivotFmts` collection. */
export interface PptxChartPivotFormats {
	formats: PptxChartPivotFormat[];
	rawXml?: XmlObject;
}
