import { XmlObject } from '../../types';
import type {
	ChartPptxElement,
	InkPptxElement,
	GroupPptxElement,
	OlePptxElement,
	TablePptxElement,
} from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveElements';

/** Relationship type for chart parts. */
export const CHART_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';

/** URI for charts in `<a:graphicData>`. */
const CHART_GRAPHIC_DATA_URI = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const CHART_EX_GRAPHIC_DATA_URI = 'http://schemas.microsoft.com/office/drawing/2014/chartex';

/** Content type for a chart part in `[Content_Types].xml`. */
export const CHART_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

const CHART_NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const CHART_NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Relationship type for embedded / linked OLE binary parts.
 * (`http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject`).
 */
const OLE_OBJECT_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject';

/**
 * Relationship type for image parts (used for OLE preview blip).
 */
const IMAGE_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

/**
 * URI for OLE objects in `<a:graphicData>`.
 */
const OLE_GRAPHIC_DATA_URI = 'http://schemas.openxmlformats.org/presentationml/2006/ole';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
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
	protected createTableGraphicFrameXml(el: TablePptxElement): XmlObject {
		const EMU = PptxHandlerRuntime.EMU_PER_PX;
		const offX = String(Math.round(el.x * EMU));
		const offY = String(Math.round(el.y * EMU));
		const extCx = String(Math.round(Math.max(el.width, 1) * EMU));
		const extCy = String(Math.round(Math.max(el.height, 1) * EMU));

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
	protected createChartGraphicFrameXml(
		el: ChartPptxElement,
		relId: string,
		extended = false,
	): XmlObject {
		const EMU = PptxHandlerRuntime.EMU_PER_PX;
		const offX = String(Math.round(el.x * EMU));
		const offY = String(Math.round(el.y * EMU));
		const extCx = String(Math.round(Math.max(el.width, 1) * EMU));
		const extCy = String(Math.round(Math.max(el.height, 1) * EMU));

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
				'a:graphicData': {
					'@_uri': extended ? CHART_EX_GRAPHIC_DATA_URI : CHART_GRAPHIC_DATA_URI,
					'c:chart': {
						'@_xmlns:c': CHART_NS_C,
						'@_xmlns:r': CHART_NS_R,
						'@_r:id': relId,
					},
				},
			},
		};
	}

	/**
	 * Build a `p:graphicFrame` XML skeleton for an OLE object element.
	 *
	 * Used both for SDK-created OLE elements (no `rawXml`) and to refresh
	 * a few key attributes on a loaded element when the typed fields have
	 * been mutated. The output is the canonical
	 * `p:graphicFrame > a:graphic > a:graphicData uri="…/ole" > p:oleObj`
	 * shape per ECMA-376 §19.3.1.34 / §13.3.4.
	 *
	 * The caller (`processSlideElement`) is responsible for ensuring the
	 * embed / preview-image relationships referenced from `r:id` / `r:embed`
	 * exist in the slide's rels file. This method does not register them
	 * itself because the typed model does not currently carry the binary
	 * payload — the binary part must already be in the package (loaded from
	 * the original file). A fully-fabricated SDK OLE element therefore
	 * still requires the consumer to attach the binary out-of-band; this
	 * method simply emits a schema-valid envelope referencing the
	 * specified relationship ID.
	 */
	protected createOleGraphicFrameXml(el: OlePptxElement, embedRelationshipId: string): XmlObject {
		const EMU = PptxHandlerRuntime.EMU_PER_PX;
		const offX = String(Math.round(el.x * EMU));
		const offY = String(Math.round(el.y * EMU));
		const extCx = String(Math.round(Math.max(el.width, 1) * EMU));
		const extCy = String(Math.round(Math.max(el.height, 1) * EMU));

		const oleObj: XmlObject = {
			'@_showAsIcon': el.oleShowAsIcon ? '1' : '0',
			'@_imgW': el.oleImgW !== undefined ? String(el.oleImgW) : extCx,
			'@_imgH': el.oleImgH !== undefined ? String(el.oleImgH) : extCy,
		};
		if (el.oleProgId) {
			oleObj['@_progId'] = el.oleProgId;
		}
		if (el.oleName) {
			oleObj['@_name'] = el.oleName;
		}
		if (el.oleClsId) {
			oleObj['@_classid'] = el.oleClsId;
		}
		if (embedRelationshipId) {
			oleObj['@_r:id'] = embedRelationshipId;
		}
		// Choose embed vs link form per CT_OleObject (ECMA-376 §13.3.4).
		// `<p:embed>` and `<p:link>` are a child-element choice — exactly one
		// must be present.
		if (el.isLinked) {
			oleObj['p:link'] = {
				'@_r:id': embedRelationshipId,
				'@_updateAutomatic': '1',
			};
		} else {
			oleObj['p:embed'] = {};
		}

		// Picture preview is required by PowerPoint; if no preview blip exists we
		// emit an empty `p:pic` which PowerPoint accepts and replaces with a
		// placeholder icon at first render.
		oleObj['p:pic'] = {
			'p:nvPicPr': {
				'p:cNvPr': { '@_id': '0', '@_name': el.oleName || 'OleObject' },
				'p:cNvPicPr': {},
				'p:nvPr': {},
			},
			'p:blipFill': {
				'a:blip': {},
				'a:stretch': { 'a:fillRect': {} },
			},
			'p:spPr': {
				'a:xfrm': {
					'a:off': { '@_x': offX, '@_y': offY },
					'a:ext': { '@_cx': extCx, '@_cy': extCy },
				},
				'a:prstGeom': { '@_prst': 'rect', 'a:avLst': {} },
			},
		};

		return {
			'p:nvGraphicFramePr': {
				'p:cNvPr': { '@_id': '0', '@_name': el.oleName || el.fileName || 'OleObject' },
				'p:cNvGraphicFramePr': {
					'a:graphicFrameLocks': { '@_noChangeAspect': '1' },
				},
				'p:nvPr': {},
			},
			'p:xfrm': {
				'a:off': { '@_x': offX, '@_y': offY },
				'a:ext': { '@_cx': extCx, '@_cy': extCy },
			},
			'a:graphic': {
				'a:graphicData': {
					'@_uri': OLE_GRAPHIC_DATA_URI,
					'p:oleObj': oleObj,
				},
			},
		};
	}

	/**
	 * Refresh editable typed-field attributes on a loaded OLE graphicFrame's
	 * raw XML. Only attributes that round-trip through the typed model
	 * (`progId`, `name`, `classid`) are touched so unknown extension data
	 * passes through verbatim.
	 */
	protected applyOleTypedFieldUpdates(shape: XmlObject, el: OlePptxElement): void {
		const oleObj = (
			(shape['a:graphic'] as XmlObject | undefined)?.['a:graphicData'] as XmlObject | undefined
		)?.['p:oleObj'] as XmlObject | undefined;
		if (!oleObj) {
			return;
		}
		if (el.oleProgId) {
			oleObj['@_progId'] = el.oleProgId;
		}
		if (el.oleName !== undefined) {
			if (el.oleName.length > 0) {
				oleObj['@_name'] = el.oleName;
			} else {
				delete oleObj['@_name'];
			}
		}
		if (el.oleClsId) {
			oleObj['@_classid'] = el.oleClsId;
		}
		if (el.oleShowAsIcon !== undefined) {
			oleObj['@_showAsIcon'] = el.oleShowAsIcon ? '1' : '0';
		}
		if (el.oleImgW !== undefined) {
			oleObj['@_imgW'] = String(el.oleImgW);
		}
		if (el.oleImgH !== undefined) {
			oleObj['@_imgH'] = String(el.oleImgH);
		}
		// Reconcile the embed/link child choice with the typed `isLinked`
		// flag. CT_OleObject is a strict choice — keep exactly one of the
		// two child elements.
		if (el.isLinked === true) {
			if (!oleObj['p:link']) {
				const existingRid = String(
					(oleObj['p:embed'] as XmlObject | undefined)?.['@_r:id'] || oleObj['@_r:id'] || '',
				).trim();
				oleObj['p:link'] = existingRid
					? { '@_r:id': existingRid, '@_updateAutomatic': '1' }
					: { '@_updateAutomatic': '1' };
			}
			delete oleObj['p:embed'];
		} else if (el.isLinked === false) {
			if (!oleObj['p:embed']) {
				oleObj['p:embed'] = {};
			}
			delete oleObj['p:link'];
		}
	}

	/** Look up the existing OLE binary relationship ID for this slide, if any. */
	protected resolveOleEmbedRelationshipId(
		slideRelationships: XmlObject[],
		oleTarget: string | undefined,
	): string | undefined {
		if (!oleTarget) {
			return undefined;
		}
		const normalisedTarget = oleTarget.replace(/^ppt\//u, '../').replace(/^\/+/u, '');
		const lowerTarget = normalisedTarget.toLowerCase();
		for (const rel of slideRelationships) {
			const relType = String(rel?.['@_Type'] || '');
			if (relType !== OLE_OBJECT_RELATIONSHIP_TYPE) {
				continue;
			}
			const target = String(rel?.['@_Target'] || '')
				.toLowerCase()
				.trim();
			if (target === lowerTarget || target.endsWith(lowerTarget) || lowerTarget.endsWith(target)) {
				const relId = String(rel?.['@_Id'] || '').trim();
				if (relId.length > 0) {
					return relId;
				}
			}
		}
		// Fallback: first OLE relationship on the slide.
		const fallback = slideRelationships.find(
			(rel) => String(rel?.['@_Type'] || '') === OLE_OBJECT_RELATIONSHIP_TYPE,
		);
		const fallbackId = String(fallback?.['@_Id'] || '').trim();
		return fallbackId.length > 0 ? fallbackId : undefined;
	}

	/** Constants are exposed so the element-writer mixin can reuse them. */
	protected static readonly OLE_OBJECT_RELATIONSHIP_TYPE = OLE_OBJECT_RELATIONSHIP_TYPE;

	protected static readonly OLE_IMAGE_RELATIONSHIP_TYPE = IMAGE_RELATIONSHIP_TYPE;

	/**
	 * Build a p:sp XML object for an ink annotation element.
	 * Each ink path becomes a separate a:path within a:pathLst,
	 * serialized as a freeform (a:custGeom) shape with moveTo/lnTo.
	 */
	protected createInkShapeXml(el: InkPptxElement): XmlObject {
		const EMU = PptxHandlerRuntime.EMU_PER_PX;
		const offX = String(Math.round(el.x * EMU));
		const offY = String(Math.round(el.y * EMU));
		const extCx = String(Math.round(Math.max(el.width, 1) * EMU));
		const extCy = String(Math.round(Math.max(el.height, 1) * EMU));

		// Build one a:path per ink stroke
		const xmlPaths: XmlObject[] = el.inkPaths.map((svgPath) => {
			const moveToList: XmlObject[] = [];
			const lnToList: XmlObject[] = [];
			const tokens = svgPath.match(/[ML]\s*[\d.eE+-]+\s+[\d.eE+-]+/gu);
			if (tokens) {
				for (const token of tokens) {
					const parts = token.trim().split(/\s+/u);
					const cmd = parts[0];
					const x = parseFloat(parts[1]);
					const y = parseFloat(parts[2]);
					const pt = {
						'@_x': String(Math.round(x * EMU)),
						'@_y': String(Math.round(y * EMU)),
					};
					if (cmd === 'M') {
						moveToList.push({ 'a:pt': pt });
					} else if (cmd === 'L') {
						lnToList.push({ 'a:pt': pt });
					}
				}
			}

			const pathXml: XmlObject = {
				'@_w': extCx,
				'@_h': extCy,
				'@_stroke': '1',
				'@_fill': 'none',
			};
			if (moveToList.length > 0) {
				pathXml['a:moveTo'] = moveToList.length === 1 ? moveToList[0] : moveToList;
			}
			if (lnToList.length > 0) {
				pathXml['a:lnTo'] = lnToList.length === 1 ? lnToList[0] : lnToList;
			}
			return pathXml;
		});

		const strokeColor = el.inkColors?.[0] ?? '#000000';
		const strokeWidth = el.inkWidths?.[0] ?? 2;
		const strokeOpacity = el.inkOpacities?.[0] ?? 1;
		const cleanColor = strokeColor.replace('#', '');

		const shape: XmlObject = {
			'p:nvSpPr': {
				'p:cNvPr': {
					'@_id': '0',
					'@_name': el.id,
				},
				'p:cNvSpPr': {},
				'p:nvPr': {},
			},
			'p:spPr': {
				'a:xfrm': {
					'a:off': { '@_x': offX, '@_y': offY },
					'a:ext': { '@_cx': extCx, '@_cy': extCy },
				},
				'a:custGeom': {
					'a:avLst': {},
					'a:gdLst': {},
					'a:ahLst': {},
					'a:cxnLst': {},
					'a:rect': {
						'@_l': '0',
						'@_t': '0',
						'@_r': extCx,
						'@_b': extCy,
					},
					'a:pathLst': {
						'a:path': xmlPaths.length === 1 ? xmlPaths[0] : xmlPaths,
					},
				},
				'a:noFill': {},
				'a:ln': {
					'@_w': String(Math.round(strokeWidth * EMU)),
					'@_cap': 'rnd',
					'a:solidFill': {
						'a:srgbClr': {
							'@_val': cleanColor,
							...(strokeOpacity < 1
								? {
										'a:alpha': {
											'@_val': String(Math.round(strokeOpacity * 100000)),
										},
									}
								: {}),
						},
					},
					'a:round': {},
				},
			},
		};

		return shape;
	}

	/**
	 * Build a p:grpSp XML object from a GroupPptxElement.
	 * Children are stored with coordinates relative to the group origin.
	 */
	protected buildGroupShapeXml(group: GroupPptxElement): XmlObject | null {
		// If the group still has rawXml and children haven't changed, reuse it
		if (group.rawXml && group.children.length === 0) {
			return group.rawXml;
		}

		const EMU = PptxHandlerRuntime.EMU_PER_PX;
		const offX = Math.round(group.x * EMU);
		const offY = Math.round(group.y * EMU);
		const extCx = Math.round(group.width * EMU);
		const extCy = Math.round(group.height * EMU);

		// Group child coordinate space — same as group extent for user-created groups
		const chOffX = 0;
		const chOffY = 0;
		const chExtCx = extCx;
		const chExtCy = extCy;

		// Preserve group-level rotation/flip (issue #70). `@_rot` is stored in
		// 60000ths of a degree (ECMA-376 ST_Angle); flips are boolean "1" flags.
		const xfrmAttrs: XmlObject = {};
		if (typeof group.rotation === 'number' && group.rotation !== 0) {
			xfrmAttrs['@_rot'] = String(Math.round(group.rotation * 60000));
		}
		if (group.flipHorizontal) {
			xfrmAttrs['@_flipH'] = '1';
		}
		if (group.flipVertical) {
			xfrmAttrs['@_flipV'] = '1';
		}

		const grpXml: XmlObject = {
			'p:nvGrpSpPr': {
				'p:cNvPr': { '@_id': '0', '@_name': group.id },
				'p:cNvGrpSpPr': {},
				'p:nvPr': {},
			},
			'p:grpSpPr': {
				'a:xfrm': {
					...xfrmAttrs,
					'a:off': {
						'@_x': String(offX),
						'@_y': String(offY),
					},
					'a:ext': {
						'@_cx': String(extCx),
						'@_cy': String(extCy),
					},
					'a:chOff': {
						'@_x': String(chOffX),
						'@_y': String(chOffY),
					},
					'a:chExt': {
						'@_cx': String(chExtCx),
						'@_cy': String(chExtCy),
					},
				},
			},
		};

		// Categorise children into XML lists
		const childShapes: XmlObject[] = [];
		const childPics: XmlObject[] = [];
		const childConnectors: XmlObject[] = [];

		for (const child of group.children) {
			let xml = child.rawXml as XmlObject | undefined;

			// Create XML for elements that don't have rawXml
			if (!xml && (child.type === 'text' || child.type === 'shape')) {
				xml = this.createElementXml(child);
			}
			if (!xml && child.type === 'connector') {
				xml = this.createConnectorXml(child);
			}
			if (!xml) {
				continue;
			}

			// Update child transform — coordinates are relative to group
			const childXfrm = ((xml['p:spPr'] as XmlObject | undefined)?.['a:xfrm'] || xml['p:xfrm']) as
				| XmlObject
				| undefined;
			if (childXfrm) {
				if (!childXfrm['a:off']) {
					childXfrm['a:off'] = {};
				}
				if (!childXfrm['a:ext']) {
					childXfrm['a:ext'] = {};
				}
				(childXfrm['a:off'] as XmlObject)['@_x'] = String(Math.round(child.x * EMU));
				(childXfrm['a:off'] as XmlObject)['@_y'] = String(Math.round(child.y * EMU));
				(childXfrm['a:ext'] as XmlObject)['@_cx'] = String(Math.round(child.width * EMU));
				(childXfrm['a:ext'] as XmlObject)['@_cy'] = String(Math.round(child.height * EMU));
			}

			if (child.type === 'picture' || child.type === 'image') {
				childPics.push(xml);
			} else if (child.type === 'connector') {
				childConnectors.push(xml);
			} else {
				childShapes.push(xml);
			}
		}

		if (childShapes.length > 0) {
			grpXml['p:sp'] = childShapes;
		}
		if (childPics.length > 0) {
			grpXml['p:pic'] = childPics;
		}
		if (childConnectors.length > 0) {
			grpXml['p:cxnSp'] = childConnectors;
		}

		return grpXml;
	}
}
