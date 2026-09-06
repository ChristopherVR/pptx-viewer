import { XmlObject } from '../../types';
import type { ChartPptxElement, TablePptxElement } from '../../types';

/** URI for charts in `<a:graphicData>`. */
const CHART_GRAPHIC_DATA_URI = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const CHART_EX_GRAPHIC_DATA_URI = 'http://schemas.microsoft.com/office/drawing/2014/chartex';

const CHART_NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const CHART_NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Build a `p:graphicFrame` XML skeleton for an SDK-created table.
 *
 * Tables round-trip as `<p:graphicFrame>/<a:graphic>/<a:graphicData
 * uri=".../drawingml/2006/table">/<a:tbl>` inside `p:spTree`. When the
 * element was loaded from an existing file, `el.rawXml` already contains
 * this envelope and the downstream `serializeTableDataToXml` path
 * populates cells in place. When the element was created via the SDK
 * (`SlideBuilder.addTable`), there is no `rawXml`, so this method
 * fabricates a minimal envelope with an empty `a:tbl`. The element
 * writer then calls `serializeTableDataToXml`, which triggers
 * `rebuildTableXmlFromData` and fills in `a:tblGrid` / `a:tr` children.
 */
export function buildTableGraphicFrameXml(el: TablePptxElement, emuPerPx: number): XmlObject {
	// PowerPoint writes `noGrp` on every table frame it creates. Seed it onto
	// the MODEL, not just into the markup below: `serializeShapeLocks` runs
	// immediately after this factory and rebuilds `a:graphicFrameLocks` from
	// `el.locks`, treating an absent bag as "the user cleared the locks". A
	// default that existed only in the fabricated XML would be stripped back
	// off before the file was written.
	el.locks = { noGrouping: true, ...el.locks };
	const offX = String(Math.round(el.x * emuPerPx));
	const offY = String(Math.round(el.y * emuPerPx));
	const extCx = String(Math.round(Math.max(el.width, 1) * emuPerPx));
	const extCy = String(Math.round(Math.max(el.height, 1) * emuPerPx));

	const tblPr: XmlObject = {
		'@_firstRow': el.tableData?.firstRowHeader ? '1' : '0',
		'@_bandRow': el.tableData?.bandedRows ? '1' : '0',
	};
	if (el.tableData?.tableStyleId) {
		tblPr['a:tableStyleId'] = el.tableData.tableStyleId;
	}

	return {
		'p:nvGraphicFramePr': {
			'p:cNvPr': { '@_id': '0', '@_name': el.name || 'Table' },
			'p:cNvGraphicFramePr': {
				'a:graphicFrameLocks': { '@_noGrp': '1' },
			},
			'p:nvPr': {},
		},
		'p:xfrm': {
			'a:off': { '@_x': offX, '@_y': offY },
			'a:ext': { '@_cx': extCx, '@_cy': extCy },
		},
		'a:graphic': {
			'a:graphicData': {
				'@_uri': 'http://schemas.openxmlformats.org/drawingml/2006/table',
				'a:tbl': {
					'a:tblPr': tblPr,
					'a:tblGrid': {},
				},
			},
		},
	};
}

/**
 * Build a `p:graphicFrame` envelope for a chart element, referencing the
 * chart part via `relId`. The chart part itself (`ppt/charts/chartN.xml`)
 * and the slide relationship are created by the caller.
 */
export function buildChartGraphicFrameXml(
	el: ChartPptxElement,
	emuPerPx: number,
	relId: string,
	extended = false,
): XmlObject {
	const offX = String(Math.round(el.x * emuPerPx));
	const offY = String(Math.round(el.y * emuPerPx));
	const extCx = String(Math.round(Math.max(el.width, 1) * emuPerPx));
	const extCy = String(Math.round(Math.max(el.height, 1) * emuPerPx));

	return {
		'p:nvGraphicFramePr': {
			'p:cNvPr': { '@_id': '0', '@_name': el.name || 'Chart' },
			'p:cNvGraphicFramePr': {},
			'p:nvPr': {},
		},
		'p:xfrm': {
			'a:off': { '@_x': offX, '@_y': offY },
			'a:ext': { '@_cx': extCx, '@_cy': extCy },
		},
		'a:graphic': {
			// A ChartEx (2014 chartex) frame's payload element is
			// `<cx:chart>` in the chartex namespace, NOT the 2006
			// DrawingML `<c:chart>`. Emitting `c:chart` under the chartex
			// URI produced a graphic frame PowerPoint cannot resolve; it
			// only round-tripped here because the load-side classifier
			// matched the raw `c:chart` key.
			'a:graphicData': extended
				? {
						'@_uri': CHART_EX_GRAPHIC_DATA_URI,
						'cx:chart': {
							'@_xmlns:cx': CHART_EX_GRAPHIC_DATA_URI,
							'@_xmlns:r': CHART_NS_R,
							'@_r:id': relId,
						},
					}
				: {
						'@_uri': CHART_GRAPHIC_DATA_URI,
						'c:chart': {
							'@_xmlns:c': CHART_NS_C,
							'@_xmlns:r': CHART_NS_R,
							'@_r:id': relId,
						},
					},
		},
	};
}
