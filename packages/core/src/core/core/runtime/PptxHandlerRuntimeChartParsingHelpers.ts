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
import type {
	PptxChartChrome,
	PptxChartData,
	PptxChartOfPieOptions,
	PptxChartView3D,
} from '../../types';
import { parseChartPivotSource } from '../../utils/chart-pivot-source';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeChartDetection';

/**
 * Parse a boolean from a `c:*Boolean/@val` style OOXML attribute.
 * The OOXML default for an absent `@val` on a `CT_Boolean` element is `true`.
 */
function parseBoolVal(node: XmlObject | undefined): boolean | undefined {
	if (!node) {
		return undefined;
	}
	const val = node['@_val'];
	if (val === undefined || val === null || val === '') {
		// Element present without @val => spec default is true.
		return true;
	}
	if (val === '0' || val === 'false') {
		return false;
	}
	return true;
}

/** Parse a numeric `@val` attribute. */
function parseNumberVal(node: XmlObject | undefined): number | undefined {
	if (!node) {
		return undefined;
	}
	const raw = node['@_val'];
	if (raw === undefined || raw === null || raw === '') {
		return undefined;
	}
	const num = Number.parseFloat(String(raw));
	return Number.isFinite(num) ? num : undefined;
}

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
		if (val === '0' || val === 'false') {
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
		return parseChartPivotSource(chartSpace, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
	}

	/**
	 * Parse `c:ofPieChart` options from the chart-type container.
	 *
	 * The `ofPieType` element is required by the schema; its `@val`
	 * defaults to `"pie"` when absent. Other fields (`splitType`,
	 * `splitPos`, `secondPieSize`, `serLines`, `gapWidth`, `custSplit`)
	 * are optional and only included when present in the XML.
	 */
	protected parseOfPieOptions(
		ofPieContainer: XmlObject | undefined,
	): PptxChartOfPieOptions | undefined {
		if (!ofPieContainer) {
			return undefined;
		}

		const ofPieTypeNode = this.xmlLookupService.getChildByLocalName(ofPieContainer, 'ofPieType');
		const ofPieTypeRaw = ofPieTypeNode?.['@_val'];
		const ofPieType: PptxChartOfPieOptions['ofPieType'] =
			String(ofPieTypeRaw ?? 'pie').toLowerCase() === 'bar' ? 'bar' : 'pie';

		const result: PptxChartOfPieOptions = { ofPieType };

		const splitTypeNode = this.xmlLookupService.getChildByLocalName(ofPieContainer, 'splitType');
		const splitTypeRaw = splitTypeNode?.['@_val'];
		if (splitTypeRaw !== undefined && splitTypeRaw !== null) {
			const v = String(splitTypeRaw);
			if (v === 'auto' || v === 'cust' || v === 'percent' || v === 'pos' || v === 'val') {
				result.splitType = v;
			}
		}

		const splitPos = parseNumberVal(
			this.xmlLookupService.getChildByLocalName(ofPieContainer, 'splitPos'),
		);
		if (splitPos !== undefined) {
			result.splitPos = splitPos;
		}

		const secondPieSize = parseNumberVal(
			this.xmlLookupService.getChildByLocalName(ofPieContainer, 'secondPieSize'),
		);
		if (secondPieSize !== undefined) {
			result.secondPieSize = secondPieSize;
		}

		const gapWidth = parseNumberVal(
			this.xmlLookupService.getChildByLocalName(ofPieContainer, 'gapWidth'),
		);
		if (gapWidth !== undefined) {
			result.gapWidth = gapWidth;
		}

		// c:serLines may appear multiple times per spec; presence is what matters.
		const serLinesArr = this.xmlLookupService.getChildrenArrayByLocalName(
			ofPieContainer,
			'serLines',
		);
		if (serLinesArr.length > 0) {
			result.serLines = true;
		}

		// c:custSplit/c:secondPiePt list — preserve indices.
		const custSplitNode = this.xmlLookupService.getChildByLocalName(ofPieContainer, 'custSplit');
		if (custSplitNode) {
			const points = this.xmlLookupService.getChildrenArrayByLocalName(
				custSplitNode,
				'secondPiePt',
			);
			const indices = points
				.map((p) => parseNumberVal(p))
				.filter((n): n is number => n !== undefined && Number.isFinite(n));
			if (indices.length > 0) {
				result.custSplit = indices;
			}
		}

		return result;
	}

	/**
	 * Parse `c:view3D` (CT_View3D) from the chart root.
	 *
	 * Returns `undefined` when the element is absent so it does not
	 * round-trip as an empty `<c:view3D/>` placeholder.
	 */
	protected parseView3D(chartRoot: XmlObject | undefined): PptxChartView3D | undefined {
		if (!chartRoot) {
			return undefined;
		}
		const view3DNode = this.xmlLookupService.getChildByLocalName(chartRoot, 'view3D');
		if (!view3DNode) {
			return undefined;
		}

		const view3D: PptxChartView3D = {};
		const rotX = parseNumberVal(this.xmlLookupService.getChildByLocalName(view3DNode, 'rotX'));
		if (rotX !== undefined) {
			view3D.rotX = rotX;
		}
		const rotY = parseNumberVal(this.xmlLookupService.getChildByLocalName(view3DNode, 'rotY'));
		if (rotY !== undefined) {
			view3D.rotY = rotY;
		}
		const depthPercent = parseNumberVal(
			this.xmlLookupService.getChildByLocalName(view3DNode, 'depthPercent'),
		);
		if (depthPercent !== undefined) {
			view3D.depthPercent = depthPercent;
		}
		const perspective = parseNumberVal(
			this.xmlLookupService.getChildByLocalName(view3DNode, 'perspective'),
		);
		if (perspective !== undefined) {
			view3D.perspective = perspective;
		}
		const hPercent = parseNumberVal(
			this.xmlLookupService.getChildByLocalName(view3DNode, 'hPercent'),
		);
		if (hPercent !== undefined) {
			view3D.hPercent = hPercent;
		}
		const rAngAx = parseBoolVal(this.xmlLookupService.getChildByLocalName(view3DNode, 'rAngAx'));
		if (rAngAx !== undefined) {
			view3D.rAngAx = rAngAx;
		}

		// Return undefined when no fields populated to avoid round-tripping
		// an empty container.
		return Object.keys(view3D).length > 0 ? view3D : undefined;
	}

	/**
	 * Parse top-level chart chrome flags from `c:chart`:
	 * `c:autoTitleDeleted`, `c:dispBlanksAs`, `c:showDLblsOverMax`.
	 *
	 * Each flag is included in the result only when present on the
	 * source XML so that absence does not produce empty elements on
	 * save.
	 */
	protected parseChartChrome(chartRoot: XmlObject | undefined): PptxChartChrome | undefined {
		if (!chartRoot) {
			return undefined;
		}

		const chrome: PptxChartChrome = {};

		const autoTitleDeletedNode = this.xmlLookupService.getChildByLocalName(
			chartRoot,
			'autoTitleDeleted',
		);
		const autoTitleDeleted = parseBoolVal(autoTitleDeletedNode);
		if (autoTitleDeleted !== undefined) {
			chrome.autoTitleDeleted = autoTitleDeleted;
		}

		const dispBlanksAsNode = this.xmlLookupService.getChildByLocalName(chartRoot, 'dispBlanksAs');
		const dispBlanksAsRaw = dispBlanksAsNode?.['@_val'];
		if (dispBlanksAsRaw !== undefined && dispBlanksAsRaw !== null) {
			const v = String(dispBlanksAsRaw);
			if (v === 'gap' || v === 'zero' || v === 'span') {
				chrome.dispBlanksAs = v;
			}
		}

		const showDLblsOverMaxNode = this.xmlLookupService.getChildByLocalName(
			chartRoot,
			'showDLblsOverMax',
		);
		const showDLblsOverMax = parseBoolVal(showDLblsOverMaxNode);
		if (showDLblsOverMax !== undefined) {
			chrome.showDLblsOverMax = showDLblsOverMax;
		}

		return Object.keys(chrome).length > 0 ? chrome : undefined;
	}

	/**
	 * Capture the raw `c:userShapes` subtree for verbatim round-trip.
	 *
	 * The element references a separate drawing part; we never parse
	 * the nested drawing tree here. Returning the raw object means the
	 * save layer can re-emit it unchanged.
	 */
	protected parseUserShapesXml(chartSpace: XmlObject | undefined): unknown {
		if (!chartSpace) {
			return undefined;
		}
		const node = this.xmlLookupService.getChildByLocalName(chartSpace, 'userShapes');
		// We intentionally return the raw node (which may carry attributes
		// like @r:id) rather than copying — the save layer rewrites the
		// containing chart XML wholesale, so reference equality is fine.
		return node ?? undefined;
	}

	/** Capture the raw `c:pivotFmts` subtree for verbatim round-trip. */
	protected parsePivotFmtsXml(chartRoot: XmlObject | undefined): unknown {
		if (!chartRoot) {
			return undefined;
		}
		const node = this.xmlLookupService.getChildByLocalName(chartRoot, 'pivotFmts');
		return node ?? undefined;
	}

	/**
	 * Parse `c:clrMapOvr` into a flat attribute map.
	 *
	 * The element carries 12 `bg1/tx1/bg2/tx2/accent1…6/hlink/folHlink`
	 * attributes that remap theme colour roles for the chart only.
	 * Unknown attributes are preserved as-is so that future schema
	 * additions round-trip without code changes.
	 */
	protected parseClrMapOvr(chartSpace: XmlObject | undefined): Record<string, string> | undefined {
		if (!chartSpace) {
			return undefined;
		}
		const node = this.xmlLookupService.getChildByLocalName(chartSpace, 'clrMapOvr');
		if (!node) {
			return undefined;
		}
		const map: Record<string, string> = {};
		for (const [key, value] of Object.entries(node)) {
			if (!key.startsWith('@_')) {
				continue;
			}
			if (value === undefined || value === null) {
				continue;
			}
			map[key.slice(2)] = String(value);
		}
		return Object.keys(map).length > 0 ? map : undefined;
	}
}
