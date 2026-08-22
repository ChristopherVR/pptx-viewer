import { XmlObject } from '../../types';
import type {
	PptxSmartArtConnection,
	PptxCustomPathProperties,
	PptxSmartArtDrawingShape,
	PptxSmartArtQuickStyle,
} from '../../types';
import type { DiagramRelationshipIds } from '../../utils/diagram-relationship-ids';
import { collectSmartArtTransitionText } from '../../utils/smartart-connector-labels';
import { parseSmartArtConnection } from '../../utils/smartart-data-model-attributes';
import {
	parseSmartArtDefinitionMetadata,
	parseSmartArtQuickStyleLabels,
} from '../../utils/smartart-definition-metadata';
import { resolveSmartArtEffectIntensity } from '../../utils/smartart-effect-intensity';
import { projectSmartArtNodeText } from '../../utils/smartart-node-text-projection';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSmartArtXmlUtils';
import {
	extractDrawingShapeFill,
	extractDrawingShapeTextStyle,
} from './smartart-drawing-shape-style';
import type { DrawingShapeStyleDeps } from './smartart-drawing-shape-style';
import { parseSmartArtTextParagraphs, smartArtParagraphsText } from './smartart-text-paragraphs';
import { resolveSmartArtTextStyles } from './smartart-text-style-resolution';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected reportIncompleteSmartArtRelationships(
		graphicFrame: XmlObject | undefined,
		relationshipIds: DiagramRelationshipIds | undefined,
		slidePath: string,
	): void {
		const missing = (
			[
				['dm', relationshipIds?.dataRelId],
				['lo', relationshipIds?.layoutRelId],
				['qs', relationshipIds?.styleRelId],
				['cs', relationshipIds?.colorsRelId],
			] as const
		)
			.filter(([, value]) => !value)
			.map(([name]) => name);
		if (missing.length === 0) {
			return;
		}
		const cNvPr = this.xmlLookupService.getChildByLocalName(
			this.xmlLookupService.getChildByLocalName(graphicFrame, 'nvGraphicFramePr'),
			'cNvPr',
		);
		this.compatibilityService.reportWarning({
			code: 'DIAGRAM_RELATIONSHIP_IDS_INCOMPLETE',
			message: `SmartArt relIds is missing required relationship attributes: ${missing.join(', ')}.`,
			scope: 'element',
			slideId: slidePath,
			elementId: String(cNvPr?.['@_id'] ?? '') || undefined,
			xmlPath: 'p:graphicFrame/a:graphic/a:graphicData/dgm:relIds',
		});
	}

	protected parseSmartArtConnections(dataModel: XmlObject | undefined): {
		parsedConnections: PptxSmartArtConnection[];
		parentByNodeId: Map<string, string>;
	} {
		const connectionList = this.xmlLookupService.getChildByLocalName(dataModel, 'cxnLst');
		const rawConnections = this.xmlLookupService.getChildrenArrayByLocalName(connectionList, 'cxn');
		// `parTrans`/`sibTrans` points carry the connector text PowerPoint's own
		// diagram editor lets a user type onto an org-chart relationship line;
		// resolved here (needs the FULL ptLst, not just content points) and
		// attached to the connection that references the transition point.
		const pointList = this.xmlLookupService.getChildByLocalName(dataModel, 'ptLst');
		const points = this.xmlLookupService.getChildrenArrayByLocalName(pointList, 'pt');
		const transitionTextById = collectSmartArtTransitionText(points, (point) => {
			const values: string[] = [];
			this.collectLocalTextValues(point, 't', values);
			return values.join('');
		});
		const parentByNodeId = new Map<string, string>();
		const parsedConnections: PptxSmartArtConnection[] = [];

		rawConnections.forEach((connection) => {
			const parsed = parseSmartArtConnection(connection);
			if (!parsed) {
				return;
			}
			const transitionId = parsed.parentTransitionId ?? parsed.siblingTransitionId;
			const label = transitionId ? transitionTextById.get(transitionId) : undefined;
			parsedConnections.push(label ? { ...parsed, label } : parsed);
			// `parOf` (the schema default when `@_type` is omitted, per ECMA-376
			// CT_Cxn) is the only connection type expressing a data-graph
			// parent/child edge; without this check a `presOf`/`presParOf`/
			// `sibTrans` connection sharing the same `destId` space could shadow
			// a genuine `parOf` edge depending on document order, instead of
			// relying on incidental id-space separation.
			const isParentChildEdge = !parsed.type || parsed.type === 'parOf';
			if (isParentChildEdge && !parentByNodeId.has(parsed.destId)) {
				parentByNodeId.set(parsed.destId, parsed.sourceId);
			}
		});

		return { parsedConnections, parentByNodeId };
	}

	/**
	 * Parse quick style from `ppt/diagrams/quickStyles*.xml`.
	 */
	protected async parseSmartArtQuickStyle(
		slidePath: string,
		styleRelId: string,
	): Promise<PptxSmartArtQuickStyle | undefined> {
		if (styleRelId.length === 0) {
			return undefined;
		}

		try {
			const stylePart = await this.readXmlPartByRelationshipId(slidePath, styleRelId);
			if (!stylePart) {
				return undefined;
			}

			const styleDef = this.xmlLookupService.getChildByLocalName(stylePart.xml, 'styleDef');
			if (!styleDef) {
				return undefined;
			}

			const localName = (key: string) => this.compatibilityService.getXmlLocalName(key);
			const metadata = parseSmartArtDefinitionMetadata(styleDef, localName);
			const labels = parseSmartArtQuickStyleLabels(styleDef, localName);
			const name =
				metadata.titles?.[0]?.value ||
				String(styleDef['@_title'] || styleDef['@_uniqueId'] || '').trim() ||
				undefined;

			const styleLbls = this.xmlLookupService.getChildrenArrayByLocalName(styleDef, 'styleLbl');
			const effectIntensity = resolveSmartArtEffectIntensity(styleLbls, localName);

			return { ...metadata, name, effectIntensity, labels };
		} catch {
			return undefined;
		}
	}

	/**
	 * Parse pre-computed shapes from `ppt/diagrams/drawing*.xml`.
	 */
	protected async parseSmartArtDrawingShapes(
		slidePath: string,
		drawingRelId: string,
	): Promise<PptxSmartArtDrawingShape[]> {
		if (drawingRelId.length === 0) {
			return [];
		}

		try {
			const drawingPart = await this.readXmlPartByRelationshipId(slidePath, drawingRelId);
			if (!drawingPart) {
				return [];
			}

			const drawing = this.xmlLookupService.getChildByLocalName(drawingPart.xml, 'drawing');
			const spTree = this.xmlLookupService.getChildByLocalName(
				drawing || drawingPart.xml,
				'spTree',
			);
			if (!spTree) {
				return [];
			}

			const shapes = this.xmlLookupService.getChildrenArrayByLocalName(spTree, 'sp');
			const emuPerPx = PptxHandlerRuntime.EMU_PER_PX;

			return shapes
				.map((sp, index) => {
					return this.parseDrawingShape(sp, index, emuPerPx);
				})
				.filter((entry): entry is PptxSmartArtDrawingShape => entry !== null);
		} catch {
			return [];
		}
	}

	protected parseDrawingShape(
		sp: XmlObject,
		index: number,
		emuPerPx: number,
	): PptxSmartArtDrawingShape | null {
		const spPr = this.xmlLookupService.getChildByLocalName(sp, 'spPr');
		if (!spPr) {
			return null;
		}

		const xfrm = this.xmlLookupService.getChildByLocalName(spPr, 'xfrm');
		const off = this.xmlLookupService.getChildByLocalName(xfrm, 'off');
		const ext = this.xmlLookupService.getChildByLocalName(xfrm, 'ext');
		if (!off || !ext) {
			return null;
		}

		const x = Math.round(parseInt(String(off['@_x'] || '0'), 10) / emuPerPx);
		const y = Math.round(parseInt(String(off['@_y'] || '0'), 10) / emuPerPx);
		const width = Math.round(parseInt(String(ext['@_cx'] || '0'), 10) / emuPerPx);
		const height = Math.round(parseInt(String(ext['@_cy'] || '0'), 10) / emuPerPx);

		const rotation = xfrm?.['@_rot'] ? parseInt(String(xfrm['@_rot']), 10) / 60000 : undefined;
		const skewX = xfrm?.['@_skewX'] ? parseInt(String(xfrm['@_skewX']), 10) / 60000 : undefined;
		const skewY = xfrm?.['@_skewY'] ? parseInt(String(xfrm['@_skewY']), 10) / 60000 : undefined;

		const prstGeom = this.xmlLookupService.getChildByLocalName(spPr, 'prstGeom');
		const custGeom = this.xmlLookupService.getChildByLocalName(spPr, 'custGeom');
		let shapeType = prstGeom ? String(prstGeom['@_prst'] || 'rect') : 'rect';
		let customGeometry: PptxCustomPathProperties = {};
		if (custGeom) {
			const path = this.parseCustomGeometry(custGeom, width, height);
			if (path) {
				shapeType = 'custom';
				const handles = this.extractCustomGeometryAdjustHandles(custGeom);
				customGeometry = {
					...path,
					customGeometryPaths: this.buildStructuredCustomGeometryPaths(
						custGeom,
						path.pathWidth,
						path.pathHeight,
					),
					customGeometryRawData: this.extractCustomGeometryRawData(custGeom),
					customGeometryAdjustHandlesXY: handles.xy,
					customGeometryAdjustHandlesPolar: handles.polar,
					customGeometryConnectionSites: this.extractCustomGeometryConnectionSites(custGeom),
					customGeometryTextRect: this.extractCustomGeometryTextRect(custGeom),
				};
			}
		}

		// A zero-width or zero-height cached shape is normally a producer's
		// stale/degenerate frame extent and gets dropped. `line` preset geometry
		// (ECMA-376 Part 1 20.1.9.18) is the one legitimate exception: PowerPoint's
		// built-in Timeline layout, among others, caches connector rails/stems as a
		// `line` with zero height or width by design.
		if ((width <= 0 || height <= 0) && shapeType !== 'line') {
			return null;
		}

		// Fills (solid / gradient / pattern / picture) + outer shadow. Built-in
		// SmartArt layouts routinely use non-solid fills; reading only solidFill
		// flattened them to plain boxes (issue #73).
		const fill = extractDrawingShapeFill(spPr, this.drawingShapeStyleDeps());

		const lnNode = this.xmlLookupService.getChildByLocalName(spPr, 'ln');
		const lnFill = lnNode
			? this.xmlLookupService.getChildByLocalName(lnNode, 'solidFill')
			: undefined;
		const strokeColor = this.parseColor(lnFill);
		const strokeWidthRaw = lnNode ? parseInt(String(lnNode['@_w'] || ''), 10) : NaN;
		const strokeWidth =
			Number.isFinite(strokeWidthRaw) && strokeWidthRaw > 0 ? strokeWidthRaw / 12700 : undefined;

		const txBody = this.xmlLookupService.getChildByLocalName(sp, 'txBody');
		const textValues: string[] = [];
		if (txBody) {
			this.collectLocalTextValues(txBody, 't', textValues);
		}
		const text = textValues.join('').trim() || undefined;

		const { fontSize, fontColor } = extractDrawingShapeTextStyle(
			txBody,
			this.drawingShapeStyleDeps(),
		);
		const paragraphs = txBody
			? resolveSmartArtTextStyles(parseSmartArtTextParagraphs({ 'dgm:t': txBody }), (rPr) =>
					this.extractTextRunStyle(rPr, undefined, undefined, false),
				)
			: undefined;
		const structuredText = paragraphs ? smartArtParagraphsText(paragraphs) : text;
		const textSegments = paragraphs
			? projectSmartArtNodeText(
					{ id: String(sp['@_modelId'] || `dsp-${index}`), text: structuredText ?? '', paragraphs },
					{
						...(fontSize !== undefined ? { fontSize } : {}),
						...(fontColor ? { color: fontColor } : {}),
					},
				)
			: undefined;

		const nvSpPr = this.xmlLookupService.getChildByLocalName(sp, 'nvSpPr');
		const cNvPr = this.xmlLookupService.getChildByLocalName(nvSpPr, 'cNvPr');
		// `dsp:sp/@modelId` identifies the presentation point represented by this
		// cached shape. Keep it as the stable id so edited drawings can reuse the
		// original presentation association, including connector-like shapes that
		// do not map one-to-one to semantic content nodes.
		const id = String(sp['@_modelId'] || cNvPr?.['@_id'] || `dsp-${index}`);

		return {
			id,
			shapeType,
			x,
			y,
			width,
			height,
			rotation,
			skewX,
			skewY,
			...fill,
			fillColor: fill.fillColor ?? undefined,
			strokeColor: strokeColor ?? undefined,
			strokeWidth,
			text: structuredText,
			textSegments,
			fontSize,
			fontColor,
			...customGeometry,
		};
	}

	/**
	 * Build the injected accessor bundle used by the pure drawing-shape style
	 * helpers, binding the shared XML-lookup / colour / gradient / shadow codec
	 * methods so no new colour logic is duplicated here.
	 */
	private drawingShapeStyleDeps(): DrawingShapeStyleDeps {
		return {
			getChild: (node, local) => this.xmlLookupService.getChildByLocalName(node, local),
			hasChild: (node, local) => this.xmlLookupService.hasChildByLocalName(node, local),
			getChildren: (node, local) => this.xmlLookupService.getChildrenArrayByLocalName(node, local),
			parseColor: (node) => this.parseColor(node),
			extractGradientStops: (gradFill) => this.extractGradientStops(gradFill),
			extractGradientType: (gradFill) => this.extractGradientType(gradFill),
			extractGradientAngle: (gradFill) => this.extractGradientAngle(gradFill),
			extractShadowColor: (spPr) => this.extractShadowStyle(spPr).shadowColor,
		};
	}
}
