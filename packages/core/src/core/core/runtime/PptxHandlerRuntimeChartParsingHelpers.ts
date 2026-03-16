/**
 * @fileoverview Chart parsing helper methods for extracting simple chart
 * metadata properties from OOXML chart XML.
 *
 * This mixin adds `parsePlotVisOnly` and `parsePivotSource` to the runtime.
 * These are small, self-contained parsing helpers that extract boolean flags
 * and pivot-table metadata from the `c:chartSpace` / `c:chart` elements.
 *
 * Mixin chain position:
 *   `PptxHandlerRuntimeChartDetection` → **this** → `PptxHandlerRuntimeChartExternalData`
 */

import { XmlObject } from '../../types';
import type { PptxChartData } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeChartDetection';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse `c:plotVisOnly` from the chart root element.
	 *
	 * The `c:plotVisOnly` element controls whether hidden cells are plotted.
	 * - `val="1"` or `val="true"` or absent → only visible data is plotted (returns `true`)
	 * - `val="0"` or `val="false"` → hidden data IS plotted (returns `false`)
	 *
	 * Returns `undefined` when the element is absent (caller defaults to `true`).
	 */
	protected parsePlotVisOnly(chartRoot: XmlObject | undefined): boolean | undefined {
		if (!chartRoot) {
			return undefined;
		}

		const plotVisOnlyNode = this.xmlLookupService.getChildByLocalName(chartRoot, 'plotVisOnly');
		if (!plotVisOnlyNode) {
			return undefined;
		}

		const val = plotVisOnlyNode['@_val'];
		if (val === '0' || val === 'false' || val === false) {
			return false;
		}
		return true;
	}

	/**
	 * Parse `c:pivotSource` from the chart's `c:chartSpace`.
	 *
	 * The `c:pivotSource` element indicates the chart data originates from
	 * a PivotTable. It contains:
	 * - `c:name` — the pivot table reference (e.g. "[workbook.xlsx]Sheet1!PivotTable1")
	 * - `c:fmtId/@val` — an optional format identifier
	 *
	 * The chart still renders using its cached series data; the pivot source
	 * is metadata preserved for round-trip fidelity.
	 */
	protected parsePivotSource(chartSpace: XmlObject | undefined): PptxChartData['pivotSource'] {
		if (!chartSpace) {
			return undefined;
		}

		const pivotSourceNode = this.xmlLookupService.getChildByLocalName(chartSpace, 'pivotSource');
		if (!pivotSourceNode) {
			return undefined;
		}

		// Extract pivot table name from c:name text content
		const nameNode = this.xmlLookupService.getChildByLocalName(pivotSourceNode, 'name');
		const name =
			nameNode !== null
				? String(
						typeof nameNode === 'object' && nameNode !== null
							? (nameNode['#text'] ?? nameNode['_'] ?? nameNode['@_val'] ?? '')
							: nameNode,
					).trim()
				: '';
		if (name.length === 0) {
			return undefined;
		}

		// Extract format ID from c:fmtId/@val
		const fmtIdNode = this.xmlLookupService.getChildByLocalName(pivotSourceNode, 'fmtId');
		const fmtIdVal = fmtIdNode?.['@_val'];
		const formatId =
			fmtIdVal !== undefined && fmtIdVal !== null ? parseInt(String(fmtIdVal), 10) : undefined;

		return {
			name,
			...(formatId !== undefined && Number.isFinite(formatId) ? { formatId } : {}),
		};
	}
}
