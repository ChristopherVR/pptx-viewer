import { XmlObject } from '../../types';
import type { PptxSmartArtData, PptxSmartArtDrawingShape } from '../../types';
import { parseDiagramRelationshipIds, parseSmartArtLayoutDefinition } from '../../utils';
import { parseSmartArtPresLayoutVars } from '../../utils/smartart-pres-layout-vars';
import { MAX_SMARTART_NODES } from '../builders/smart-art-text-helpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSmartArtParsing';
import { parseDrawingShapesFromPart } from './smartart-drawing-blip';
import type { DrawingBlipDeps } from './smartart-drawing-blip';
import { resolveSmartArtLayoutCategory } from './smartart-layout-category';
import {
	firstParagraphRuns,
	parseSmartArtTextParagraphs,
	smartArtParagraphsText,
} from './smartart-text-paragraphs';
import { resolveSmartArtTextStyles } from './smartart-text-style-resolution';
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

		const parsedRelationshipIds = parseDiagramRelationshipIds(graphicData);
		this.reportIncompleteSmartArtRelationships(graphicFrame, parsedRelationshipIds, slidePath);
		const diagramDataRelationshipId = parsedRelationshipIds?.dataRelId ?? '';
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
				// Capture per-run formatting so a load -> edit -> save round-trip
				// keeps a node's individual runs (bold / colour / size) instead of
				// flattening them to a single unstyled run on save.
				const paragraphs = resolveSmartArtTextStyles(parseSmartArtTextParagraphs(point), (rPr) =>
					this.extractTextRunStyle(rPr, undefined, undefined, false),
				);
				const runs = firstParagraphRuns(paragraphs);
				const resolvedText = paragraphs ? smartArtParagraphsText(paragraphs) : textValues.join('');

				// Capture any per-node colour / emphasis override so the editing
				// UI can display current values and the save path round-trips it.
				const style = this.extractSmartArtNodeStyle(point);

				return {
					id: pointId,
					text: resolvedText,
					connectionId: String(point?.['@_cxnId'] || '').trim() || undefined,
					parentId: parentByNodeId.get(pointId),
					nodeType,
					runs,
					paragraphs,
					style,
				};
			})
			.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
			.slice(0, MAX_SMARTART_NODES);

		if (nodes.length === 0) {
			return undefined;
		}

		// ── Resolve layout type ──────────────────────────────────────────
		const layoutRelationshipId = parsedRelationshipIds?.layoutRelId ?? '';
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
		const layoutDefinition = parseSmartArtLayoutDefinition(layoutDefXml, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
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
		const colorsRelationshipId = parsedRelationshipIds?.colorsRelId ?? '';
		const colorTransform = await this.parseSmartArtColorTransform(slidePath, colorsRelationshipId);

		// ── Parse drawing shapes from ppt/diagrams/drawing*.xml ──────────
		const dataModelExtList = this.xmlLookupService.getChildByLocalName(dataModel, 'extLst');
		const drawingExtension = this.xmlLookupService
			.getChildrenArrayByLocalName(dataModelExtList, 'ext')
			.map((ext) => this.xmlLookupService.getChildByLocalName(ext, 'dataModelExt'))
			.find(Boolean);
		const drawingExtensionRelId = String(drawingExtension?.['@_relId'] || '').trim();
		const drawingResolution = await this.resolveSmartArtDrawingPart(
			slidePath,
			diagramDataRelationshipId,
			drawingExtensionRelId,
		);
		const drawingShapes = drawingResolution
			? await this.parseSmartArtDrawingShapesFromPath(drawingResolution.path)
			: [];
		const drawingRelationshipId = drawingResolution?.relId;

		// ── Parse quick style from ppt/diagrams/quickStyles*.xml ─────────
		const styleRelationshipId = parsedRelationshipIds?.styleRelId ?? '';
		const quickStyle = await this.parseSmartArtQuickStyle(slidePath, styleRelationshipId);

		return {
			layoutType,
			resolvedLayoutType,
			layoutDefinition,
			nodes,
			connections: parsedConnections.length > 0 ? parsedConnections : undefined,
			presLayoutVars: parseSmartArtPresLayoutVars(dataModel),
			drawingShapes: drawingShapes.length > 0 ? drawingShapes : undefined,
			chrome,
			colorTransform,
			quickStyle,
			dataRelId: diagramDataRelationshipId,
			layoutRelId: layoutRelationshipId.length > 0 ? layoutRelationshipId : undefined,
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
	 *  1. Resolve `dsp:dataModelExt/@relId` in the owning slide's relationship
	 *     scope, which is where PowerPoint writes diagramDrawing relationships.
	 *  2. Fall back to the data part's rels file for compatibility with files
	 *     emitted by older pptx-viewer versions.
	 *  3. Return the matched part path (so the caller can load it
	 *     directly) and the relationship id (for round-trip preservation).
	 */
	private async resolveSmartArtDrawingPart(
		slidePath: string,
		diagramDataRelationshipId: string,
		drawingExtensionRelId: string,
	): Promise<{ relId: string; path: string } | undefined> {
		if (diagramDataRelationshipId.length === 0) {
			return undefined;
		}
		const slideRels = this.slideRelsMap.get(slidePath);
		const slideDrawingTarget = drawingExtensionRelId
			? slideRels?.get(drawingExtensionRelId)
			: undefined;
		if (slideDrawingTarget) {
			return {
				relId: drawingExtensionRelId,
				path: this.resolveImagePath(slidePath, slideDrawingTarget),
			};
		}

		// Some producers omit dataModelExt but still leave a single drawing part
		// relationship on the slide. Recover it by its target path.
		const inferredSlideDrawing = [...(slideRels?.entries() ?? [])].find(([, target]) =>
			/(?:^|\/)diagrams\/drawing\d+\.xml$/u.test(target.replaceAll('\\', '/')),
		);
		if (inferredSlideDrawing) {
			return {
				relId: inferredSlideDrawing[0],
				path: this.resolveImagePath(slidePath, inferredSlideDrawing[1]),
			};
		}

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
			const drawingRel = rels.find((rel) => {
				const id = String(rel?.['@_Id'] || '').trim();
				return (
					(!drawingExtensionRelId || id === drawingExtensionRelId) &&
					String(rel?.['@_Type'] || '').endsWith('/diagramDrawing')
				);
			});
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
	 * Parse cached SmartArt drawing shapes from an absolute part path.
	 *
	 * Enumerates `dsp:sp` / bare `dsp:pic` (incl. nested `dsp:grpSp`) and
	 * resolves picture (blip) fills to data URLs via the drawing part's own
	 * relationships. Delegates to a pure helper with an injected dep bundle.
	 */
	private async parseSmartArtDrawingShapesFromPath(
		drawingPath: string,
	): Promise<PptxSmartArtDrawingShape[]> {
		return parseDrawingShapesFromPart(drawingPath, this.drawingBlipDeps());
	}

	/** Bind runtime zip / parser / lookup / image helpers for the drawing parser. */
	private drawingBlipDeps(): DrawingBlipDeps {
		return {
			readText: (path) => this.zip.file(path)?.async('string') ?? Promise.resolve(undefined),
			parse: (xml) => this.parser.parse(xml) as XmlObject,
			getChild: (node, local) => this.xmlLookupService.getChildByLocalName(node, local),
			getChildren: (node, local) => this.xmlLookupService.getChildrenArrayByLocalName(node, local),
			parseDrawingShape: (sp, index, emuPerPx) => this.parseDrawingShape(sp, index, emuPerPx),
			emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
			ensureArray: (value) => this.ensureArray(value),
			resolveImagePath: (base, target) => this.resolveImagePath(base, target),
			getImageData: (path) => this.getImageData(path),
		};
	}
}
