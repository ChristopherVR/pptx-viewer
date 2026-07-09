/**
 * Fabricate the cached diagram DRAWING part (`ppt/diagrams/drawingN.xml`) for
 * an SDK-created SmartArt element from its in-memory `drawingShapes`.
 *
 * Without this part PowerPoint recomputes the diagram from the (deliberately
 * simplified) fabricated `layoutN.xml`, which renders every node as an
 * identical rounded rectangle: the "all shapes became the same default shape"
 * symptom. Emitting a cached `dsp:drawing` whose `dsp:sp` shapes each carry
 * their own `a:prstGeom` preserves the per-node geometry (pyramid trapezoids,
 * cycle ellipses, chevrons, ...) the viewer computed.
 *
 * Shape model ids reuse the `nodeId -> {GUID}` map from the data part so
 * PowerPoint correlates each drawn shape with its data point and honours the
 * cache instead of discarding it.
 */
import { EMU_PER_PX } from '../../constants';
import type {
	PptxElement,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
	ShapePptxElement,
} from '../../types';
import { XML_PROLOG, xmlEscape } from './smartart-fabrication-data';
import { newSmartArtGuid } from './smartart-xml-builders';

/** Content type for the cached diagram drawing part. */
export const DIAGRAM_DRAWING_CONTENT_TYPE =
	'application/vnd.ms-office.drawingml.diagramDrawing+xml';

/** Relationship type linking a data part to its cached drawing part. */
export const DIAGRAM_DRAWING_REL_TYPE =
	'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing';

const DSP_XMLNS =
	'xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram"' +
	' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
	' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** The six theme accent colours SmartArt cycles through, one per node. */
const ACCENTS = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];

/** Round a pixel measurement to whole EMU. */
function toEmu(px: number): number {
	return Math.round(px * EMU_PER_PX);
}

/** Normalise a hex colour to a bare 6-digit `RRGGBB` string, or `undefined`. */
function normalizeHex(color: string | undefined): string | undefined {
	if (!color) {
		return undefined;
	}
	const hex = color.replace(/^#/u, '').trim();
	return /^[0-9A-Fa-f]{6}$/u.test(hex) ? hex.toUpperCase() : undefined;
}

/**
 * Resolve the data-point GUID for a drawing shape.
 *
 * Layout-engine shapes embed the node id in their `id` (`engine-<nodeId>`,
 * `reflow-<...>-<nodeId>`); parsed shapes may match a node id directly. Falls
 * back to positional pairing, then to a fresh GUID so a shape is never dropped.
 */
function resolveShapeModelId(
	shape: PptxSmartArtDrawingShape,
	index: number,
	nodes: PptxSmartArtNode[],
	guidByNodeId: Map<string, string>,
): string {
	const direct = guidByNodeId.get(shape.id);
	if (direct) {
		return direct;
	}
	const matched = nodes.find(
		(node) => node.id && (shape.id === node.id || shape.id.endsWith(`-${node.id}`)),
	);
	if (matched?.id) {
		const guid = guidByNodeId.get(matched.id);
		if (guid) {
			return guid;
		}
	}
	const positional = nodes[index]?.id;
	if (positional) {
		const guid = guidByNodeId.get(positional);
		if (guid) {
			return guid;
		}
	}
	return newSmartArtGuid();
}

function textBodyXml(shape: PptxSmartArtDrawingShape): string {
	const text = shape.text ?? '';
	const fontColor = normalizeHex(shape.fontColor);
	const size =
		shape.fontSize && shape.fontSize > 0 ? ` sz="${Math.round(shape.fontSize * 100)}"` : '';
	const fill = fontColor ? `<a:solidFill><a:srgbClr val="${fontColor}"/></a:solidFill>` : '';
	const rPr = `<a:rPr lang="en-US"${size}>${fill}</a:rPr>`;
	const run = text
		? `<a:r>${rPr}<a:t>${xmlEscape(text)}</a:t></a:r>`
		: `<a:endParaRPr lang="en-US"/>`;
	return `<dsp:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/>${run}</a:p></dsp:txBody>`;
}

function styleXml(index: number): string {
	const accent = ACCENTS[index % ACCENTS.length];
	return (
		`<dsp:style>` +
		`<a:lnRef idx="2"><a:schemeClr val="${accent}"><a:shade val="50000"/></a:schemeClr></a:lnRef>` +
		`<a:fillRef idx="1"><a:schemeClr val="${accent}"/></a:fillRef>` +
		`<a:effectRef idx="0"><a:schemeClr val="${accent}"/></a:effectRef>` +
		`<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>` +
		`</dsp:style>`
	);
}

function shapePropsXml(shape: PptxSmartArtDrawingShape): string {
	const rot = shape.rotation ? ` rot="${Math.round(shape.rotation * 60000)}"` : '';
	const xfrm =
		`<a:xfrm${rot}>` +
		`<a:off x="${toEmu(shape.x)}" y="${toEmu(shape.y)}"/>` +
		`<a:ext cx="${toEmu(Math.max(shape.width, 1))}" cy="${toEmu(Math.max(shape.height, 1))}"/>` +
		`</a:xfrm>`;
	const prst = shape.shapeType && shape.shapeType.length > 0 ? shape.shapeType : 'rect';
	const geom = `<a:prstGeom prst="${xmlEscape(prst)}"><a:avLst/></a:prstGeom>`;
	const fillHex = normalizeHex(shape.fillColor);
	const fill = fillHex ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>` : '';
	const strokeHex = normalizeHex(shape.strokeColor);
	const strokeW =
		shape.strokeWidth && shape.strokeWidth > 0
			? ` w="${Math.round(shape.strokeWidth * 12700)}"`
			: '';
	const ln = strokeHex
		? `<a:ln${strokeW}><a:solidFill><a:srgbClr val="${strokeHex}"/></a:solidFill></a:ln>`
		: '';
	return `<dsp:spPr>${xfrm}${geom}${fill}${ln}</dsp:spPr>`;
}

function shapeXml(
	shape: PptxSmartArtDrawingShape,
	index: number,
	nodes: PptxSmartArtNode[],
	guidByNodeId: Map<string, string>,
): string {
	const modelId = resolveShapeModelId(shape, index, nodes, guidByNodeId);
	return (
		`<dsp:sp modelId="${modelId}">` +
		`<dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr>` +
		`${shapePropsXml(shape)}${styleXml(index)}${textBodyXml(shape)}</dsp:sp>`
	);
}

/**
 * Build the complete `drawingN.xml` payload for a fabricated SmartArt diagram.
 *
 * Returns `undefined` when there are no drawing shapes to cache (the caller
 * then omits the drawing part and lets PowerPoint recompute the layout).
 */
export function buildFabricatedDrawingXml(
	shapes: PptxSmartArtDrawingShape[] | undefined,
	nodes: PptxSmartArtNode[],
	guidByNodeId: Map<string, string>,
): string | undefined {
	if (!shapes || shapes.length === 0) {
		return undefined;
	}
	const body = shapes.map((shape, index) => shapeXml(shape, index, nodes, guidByNodeId)).join('');
	return (
		`${XML_PROLOG}\r\n<dsp:drawing ${DSP_XMLNS}>` +
		`<dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>${body}</dsp:spTree></dsp:drawing>`
	);
}

/** Build the `dataN.xml.rels` payload linking the data part to its drawing. */
export function buildDiagramDataRelsXml(drawingRelId: string, drawingFileName: string): string {
	return (
		`${XML_PROLOG}\r\n` +
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
		`<Relationship Id="${xmlEscape(drawingRelId)}" Type="${DIAGRAM_DRAWING_REL_TYPE}" Target="${xmlEscape(drawingFileName)}"/>` +
		`</Relationships>`
	);
}

/**
 * Convert decomposed SmartArt shape elements (from `decomposeSmartArt`) into
 * cacheable drawing shapes.
 *
 * When an SDK-created diagram carries no `drawingShapes`, the viewer renders it
 * by running the decompose/layout algorithms; the same algorithm output is
 * cached here so PowerPoint reopens the diagram with matching per-node geometry
 * instead of recomputing the simplified fabricated layout. Non-shape elements
 * (connectors) are skipped: they are reconstructed by PowerPoint's own layout.
 */
export function smartArtElementsToDrawingShapes(
	elements: PptxElement[] | undefined,
): PptxSmartArtDrawingShape[] {
	if (!elements || elements.length === 0) {
		return [];
	}
	const shapes: PptxSmartArtDrawingShape[] = [];
	for (const el of elements) {
		if (el.type !== 'shape') {
			continue;
		}
		const shape = el as ShapePptxElement;
		shapes.push({
			id: shape.id,
			shapeType: shape.shapeType ?? 'rect',
			x: shape.x,
			y: shape.y,
			width: shape.width,
			height: shape.height,
			rotation: shape.rotation,
			fillColor: shape.shapeStyle?.fillColor,
			strokeColor: shape.shapeStyle?.strokeColor,
			strokeWidth: shape.shapeStyle?.strokeWidth,
			text: shape.text,
			fontSize: shape.textStyle?.fontSize,
			fontColor: shape.textStyle?.color,
		});
	}
	return shapes;
}
