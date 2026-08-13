/**
 * SmartArt fallback-layout paint decisions: where a node's label sits and how a
 * connector is stroked.
 *
 * `RenderedNode` / `RenderedConnector` carry a set of OPTIONAL paint and
 * placement fields (`fontColor`, `fontWeight`, `fontStyle`, `textX`, `textY`,
 * `textAnchor`, `textBaseline`; `stroke`, `strokeWidth`, `opacity`, `dash`).
 * Every one has a documented binding default, so a renderer that ignored them
 * kept its historic output - which is exactly what four of the five bindings
 * did, hardcoding `fill="white"` and parking circle labels on `cx`/`cy`. Target
 * captions and timeline captions then sat on top of their dot instead of beside
 * or above it.
 *
 * Applying those defaults, and stacking a multi-line label for the three
 * baseline modes, is arithmetic no binding should own a copy of. This module is
 * the single pure decision function: it returns a framework-neutral descriptor
 * and each binding does nothing but map it onto `<text>` / `<tspan>` / `<path>`
 * attributes.
 *
 * @module smartart-node-label
 */

import type { RenderedConnector, RenderedNode } from './smartart-layout-types';
import { centeredSvgTextLines } from './svg-text-lines';
import type { SvgTextLine } from './svg-text-lines';

/** Multiple of the font size used as the line box height, as PowerPoint does. */
const LINE_HEIGHT_RATIO = 1.2;

/** Label colour when a node carries no `fontColor` override. */
export const SMARTART_LABEL_COLOR = 'white';

/** Connector stroke colour when the descriptor carries no override. */
export const SMARTART_CONNECTOR_STROKE = '#94a3b8';
/** Connector stroke width when the descriptor carries no override. */
export const SMARTART_CONNECTOR_WIDTH = 1.5;
/** Connector stroke opacity when the descriptor carries no override. */
export const SMARTART_CONNECTOR_OPACITY = 0.5;

/** Resolved paint for one fallback-layout connector path. */
export interface SmartArtConnectorPaint {
	/** SVG path data, copied straight from the descriptor. */
	d: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	/** SVG `stroke-dasharray`, or `undefined` for a solid line. */
	dash: string | undefined;
}

/**
 * Resolve a connector's paint, applying the documented default for each field
 * the layout engine left unset.
 */
export function smartArtConnectorPaint(connector: RenderedConnector): SmartArtConnectorPaint {
	return {
		d: connector.d,
		stroke: connector.stroke ?? SMARTART_CONNECTOR_STROKE,
		strokeWidth: connector.strokeWidth ?? SMARTART_CONNECTOR_WIDTH,
		opacity: connector.opacity ?? SMARTART_CONNECTOR_OPACITY,
		dash: connector.dash,
	};
}

/** Everything a binding needs to draw one node's label, already decided. */
export interface SmartArtNodeLabel {
	/** Whether the node has any label at all; `false` means draw no `<text>`. */
	visible: boolean;
	/** X of the text block (also the x of every `<tspan>`). */
	x: number;
	/** SVG `text-anchor`. */
	textAnchor: 'start' | 'middle' | 'end';
	/** SVG `dominant-baseline` for the block. */
	dominantBaseline: 'auto' | 'hanging' | 'central';
	/** Absolute-positioned lines: one `<tspan>` per entry, at its own `y`. */
	lines: SvgTextLine[];
	fill: string;
	fontSize: number;
	/** SVG `font-weight`, or `undefined` to leave it unset. */
	fontWeight: number | undefined;
	/** SVG `font-style`, or `undefined` to leave it unset. */
	fontStyle: 'italic' | undefined;
}

/**
 * Stack a label's lines for a given baseline mode.
 *
 * - `middle`: block centred on `y` (`dominant-baseline: central`).
 * - `bottom`: last line's baseline on `y`, lines stacking upward
 *   (`dominant-baseline: auto`) - a caption sitting ABOVE its node.
 * - `top`: first line's top on `y`, lines stacking downward
 *   (`dominant-baseline: hanging`) - a caption sitting BELOW its node.
 */
function labelLines(
	text: string,
	fontSize: number,
	y: number,
	baseline: 'top' | 'middle' | 'bottom',
): SvgTextLine[] {
	if (baseline === 'middle') {
		return centeredSvgTextLines(text, fontSize, { centerY: y });
	}
	const lines = text.split('\n').filter((line) => line.length > 0);
	if (lines.length === 0) {
		return [{ text: '', y }];
	}
	const lineHeight = fontSize * LINE_HEIGHT_RATIO;
	const startY = baseline === 'bottom' ? y - (lines.length - 1) * lineHeight : y;
	return lines.map((line, index) => ({ text: line, y: startY + index * lineHeight }));
}

/** SVG `dominant-baseline` for each of the three anchor modes. */
const DOMINANT_BASELINE = {
	top: 'hanging',
	middle: 'central',
	bottom: 'auto',
} as const;

/**
 * Resolve where and how one fallback-layout node's label is drawn.
 *
 * Circle nodes may park their label away from the centre (`textX` / `textY`
 * with a `textAnchor` and `textBaseline`): target leader captions sit to the
 * right of the ring, timeline captions alternate above and below the axis.
 * Rect and polygon nodes always centre on their own `textX` / `textY`.
 *
 * @param node - A node from `computeSmartArtLayout`.
 * @returns The label descriptor; `visible` is `false` for a text-free node.
 */
export function smartArtNodeLabel(node: RenderedNode): SmartArtNodeLabel {
	const placement =
		node.kind === 'circle'
			? {
					x: node.textX ?? node.cx,
					y: node.textY ?? node.cy,
					textAnchor: node.textAnchor ?? ('middle' as const),
					baseline: node.textBaseline ?? ('middle' as const),
				}
			: {
					x: node.textX,
					y: node.textY,
					textAnchor: 'middle' as const,
					baseline: 'middle' as const,
				};

	return {
		visible: node.text.length > 0,
		x: placement.x,
		textAnchor: placement.textAnchor,
		dominantBaseline: DOMINANT_BASELINE[placement.baseline],
		lines: labelLines(node.text, node.fontSize, placement.y, placement.baseline),
		fill: node.fontColor ?? SMARTART_LABEL_COLOR,
		fontSize: node.fontSize,
		fontWeight: node.fontWeight,
		fontStyle: node.fontStyle,
	};
}
