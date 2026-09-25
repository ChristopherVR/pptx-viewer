/**
 * The box a chart data label is drawn in: its `c:dLbls/c:spPr` fill and
 * outline, and the callout shape PowerPoint 2013+ stores in the chart15
 * extension (`c:extLst/c:ext/c15:spPr/a:prstGeom/@prst`, e.g.
 * `wedgeRectCallout`), plus the extension's own `c15:showLeaderLines`, which
 * is the flag PowerPoint honours for a moved label's leader line even when
 * the base `c:showLeaderLines` says 0.
 *
 * COM-verified against charts-com.pptx slide 17: every label of series 1 is
 * a pale-yellow callout pointing at its bar. These were parsed nowhere, so
 * the labels rendered as bare text.
 *
 * @module chart-data-label-box
 */
import type { PptxChartDataLabelOptions, XmlObject } from '../types';
import { findChart15Ext } from './chart-data-label-field-table';
import { parseShapeProps } from './chart-series-detail-parser';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}

interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

/** Parse a `c:dLbls` group's label box fields onto `result`. */
export function parseDataLabelBox(
	group: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	result: PptxChartDataLabelOptions,
): void {
	const shape = parseShapeProps(
		xmlLookup.getChildByLocalName(group, 'spPr'),
		xmlLookup,
		colorParser,
	);
	if (shape && (shape.fillColor !== undefined || shape.strokeColor !== undefined)) {
		result.labelShape = shape;
	}
	const ext = findChart15Ext(group, xmlLookup);
	const prst = xmlLookup.getChildByLocalName(
		xmlLookup.getChildByLocalName(ext, 'spPr'),
		'prstGeom',
	)?.['@_prst'];
	if (typeof prst === 'string' && prst.length > 0) {
		result.calloutShape = prst;
	}
	const leader = xmlLookup.getChildByLocalName(ext, 'showLeaderLines')?.['@_val'];
	if (leader !== undefined) {
		result.extLeaderLines = leader === '1' || leader === 'true';
	}
}
