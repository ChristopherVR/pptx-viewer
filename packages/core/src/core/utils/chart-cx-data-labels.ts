/**
 * Parser for `cx:dataLabels` on a ChartEx (`cx:`) series: visibility flags,
 * per-point overrides (`cx:dataLabel`), and the group/point-level position
 * (`@pos`) and number format (`cx:numFmt`) PowerPoint's ChartEx label dialog
 * writes (C2-G4).
 *
 * `cx:dataLabels/@pos` and `cx:dataLabel/@pos` reuse the existing
 * `PptxChartDataLabelPosition` enum (`PptxChartDataLabel.position` /
 * `PptxChartDataLabelOptions.position`) already populated by classic chart
 * parsing, so the shared render layer needs no cx-specific branch once G3
 * (bar/line label placement honouring `position`) lands. `cx:numFmt` maps
 * onto the equally shared `numberFormat` field. `cx:dataLabels/cx:txPr` /
 * `cx:dataLabel/cx:txPr` (font size/colour/bold, wave-1 skip) map onto the
 * `txPr` field classic `c:dLbls`/`c:dLbl` now populate the same way
 * (`chart-data-label-parser.ts`): both shapes are the identical
 * `.../a:p/a:pPr/a:defRPr` DrawingML text-properties body, so this reuses
 * `chart-def-rpr-style.ts`'s resolver instead of hand-rolling a cx-specific
 * one (CLAUDE.md Rule 2).
 *
 * @module utils/chart-cx-data-labels
 */

import type {
	PptxChartDataLabel,
	PptxChartDataLabelOptions,
	PptxChartDataLabelPosition,
	XmlObject,
} from '../types';
import type { XmlLookupLike } from './chart-cx-parser';
import { parseDefRPrTextStyle, resolveTxPrDefRPr } from './chart-def-rpr-style';

interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

const CX_LABEL_POSITIONS = new Set<PptxChartDataLabelPosition>([
	'bestFit',
	'b',
	'ctr',
	'inBase',
	'inEnd',
	'l',
	'outEnd',
	'r',
	't',
]);

function cxPosition(raw: unknown): PptxChartDataLabelPosition | undefined {
	return CX_LABEL_POSITIONS.has(raw as PptxChartDataLabelPosition)
		? (raw as PptxChartDataLabelPosition)
		: undefined;
}

function cxNumberFormat(node: XmlObject | undefined, xmlLookup: XmlLookupLike): string | undefined {
	const numFmt = xmlLookup.getChildByLocalName(node, 'numFmt');
	const formatCode = String(numFmt?.['@_formatCode'] ?? '').trim();
	return formatCode.length > 0 ? formatCode : undefined;
}

/** cx:dataLabels visibility flags extracted from cx:series. */
export interface CxDataLabelVisibility {
	showVal?: boolean;
	showCatName?: boolean;
	showSerName?: boolean;
}

/** Parse cx:dataLabels (group visibility/options, and per-point overrides) on a cx:series. */
export function parseCxDataLabels(
	ser: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser?: ColorParserLike,
	resolveTypeface?: (raw: string) => string,
):
	| {
			visibility: CxDataLabelVisibility;
			labels: PptxChartDataLabel[];
			options?: PptxChartDataLabelOptions;
	  }
	| undefined {
	const dlNode = xmlLookup.getChildByLocalName(ser, 'dataLabels');
	if (!dlNode) {
		return undefined;
	}

	const visibility: CxDataLabelVisibility = {};

	// cx:dataLabels may have cx:visibility with @seriesName, @categoryName, @value attributes
	const visNode = xmlLookup.getChildByLocalName(dlNode, 'visibility');
	if (visNode) {
		visibility.showVal = visNode['@_value'] === '1' || visNode['@_value'] === 'true';
		visibility.showCatName =
			visNode['@_categoryName'] === '1' || visNode['@_categoryName'] === 'true';
		visibility.showSerName = visNode['@_seriesName'] === '1' || visNode['@_seriesName'] === 'true';
	}

	// Group-level defaults (CT_DataLabels): position and number format apply
	// to every point unless a cx:dataLabel override below carries its own.
	const options: PptxChartDataLabelOptions = {};
	const groupPos = cxPosition(dlNode['@_pos']);
	if (groupPos) {
		options.position = groupPos;
	}
	const groupNumberFormat = cxNumberFormat(dlNode, xmlLookup);
	if (groupNumberFormat) {
		options.numberFormat = groupNumberFormat;
	}
	if (colorParser) {
		const groupTxPr = parseDefRPrTextStyle(
			resolveTxPrDefRPr(xmlLookup.getChildByLocalName(dlNode, 'txPr'), xmlLookup),
			xmlLookup,
			colorParser,
			resolveTypeface,
		);
		if (groupTxPr) {
			options.txPr = groupTxPr;
		}
	}

	// Parse individual data label overrides (cx:dataLabel)
	const labels: PptxChartDataLabel[] = [];
	const dlItems = xmlLookup.getChildrenArrayByLocalName(dlNode, 'dataLabel');
	for (const dlItem of dlItems) {
		const idx = Number.parseInt(String(dlItem['@_idx'] || '0'), 10);
		const label: PptxChartDataLabel = {
			idx,
			showVal: visibility.showVal,
			showCatName: visibility.showCatName,
			showSerName: visibility.showSerName,
		};
		const itemPos = cxPosition(dlItem['@_pos']);
		if (itemPos) {
			label.position = itemPos;
		}
		const itemNumberFormat = cxNumberFormat(dlItem, xmlLookup);
		if (itemNumberFormat) {
			label.numberFormat = itemNumberFormat;
		}
		if (colorParser) {
			const itemTxPr = parseDefRPrTextStyle(
				resolveTxPrDefRPr(xmlLookup.getChildByLocalName(dlItem, 'txPr'), xmlLookup),
				xmlLookup,
				colorParser,
				resolveTypeface,
			);
			if (itemTxPr) {
				label.txPr = itemTxPr;
			}
		}
		labels.push(label);
	}

	return {
		visibility,
		labels,
		...(Object.keys(options).length > 0 ? { options } : {}),
	};
}
