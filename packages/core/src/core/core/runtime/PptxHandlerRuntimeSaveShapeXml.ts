import { XmlObject } from '../../types';
import type { InkPptxElement, GroupPptxElement, TablePptxElement } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveElements';

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
			const tokens = svgPath.match(/[ML]\s*[\d.eE+-]+\s+[\d.eE+-]+/g);
			if (tokens) {
				for (const token of tokens) {
					const parts = token.trim().split(/\s+/);
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

		const grpXml: XmlObject = {
			'p:nvGrpSpPr': {
				'p:cNvPr': { '@_id': '0', '@_name': group.id },
				'p:cNvGrpSpPr': {},
				'p:nvPr': {},
			},
			'p:grpSpPr': {
				'a:xfrm': {
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
			const childXfrm = (xml['p:spPr']?.['a:xfrm'] || xml['p:xfrm']) as XmlObject | undefined;
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
