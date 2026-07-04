import { XmlObject } from '../../types';
import type {
	PptxSmartArtData,
	PptxSmartArtConnection,
	PptxSmartArtDrawingShape,
} from '../../types';
import { MAX_SMARTART_NODES } from '../builders/smart-art-text-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSmartArtParsing';
import { resolveSmartArtLayoutCategory } from './smartart-layout-category';
import { isContentPoint } from './smartart-xml-builders';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	public async getSmartArtDataForGraphicFrame(
		slidePath: string,
		graphicFrame: XmlObject | undefined,
	): Promise<PptxSmartArtData | undefined> {
		const graphicData = this.xmlLookupService.getChildByLocalName(
			this.xmlLookupService.getChildByLocalName(graphicFrame, 'graphic'),
			'graphicData',
		);
		const relationshipIds = this.xmlLookupService.getChildByLocalName(graphicData, 'relIds');
		if (!relationshipIds) {
			return undefined;
		}

		const diagramDataRelationshipId = String(relationshipIds['@_r:dm'] || '').trim();
		if (diagramDataRelationshipId.length === 0) {
			return undefined;
		}

		const diagramDataPart = await this.readXmlPartByRelationshipId(
			slidePath,
			diagramDataRelationshipId,
		);
		if (!diagramDataPart) {
			return undefined;
		}

		const dataModel = this.xmlLookupService.getChildByLocalName(diagramDataPart.xml, 'dataModel');
		const pointList = this.xmlLookupService.getChildByLocalName(dataModel, 'ptLst');
		const points = this.xmlLookupService.getChildrenArrayByLocalName(pointList, 'pt');

		// ── Parse connections ────────────────────────────────────────────
		const { parsedConnections, parentByNodeId } = this.parseSmartArtConnections(dataModel);

		// ── Parse nodes ──────────────────────────────────────────────────
		// Every user-editable content point (`type="node"`/`"asst"`, or no
		// `@_type`) must survive into `nodes`, even ones the user never typed
		// into (empty `[Text]` placeholders). Dropping empty-text points here
		// desyncs them from `dgm:cxnLst`, which still references their ids on
		// save via `mergeSmartArtPointXml` -- producing a `dgm:ptLst` missing
		// points that `dgm:cxnLst` dangles a reference to, which PowerPoint
		// rejects as a corrupt file. Structural points (doc/pres/parTrans/
		// sibTrans) are excluded; those are preserved verbatim on save instead.
		const nodes = points
			.filter(isContentPoint)
			.map((point) => {
				const pointId = String(point?.['@_modelId'] || '').trim();
				if (pointId.length === 0) {
					return null;
				}

				const nodeType = String(point?.['@_type'] || '').trim() || undefined;
				const textValues: string[] = [];
				this.collectLocalTextValues(point, 't', textValues);
				const resolvedText = textValues.find((entry) => entry.trim().length > 0);

				// Capture per-run formatting so a load -> edit -> save round-trip
				// keeps a node's individual runs (bold / colour / size) instead of
				// flattening them to a single unstyled run on save.
				const runs = this.extractSmartArtNodeRuns(point);

				// Capture any per-node colour / emphasis override so the editing
				// UI can display current values and the save path round-trips it.
				const style = this.extractSmartArtNodeStyle(point);

				return {
					id: pointId,
					text: resolvedText ? resolvedText.trim() : '',
					parentId: parentByNodeId.get(pointId),
					nodeType,
					runs,
					style,
				};
			})
			.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
			.slice(0, MAX_SMARTART_NODES);

		if (nodes.length === 0) {
			return undefined;
		}

		// ── Resolve layout type ──────────────────────────────────────────
		const layoutRelationshipId = String(relationshipIds['@_r:lo'] || '').trim();
		const layoutPart =
			layoutRelationshipId.length > 0
				? await this.readXmlPartByRelationshipId(slidePath, layoutRelationshipId)
				: undefined;
		const layoutType =
			layoutPart?.partPath
				?.split('/')
				.pop()
				?.replace(/\.[^.]+$/u, '') || undefined;

		// The filename ("layout1") says nothing about the algorithm; the layout
		// definition's categories / uniqueId do. Without this, any diagram with
		// no cached drawing part renders as a plain list after reload.
		const layoutDefXml = this.xmlLookupService.getChildByLocalName(layoutPart?.xml, 'layoutDef');
		const layoutCategories = this.xmlLookupService
			.getChildrenArrayByLocalName(
				this.xmlLookupService.getChildByLocalName(layoutDefXml, 'catLst'),
				'cat',
			)
			.map((cat) => String(cat?.['@_type'] || ''));
		const resolvedLayoutType = resolveSmartArtLayoutCategory(
			String(layoutDefXml?.['@_uniqueId'] || ''),
			layoutCategories,
		);

		// ── Parse background (dgm:bg) and outline (dgm:whole) ───────────
		const chrome = this.parseSmartArtChrome(dataModel);

		// ── Parse color transform from ppt/diagrams/colors*.xml ──────────
		// `<dgm:relIds>` carries `@r:cs` for the **colour spec** (per
		// ECMA-376 §17.17.2.4). The drawing-shapes part (`drawing*.xml`)
		// has no slot on `relIds` — it lives in the data model's own rels
		// file via a `dsp:dataModelExt` extension. The legacy code reused
		// `@r:cs` for both, which silently used the colour part as the
		// drawing source. Now resolved separately.
		const colorsRelationshipId = String(relationshipIds['@_r:cs'] || '').trim();
		const colorTransform = await this.parseSmartArtColorTransform(slidePath, colorsRelationshipId);

		// ── Parse drawing shapes from ppt/diagrams/drawing*.xml ──────────
		const drawingResolution = await this.resolveSmartArtDrawingPart(
			slidePath,
			diagramDataRelationshipId,
		);
		const drawingShapes = drawingResolution
			? await this.parseSmartArtDrawingShapesFromPath(drawingResolution.path)
			: [];
		const drawingRelationshipId = drawingResolution?.relId;

		// ── Parse quick style from ppt/diagrams/quickStyles*.xml ─────────
		const styleRelationshipId = String(relationshipIds['@_r:qs'] || '').trim();
		const quickStyle = await this.parseSmartArtQuickStyle(slidePath, styleRelationshipId);

		return {
			layoutType,
			resolvedLayoutType,
			nodes,
			connections: parsedConnections.length > 0 ? parsedConnections : undefined,
			drawingShapes: drawingShapes.length > 0 ? drawingShapes : undefined,
			chrome,
			colorTransform,
			quickStyle,
			dataRelId: diagramDataRelationshipId,
			drawingRelId:
				drawingRelationshipId && drawingRelationshipId.length > 0
					? drawingRelationshipId
					: undefined,
			colorsRelId: colorsRelationshipId.length > 0 ? colorsRelationshipId : undefined,
			styleRelId: styleRelationshipId.length > 0 ? styleRelationshipId : undefined,
		};
	}

	/**
	 * Resolve the SmartArt drawing-shapes part path + relationship id.
	 *
	 * Strategy:
	 *  1. Locate the data-model part's rels file
	 *     (`ppt/diagrams/_rels/data*.xml.rels`) via `slideRelsMap`.
	 *  2. Find a relationship whose `Type` matches the `…/diagramDrawing`
	 *     URI. PowerPoint emits this for any deck that has had its
	 *     SmartArt rendered to drawing shapes.
	 *  3. Return the matched part path (so the caller can load it
	 *     directly) and the relationship id (for round-trip preservation).
	 */
	private async resolveSmartArtDrawingPart(
		slidePath: string,
		diagramDataRelationshipId: string,
	): Promise<{ relId: string; path: string } | undefined> {
		if (diagramDataRelationshipId.length === 0) {
			return undefined;
		}
		const slideRels = this.slideRelsMap.get(slidePath);
		const dataTarget = slideRels?.get(diagramDataRelationshipId);
		if (!dataTarget) {
			return undefined;
		}
		const dataPath = this.resolveImagePath(slidePath, dataTarget);
		// Compute the rels file alongside the data part:
		//   ppt/diagrams/data1.xml → ppt/diagrams/_rels/data1.xml.rels
		const dataDir = dataPath.replace(/\/[^/]+$/u, '');
		const dataFile = dataPath.split('/').pop() ?? '';
		const dataRelsPath = `${dataDir}/_rels/${dataFile}.rels`;

		const relsXml = await this.zip.file(dataRelsPath)?.async('string');
		if (!relsXml) {
			return undefined;
		}
		try {
			const parsed = this.parser.parse(relsXml) as XmlObject;
			const relsRoot = parsed['Relationships'] as XmlObject | undefined;
			if (!relsRoot) {
				return undefined;
			}
			const rels = this.ensureArray(relsRoot['Relationship']) as XmlObject[];
			const drawingRel = rels.find((rel) =>
				String(rel?.['@_Type'] || '').endsWith('/diagramDrawing'),
			);
			const id = String(drawingRel?.['@_Id'] || '').trim();
			const target = String(drawingRel?.['@_Target'] || '').trim();
			if (id.length === 0 || target.length === 0) {
				return undefined;
			}
			const drawingPath = this.resolveImagePath(dataPath, target);
			return { relId: id, path: drawingPath };
		} catch {
			return undefined;
		}
	}

	/**
	 * Parse SmartArt drawing shapes given an absolute part path.
	 *
	 * Wraps `parseSmartArtDrawingShapes` (which expects a slide-relative
	 * relationship id) with a path-based lookup so the resolution layer
	 * can pull the part from anywhere in the package.
	 */
	private async parseSmartArtDrawingShapesFromPath(
		drawingPath: string,
	): Promise<PptxSmartArtDrawingShape[]> {
		const xmlString = await this.zip.file(drawingPath)?.async('string');
		if (!xmlString) {
			return [];
		}
		try {
			const xml = this.parser.parse(xmlString) as XmlObject;
			const drawing = this.xmlLookupService.getChildByLocalName(xml, 'drawing');
			const spTree = this.xmlLookupService.getChildByLocalName(drawing || xml, 'spTree');
			if (!spTree) {
				return [];
			}
			const shapes = this.xmlLookupService.getChildrenArrayByLocalName(spTree, 'sp');
			const emuPerPx = PptxHandlerRuntime.EMU_PER_PX;
			return shapes
				.map((sp, index) => this.parseDrawingShape(sp, index, emuPerPx))
				.filter((entry): entry is PptxSmartArtDrawingShape => entry !== null);
		} catch {
			return [];
		}
	}

	private parseSmartArtConnections(dataModel: XmlObject | undefined): {
		parsedConnections: PptxSmartArtConnection[];
		parentByNodeId: Map<string, string>;
	} {
		const connectionList = this.xmlLookupService.getChildByLocalName(dataModel, 'cxnLst');
		const rawConnections = this.xmlLookupService.getChildrenArrayByLocalName(connectionList, 'cxn');
		const parentByNodeId = new Map<string, string>();
		const parsedConnections: PptxSmartArtConnection[] = [];

		rawConnections.forEach((connection) => {
			const sourceId = String(connection?.['@_srcId'] || '').trim();
			const destinationId = String(connection?.['@_destId'] || '').trim();
			if (sourceId.length === 0 || destinationId.length === 0) {
				return;
			}
			const connType = String(connection?.['@_type'] || '').trim() || undefined;
			const srcOrdRaw = parseInt(String(connection?.['@_srcOrd'] || ''), 10);
			const destOrdRaw = parseInt(String(connection?.['@_destOrd'] || ''), 10);
			parsedConnections.push({
				sourceId,
				destId: destinationId,
				type: connType,
				srcOrd: Number.isFinite(srcOrdRaw) ? srcOrdRaw : undefined,
				destOrd: Number.isFinite(destOrdRaw) ? destOrdRaw : undefined,
			});
			if (!parentByNodeId.has(destinationId)) {
				parentByNodeId.set(destinationId, sourceId);
			}
		});

		return { parsedConnections, parentByNodeId };
	}
}
