import type {
	ConnectorConnectionPoint,
	PptxElement,
	ShapeStyle,
	TextSegment,
	TextStyle,
	XmlObject,
} from '../../types';

export interface ConnectorTextResult {
	text: string;
	textStyle: TextStyle;
	textSegments: TextSegment[];
}

export interface PptxConnectorParserContext {
	emuPerPx: number;
	getOrderedSlidePaths: () => string[];
	slideRelsMap: Map<string, Map<string, string>>;
	parseGeometryAdjustments: (prstGeom: XmlObject | undefined) => Record<string, number> | undefined;
	readFlipState: (xfrm: XmlObject | undefined) => {
		flipHorizontal?: boolean;
		flipVertical?: boolean;
	};
	extractShapeStyle: (spPr: XmlObject | undefined, styleNode?: XmlObject) => ShapeStyle;
	parseShapeLocks: (spLocks: XmlObject | undefined) => PptxElement['locks'];
	parseElementActions: (
		cNvPr: XmlObject | undefined,
		slideRelationships: Map<string, string> | undefined,
		orderedSlidePaths: string[],
	) => {
		actionClick?: PptxElement['actionClick'];
		actionHover?: PptxElement['actionHover'];
	};
	/** Parse text body XML into text, style, and segments. */
	parseConnectorTextBody?: (
		txBody: XmlObject | undefined,
		slidePath?: string,
	) => ConnectorTextResult | null;
}

export interface IPptxConnectorParser {
	parseConnector(connector: XmlObject, id: string, slidePath?: string): PptxElement | null;
}

export class PptxConnectorParser implements IPptxConnectorParser {
	private readonly context: PptxConnectorParserContext;

	public constructor(context: PptxConnectorParserContext) {
		this.context = context;
	}

	public parseConnector(connector: XmlObject, id: string, slidePath?: string): PptxElement | null {
		try {
			const shapeProperties = connector['p:spPr'] as XmlObject | undefined;
			const transform = shapeProperties?.['a:xfrm'] as XmlObject | undefined;
			if (!transform) {
				return null;
			}

			const offset = transform['a:off'] as XmlObject | undefined;
			const extent = transform['a:ext'] as XmlObject | undefined;
			if (!offset || !extent) {
				return null;
			}

			const shapeType = String(
				(shapeProperties?.['a:prstGeom'] as XmlObject | undefined)?.['@_prst'] ||
					'straightConnector1',
			);
			const shapeAdjustments = this.context.parseGeometryAdjustments(
				shapeProperties?.['a:prstGeom'] as XmlObject | undefined,
			);
			const rotation = transform['@_rot']
				? parseInt(String(transform['@_rot']), 10) / 60000
				: undefined;
			const skewX = transform['@_skewX']
				? parseInt(String(transform['@_skewX']), 10) / 60000
				: undefined;
			const skewY = transform['@_skewY']
				? parseInt(String(transform['@_skewY']), 10) / 60000
				: undefined;
			const { flipHorizontal, flipVertical } = this.context.readFlipState(transform);

			const cNvConnectionShapeProperties = (connector?.['p:nvCxnSpPr'] as XmlObject | undefined)?.[
				'p:cNvCxnSpPr'
			] as XmlObject | undefined;
			// `p:cxnSp` carries a `<p:style>` exactly like `p:sp` does, and for a
			// connector it is usually the ONLY place the colour lives: PowerPoint
			// writes `<a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef>` there
			// and leaves `spPr/a:ln` holding nothing but the arrow ends. Dropping
			// the style node stroked every such connector in the default dark grey
			// instead of the theme accent.
			const shapeStyle = this.context.extractShapeStyle(
				shapeProperties,
				connector['p:style'] as XmlObject | undefined,
			);

			const startConnectionNode = cNvConnectionShapeProperties?.['a:stCxn'] as
				| XmlObject
				| undefined;
			if (startConnectionNode) {
				const startConnection: ConnectorConnectionPoint = {};
				if (startConnectionNode['@_id']) {
					startConnection.shapeId = String(startConnectionNode['@_id']);
				}
				if (startConnectionNode['@_idx'] !== undefined) {
					startConnection.connectionSiteIndex = parseInt(String(startConnectionNode['@_idx']), 10);
				}
				if (shapeStyle) {
					shapeStyle.connectorStartConnection = startConnection;
				}
			}

			const endConnectionNode = cNvConnectionShapeProperties?.['a:endCxn'] as XmlObject | undefined;
			if (endConnectionNode) {
				const endConnection: ConnectorConnectionPoint = {};
				if (endConnectionNode['@_id']) {
					endConnection.shapeId = String(endConnectionNode['@_id']);
				}
				if (endConnectionNode['@_idx'] !== undefined) {
					endConnection.connectionSiteIndex = parseInt(String(endConnectionNode['@_idx']), 10);
				}
				if (shapeStyle) {
					shapeStyle.connectorEndConnection = endConnection;
				}
			}

			const cNvPr = (connector?.['p:nvCxnSpPr'] as XmlObject | undefined)?.['p:cNvPr'] as
				| XmlObject
				| undefined;
			const slideRelationships = slidePath ? this.context.slideRelsMap.get(slidePath) : undefined;
			const { actionClick, actionHover } = this.context.parseElementActions(
				cNvPr,
				slideRelationships,
				this.context.getOrderedSlidePaths(),
			);

			// Extract element name from cNvPr/@name (used for morph !! matching)
			const connElementName = cNvPr?.['@_name'] ? String(cNvPr['@_name']).trim() : undefined;

			// Accessibility description/title from `p:cNvPr/@descr` / `@title`,
			// the same attributes a plain shape/text box now parses (see
			// `PptxHandlerRuntimeShapeParsing.ts`) and a graphic frame already did.
			const connAltText = String(cNvPr?.['@_descr'] || '').trim() || undefined;
			const connTitle = String(cNvPr?.['@_title'] || '').trim() || undefined;

			const locks = this.context.parseShapeLocks(
				(cNvConnectionShapeProperties?.['a:cxnSpLocks'] ??
					cNvConnectionShapeProperties?.['a:spLocks']) as XmlObject | undefined,
			);

			// Parse connector text body (a:txBody within p:cxnSp)
			const txBody = connector['p:txBody'] as XmlObject | undefined;
			const textResult = this.context.parseConnectorTextBody?.(txBody, slidePath);

			return {
				id,
				name: connElementName || undefined,
				altText: connAltText,
				title: connTitle,
				type: 'connector',
				x: Math.round(parseInt(String(offset['@_x'] || '0'), 10) / this.context.emuPerPx),
				y: Math.round(parseInt(String(offset['@_y'] || '0'), 10) / this.context.emuPerPx),
				width: Math.round(parseInt(String(extent['@_cx'] || '0'), 10) / this.context.emuPerPx),
				height: Math.round(parseInt(String(extent['@_cy'] || '0'), 10) / this.context.emuPerPx),
				// Exact EMU alongside the rounded pixel value; see
				// `xfrm-emu-resolution.ts` for why the save-side writer can only
				// re-emit these when the connector has not moved/resized.
				xEmu: parseInt(String(offset['@_x'] || '0'), 10),
				yEmu: parseInt(String(offset['@_y'] || '0'), 10),
				widthEmu: parseInt(String(extent['@_cx'] || '0'), 10),
				heightEmu: parseInt(String(extent['@_cy'] || '0'), 10),
				shapeType,
				shapeAdjustments,
				rotation,
				skewX,
				skewY,
				flipHorizontal,
				flipVertical,
				shapeStyle,
				rawXml: connector,
				actionClick,
				actionHover,
				locks,
				...(textResult
					? {
							text: textResult.text,
							textStyle: textResult.textStyle,
							textSegments: textResult.textSegments,
						}
					: {}),
			};
		} catch {
			return null;
		}
	}
}
