import { XmlObject } from '../../types';
import type {
	ChartPptxElement,
	InkPptxElement,
	GroupPptxElement,
	OlePptxElement,
	PptxElement,
	TablePptxElement,
} from '../../types';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveElements';
import type { SlideShapeCollectors } from './PptxHandlerRuntimeSaveElementWriter';
import {
	createGroupChildCollectors,
	pickGroupChildFromCollectors,
} from './save-group-child-collectors';
import { groupChildInheritedFill } from './save-group-fill';
import type { GroupChildEntry } from './save-group-shape-xml';
import {
	appendGroupChildren,
	applyGroupChildTransform,
	buildGroupNonVisualXml,
	buildGroupPropertiesXml,
	buildGroupTransformXml,
	classifyGroupChildTag,
} from './save-group-shape-xml';

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

/** The save context a group child needs to serialise like a top-level shape. */
export type GroupChildSaveContext = SaveSlideContext;

/**
 * Structural view of the element writer that lives further down the mixin
 * chain. `buildGroupShapeXml` is defined in an ancestor mixin, so
 * `processSlideElement` is present at runtime but not in this class's static
 * type; this interface names the one method needed without widening to `any`.
 */
interface GroupChildElementWriter {
	processSlideElement(
		el: PptxElement,
		collectors: SlideShapeCollectors,
		ctx: GroupChildSaveContext,
	): void;
}

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
		// PowerPoint writes `noGrp` on every table frame it creates. Seed it onto
		// the MODEL, not just into the markup below: `serializeShapeLocks` runs
		// immediately after this factory and rebuilds `a:graphicFrameLocks` from
		// `el.locks`, treating an absent bag as "the user cleared the locks". A
		// default that existed only in the fabricated XML would be stripped back
		// off before the file was written.
		el.locks = { noGrouping: true, ...el.locks };
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
		// See `createTableGraphicFrameXml`: the family default has to reach the
		// model or the lock writer removes it again a few lines later.
		el.locks = { noChangeAspect: true, ...el.locks };
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
				...(el.oleFollowColorScheme !== undefined
					? { '@_followColorScheme': el.oleFollowColorScheme }
					: {}),
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
		// `p:link/@followColorScheme` only applies to the linked form; keep it
		// in sync with the typed field whenever a `p:link` node exists.
		const linkNode = oleObj['p:link'] as XmlObject | undefined;
		if (linkNode) {
			if (el.oleFollowColorScheme !== undefined) {
				linkNode['@_followColorScheme'] = el.oleFollowColorScheme;
			} else {
				delete linkNode['@_followColorScheme'];
			}
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
			// SVG separates a coordinate pair with whitespace OR a comma, and both
			// forms reach here: the Draw tool writes `M x y`, while an SDK caller
			// (and `pathToTrace` in the ink writer, which always accepted both)
			// writes `M0,0 L50,25`. Requiring whitespace silently matched nothing
			// on the comma form, so the stroke was emitted as an EMPTY `a:path`
			// and the ink vanished from the saved shape.
			const tokens = svgPath.matchAll(/(?<cmd>[ML])\s*(?<x>[\d.eE+-]+)[,\s]+(?<y>[\d.eE+-]+)/giu);
			for (const token of tokens) {
				const x = parseFloat(String(token.groups?.x));
				const y = parseFloat(String(token.groups?.y));
				if (!Number.isFinite(x) || !Number.isFinite(y)) {
					continue;
				}
				const pt = {
					'@_x': String(Math.round(x * EMU)),
					'@_y': String(Math.round(y * EMU)),
				};
				if (token.groups?.cmd?.toUpperCase() === 'M') {
					moveToList.push({ 'a:pt': pt });
				} else {
					lnToList.push({ 'a:pt': pt });
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
	 * Build a `p:grpSp` XML object from a {@link GroupPptxElement}.
	 *
	 * Children are stored with coordinates relative to the group origin and
	 * are routed to the `CT_GroupShape` child tag their markup actually
	 * requires (see {@link classifyGroupChildTag}). A group loaded from a
	 * file keeps its original `p:nvGrpSpPr` (so `p:timing`'s `p:spTgt/@spid`
	 * still resolves) and its original `p:grpSpPr` fill / effects / locks.
	 */
	protected buildGroupShapeXml(
		group: GroupPptxElement,
		ctx?: GroupChildSaveContext,
	): XmlObject | null {
		// If the group still has rawXml and children haven't changed, reuse it
		if (group.rawXml && group.children.length === 0) {
			return group.rawXml;
		}

		const EMU = PptxHandlerRuntime.EMU_PER_PX;
		const rawGroupXml = group.rawXml as XmlObject | undefined;
		const xfrm = buildGroupTransformXml(group, EMU);

		const grpXml: XmlObject = {
			'p:nvGrpSpPr': buildGroupNonVisualXml(rawGroupXml, group.name, group.id),
			'p:grpSpPr': buildGroupPropertiesXml(rawGroupXml, xfrm),
		};
		const rawExtLst = rawGroupXml?.['p:extLst'];
		if (rawExtLst !== undefined) {
			grpXml['p:extLst'] = rawExtLst;
		}

		// What an `<a:grpFill/>` child of THIS group inherits: the group's own
		// fill when it has one, otherwise whatever the group itself inherited.
		// Chaining here is what lets the fill writer tell "still following the
		// group" from "recoloured by the user" at any nesting depth.
		const childCtx: GroupChildSaveContext | undefined = ctx
			? { ...ctx, inheritedGroupFill: groupChildInheritedFill(group, ctx.inheritedGroupFill) }
			: undefined;

		const entries: GroupChildEntry[] = [];
		for (const child of group.children) {
			const entry = childCtx
				? this.serializeGroupChildViaElementWriter(child, childCtx)
				: this.serializeGroupChildFromRawXml(child);
			if (entry) {
				entries.push(entry);
			}
		}

		appendGroupChildren(grpXml, entries);
		return grpXml;
	}

	/**
	 * Serialise one group child through the ordinary element writer, so a
	 * model-level edit to a shape inside a group (text, fill, stroke, geometry,
	 * effects, locks, alt text, image crop, re-embedded media) reaches the file
	 * exactly as it does for a top-level shape.
	 *
	 * Nested groups are recursed here rather than handed to the element writer,
	 * so the save context survives to every nesting depth.
	 */
	private serializeGroupChildViaElementWriter(
		child: GroupPptxElement['children'][number],
		ctx: GroupChildSaveContext,
	): GroupChildEntry | null {
		if (child.type === 'group') {
			const xml = this.buildGroupShapeXml(child, ctx);
			if (!xml) {
				return null;
			}
			// A nested group never reaches `processSlideElement` (this branch
			// recurses instead, so the save context survives), so it never got the
			// lock pass a top-level group gets there. `buildGroupNonVisualXml`
			// carries the ORIGINAL `a:grpSpLocks` over verbatim, which looks
			// correct until the model is edited: locking a group inside a group
			// was silently dropped on save.
			this.serializeShapeLocks(xml, child);
			applyGroupChildTransform(xml, child, PptxHandlerRuntime.EMU_PER_PX);
			return { tag: 'p:grpSp', xml };
		}
		const collectors: SlideShapeCollectors = createGroupChildCollectors();
		// `processSlideElement` is implemented further down the mixin chain
		// (`PptxHandlerRuntimeSaveElementWriter`), which is why it is reached
		// through a structural view rather than `this` directly.
		(this as unknown as GroupChildElementWriter).processSlideElement(child, collectors, ctx);
		return pickGroupChildFromCollectors(collectors);
	}

	/**
	 * Fallback used when no save context is available: pass the child's own
	 * markup through and patch only its transform. Preserves everything, but
	 * cannot pick up model-level edits.
	 */
	private serializeGroupChildFromRawXml(
		child: GroupPptxElement['children'][number],
	): GroupChildEntry | null {
		const xml = this.buildGroupChildXml(child);
		if (!xml) {
			return null;
		}
		applyGroupChildTransform(xml, child, PptxHandlerRuntime.EMU_PER_PX);

		const tag = classifyGroupChildTag(child.type, xml);
		if (!tag) {
			// Emitting an unplaceable node under `p:sp` is what produced
			// schema-invalid packages; skipping one child is recoverable,
			// a repair prompt on the whole deck is not.
			this.compatibilityService.reportWarning({
				code: 'SAVE_GROUP_CHILD_SKIPPED',
				message: `Group child '${child.id}' (${child.type}) has no valid CT_GroupShape slot and was skipped during save.`,
				scope: 'save',
				elementId: child.id,
			});
			return null;
		}
		return { tag, xml };
	}

	/** Resolve (or fabricate) the XML node for a single group child. */
	private buildGroupChildXml(child: GroupPptxElement['children'][number]): XmlObject | undefined {
		if (child.type === 'group') {
			return this.buildGroupShapeXml(child) ?? undefined;
		}
		const xml = child.rawXml as XmlObject | undefined;
		if (xml) {
			return xml;
		}
		if (child.type === 'text' || child.type === 'shape') {
			return this.createElementXml(child);
		}
		if (child.type === 'connector') {
			return this.createConnectorXml(child);
		}
		if (child.type === 'ink') {
			return this.createInkShapeXml(child);
		}
		if (child.type === 'table') {
			return this.createTableGraphicFrameXml(child);
		}
		return undefined;
	}
}
