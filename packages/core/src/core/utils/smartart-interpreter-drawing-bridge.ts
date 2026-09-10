/**
 * Bridge from the DiagramML interpreter's styled view-model geometry
 * (`SmartArtLayoutResult`) to standard `PptxElement[]` shapes, for the
 * save/decompose pipeline (`smartart-decompose.ts`).
 *
 * The interpreter's `RenderedNode` carries an on-screen-truncated label
 * (`truncate(node.text, 40)`, see `smartart-layout-style-helpers.ts`) because
 * it is built for compact SVG rendering. Baking that truncated, unstyled text
 * into a saved file would be a data-loss regression, so this bridge instead
 * joins each rendered shape back to its ORIGINAL `PptxSmartArtNode` (via
 * `RenderedNode.nodeId`) and uses its full text and per-run styling
 * (`projectSmartArtNodeText`) - the same source the OTHER decompose branches
 * already use.
 *
 * Connector geometry (`SmartArtLayoutResult.connectors`) is intentionally not
 * converted: PowerPoint reconstructs `dsp:cxn` connector shapes itself from
 * the data-model connections, matching the existing convention in
 * `smartArtElementsToDrawingShapes` (which also drops non-shape elements).
 */

import type { PptxElement, PptxSmartArtConnection, PptxSmartArtNode } from '../types';
import { nextId, makeShapeElement } from './smartart-helpers';
import { collectFoldedDescendants, projectFoldedNodeText } from './smartart-interpreter-fold-text';
import type { SmartArtLayoutResult } from './smartart-layout-types';
import { smartArtChildrenOf } from './smartart-node-tree-axis';

export {
	collectFoldedDescendants,
	foldedDescendantTexts,
	foldedItemText,
} from './smartart-interpreter-fold-text';

/** Axis-aligned bounding box of an SVG polygon `points` string. */
function polygonBoundingBox(points: string): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	const pairs = points
		.trim()
		.split(/\s+/u)
		.filter((pair) => pair.length > 0)
		.map((pair) => pair.split(',').map(Number) as [number, number]);
	const xs = pairs.map(([x]) => x);
	const ys = pairs.map(([, y]) => y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const maxX = Math.max(...xs);
	const maxY = Math.max(...ys);
	return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/**
 * Convert the interpreter's result into `PptxElement[]` shapes offset into
 * `containerBounds`, using each rendered node's original data-model node for
 * its full (untruncated, per-run-styled) text.
 *
 * @param result          - Interpreter output (`interpretSmartArtLayout`).
 * @param nodes           - The full node set the interpreter arranged from
 *                          (used to resolve each `RenderedNode.nodeId`).
 * @param containerBounds - The SmartArt graphic frame's bounds on the slide;
 *                          the interpreter's own geometry is already sized to
 *                          the frame, so only an offset is needed (no scale).
 * @param connections     - `PptxSmartArtData.connections`, when available:
 *                          orders each `smartArtChildrenOf` group by its own
 *                          `dgm:cxn` `srcOrd` rather than raw `dgm:ptLst`
 *                          declaration order (see that function's own doc
 *                          comment) - the SAME general rule the interpreter's
 *                          own live path already applies, so a fabricated
 *                          cached drawing's folded descendant text joins in
 *                          the same order. Omitted keeps the pre-existing
 *                          declaration-order behaviour.
 */
export function interpretedLayoutToElements(
	result: SmartArtLayoutResult,
	nodes: PptxSmartArtNode[],
	containerBounds: { x: number; y: number },
	bulletEnabled = false,
	connections?: PptxSmartArtConnection[],
): PptxElement[] {
	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	const childrenOf = smartArtChildrenOf(nodes, connections);
	// Every node this result gives its own box to, PLUS every id a role box
	// pre-claimed via `foldedNodeIds` (`smartart-layout-interpreter-item-
	// roles.ts`: e.g. a list layout's `childText` box, which owns its
	// descendant's text directly rather than leaving it for inference below).
	// A node in neither set (one added a level deeper via the text pane's
	// Tab/"Add Bullet", when the diagram's driving forEach is `axis="ch"`)
	// gets folded into its nearest rendered ancestor's box instead - see
	// `collectFoldedDescendants`.
	const renderedIds = new Set(
		result.nodes
			.flatMap((r) => [r.nodeId, ...(r.foldedNodeIds ?? [])])
			.filter((id): id is string => Boolean(id)),
	);
	const elements: PptxElement[] = [];

	for (const rendered of result.nodes) {
		const node = rendered.nodeId ? nodeById.get(rendered.nodeId) : undefined;
		const fontSize = rendered.fontSize;
		// Round 26: `rendered.fontSize`/`.descendantFontSize` (`RenderedNode`,
		// the interpreter's own internal unit throughout this whole module
		// family - `ceilingPx`/`itemW`/`itemH`/every font-fit call) is ALREADY
		// in PIXELS, matching `common.fontSize` below (assigned VERBATIM, no
		// conversion). A stray `* (96 / 72)` here re-applied a pt->px
		// conversion to an already-px value, INFLATING every per-segment
		// style (`textSegments[].style.fontSize`, used whenever a node folds
		// a descendant's text as extra paragraphs) by exactly that factor -
		// silent because the gate (`smartart-gallery-ground-truth.test.ts`)
		// only ever asserts the TOP-LEVEL `textStyle.fontSize` (this same
		// `fontSize` var, correctly unconverted), never a segment's own
		// style. Measured, directly: a synthetic `w`-ruled SDK diagram whose
		// live-rendered `textStyle.fontSize` is 48px also fed a `textSegments`
		// array carrying `style.fontSize: 64` (48 * 96/72) into the fabricated
		// `dsp:sp`'s cached `a:rPr/@sz` - `sz="4800"` (48pt) baked into the
		// saved file instead of the live value's own `sz="3600"` (36pt),
		// exactly the "live vs fabricated disagree" gap this round's own
		// directive named. Fixed at the source: use the SAME raw px value
		// `common.fontSize` already uses, for both the item's own text and
		// any folded descendant's (independently-shrunk) size.
		const fallbackStyle = { fontSize };
		const descendantFallbackStyle =
			rendered.descendantFontSize === undefined
				? fallbackStyle
				: { fontSize: rendered.descendantFontSize };
		// A pre-resolved role (`foldedNodeIds` set, even to an empty array by
		// the item-roles expansion) owns exactly that content; only a node
		// with NO pre-resolution falls back to inferring folded descendants
		// from what nothing else rendered.
		const folded = !node
			? []
			: rendered.foldedNodeIds !== undefined
				? rendered.foldedNodeIds
						.map((id) => nodeById.get(id))
						.filter((n): n is PptxSmartArtNode => Boolean(n))
				: collectFoldedDescendants(node, renderedIds, childrenOf);
		const projection = node
			? projectFoldedNodeText(node, folded, fallbackStyle, descendantFallbackStyle, bulletEnabled)
			: undefined;
		// `literalText` (a role bound to a transition point rather than a real
		// data node, e.g. a numbered-badge's ordinal text - see
		// `RenderedNodeIdentity.literalText`'s doc comment) wins over the
		// node-projected text; `undefined` keeps this bridge's pre-existing
		// behaviour unchanged.
		const text = rendered.literalText ?? projection?.text ?? '';
		const textSegments = projection?.segments;
		// Embed the node id (`sa-interp-<nodeId>`), matching the convention
		// `resolveShapeModelId` (smartart-fabrication-drawing.ts) already relies
		// on for the OTHER decompose branches ("Layout-engine shapes embed the
		// node id in their id"), so the fabricated `dsp:sp` still resolves the
		// right presentation-point GUID even if node order ever diverges from
		// the shape order.
		const id = rendered.nodeId ? `sa-interp-${rendered.nodeId}` : nextId('sa-interp');
		const common = {
			strokeColor: rendered.stroke,
			strokeWidth: rendered.strokeWidth,
			fontSize,
			fontColor: rendered.fontColor ?? '#FFFFFF',
			textSegments,
			rotation: rendered.rotation,
		};

		if (rendered.kind === 'rect') {
			elements.push(
				makeShapeElement(
					id,
					containerBounds.x + rendered.x,
					containerBounds.y + rendered.y,
					rendered.width,
					rendered.height,
					// `presetOverride` (set by `smartart-layout-interpreter-item-
					// roles.ts` for a role with its own declared `dgm:shape`, e.g.
					// a list layout's plain-`rect` `childText` beside its
					// `roundRect` primary) wins over the arranger's own hardcoded
					// family default.
					rendered.presetOverride ?? 'roundRect',
					rendered.fill,
					text,
					common,
				),
			);
		} else if (rendered.kind === 'circle') {
			// `rx`/`ry` (set only by a caller that opted into
			// `presetBoxNode`'s `preserveEllipseAspect`, e.g. the `cycle`
			// arranger's real non-circular ellipses) carry the true
			// width/height; every other circle-kind node leaves them unset and
			// keeps this bridge's pre-existing `r`-derived square bounding box.
			const halfWidth = rendered.rx ?? rendered.r;
			const halfHeight = rendered.ry ?? rendered.r;
			elements.push(
				makeShapeElement(
					id,
					containerBounds.x + rendered.cx - halfWidth,
					containerBounds.y + rendered.cy - halfHeight,
					halfWidth * 2,
					halfHeight * 2,
					// `presetOverride` carries the layout node's exact `dgm:shape`
					// (e.g. `donut`, `pie`, `blockArc`) when one was declared;
					// `ellipse` is this bridge's pre-existing family default,
					// matching what a plain circle-arranger (no shape override)
					// has always cached.
					rendered.presetOverride ?? 'ellipse',
					rendered.fill,
					text,
					common,
				),
			);
		} else {
			// A polygon kind is only ever reached via an explicit preset match
			// (`resolvePresetRenderKind`'s `POLYGON_PRESETS`), so `presetOverride`
			// is always populated here; `trapezoid` is kept only as a defensive
			// fallback for a `RenderedPolygonNode` built outside that path.
			const bbox = polygonBoundingBox(rendered.points);
			elements.push(
				makeShapeElement(
					id,
					containerBounds.x + bbox.x,
					containerBounds.y + bbox.y,
					bbox.width,
					bbox.height,
					rendered.presetOverride ?? 'trapezoid',
					rendered.fill,
					text,
					common,
				),
			);
		}
	}

	return elements;
}
