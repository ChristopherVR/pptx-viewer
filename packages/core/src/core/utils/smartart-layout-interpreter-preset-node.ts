/**
 * A box-fit node builder that honours a layoutNode's own `dgm:shape`
 * override (see `smartart-layout-shape-preset.ts`), falling back to an
 * arranger's hardcoded family default when the node carries none.
 *
 * Used by the flat, box-based arrangers (`lin`/`snake` today) whose item
 * template is a single rectangle per point; wiring every arranger
 * (hierarchy/cycle/pyramid/composite) through this is future work - see
 * `smartart-layout-shape-preset.ts`'s module doc for the honest scope note.
 *
 * @module smartart-layout-interpreter-preset-node
 */

import type { PptxSmartArtLayoutNodeShape, PptxSmartArtNode, SmartArtStyle } from '../types';
import { circleNode, polygonNode, rectNode } from './smartart-layout-interpreter-render';
import type { StyleContext } from './smartart-layout-interpreter-render';
import {
	presetCornerRadiusFraction,
	presetPolygonPoints,
	resolvePresetRenderKind,
} from './smartart-layout-shape-preset';
import type { PresetRenderKind } from './smartart-layout-shape-preset';
import type { RenderedNode } from './smartart-layout-types';

export interface PresetBoxNodeParams {
	key: string;
	x: number;
	y: number;
	width: number;
	height: number;
	node: PptxSmartArtNode;
	index: number;
	total: number;
	palette: string[];
	style: SmartArtStyle;
	ctx: StyleContext;
	/** The item layoutNode's own shape override, when the arranger has one. */
	shape: PptxSmartArtLayoutNodeShape | undefined;
	/** The arranger's hardcoded default kind, used when `shape` has none. */
	fallbackKind: PresetRenderKind;
	/**
	 * A font size every item in the arranged set shares (see
	 * `smartart-layout-item-font-size.ts`), overriding the per-node char-width
	 * fit heuristic. Omit to keep that heuristic (e.g. arrangers with no
	 * uniform item template).
	 */
	fontSizeOverride?: number;
	/** See `RenderedNodeIdentity.descendantFontSize`'s doc comment. */
	descendantFontSize?: number;
	/**
	 * Opt-in: when the resolved kind is `circle` and `width !== height`, carry
	 * the true `width`/`height` through as `RenderedCircleNode.rx`/`.ry`
	 * instead of silently clamping to a circle via `r = min(width, height) /
	 * 2` (the default, pre-existing behaviour every other caller keeps
	 * unchanged). Needed by `smartart-layout-interpreter-cycle.ts`: a real
	 * `ellipse`-preset "Basic Cycle" ring node IS genuinely non-circular (its
	 * PowerPoint aspect comes from fitting an anisotropically-scaled ring into
	 * the diagram box - see that module's doc comment), and clamping it to a
	 * circle was silently discarding a correct width down to the (smaller)
	 * height. Left `false` by default so `smartart-layout-interpreter-
	 * linear.ts`/`smartart-hierarchy-shared.ts`'s existing circle-kind
	 * fixtures render byte-identically.
	 */
	preserveEllipseAspect?: boolean;
}

/**
 * Resolve the exact DrawingML preset geometry name (`a:prstGeom/@prst`) this
 * box should carry, for the save-pipeline bridge
 * (`smartart-interpreter-drawing-bridge.ts`) to emit verbatim via
 * `RenderedNodeIdentity.presetOverride`.
 *
 * `shape.presetGeometry` (the layoutNode's own `dgm:shape/@type`) wins when
 * present - it is the exact preset PowerPoint itself would cache, whatever
 * coarse `kind` it maps to (`rect` for a plain `rect`/`roundRect`/..., `circle`
 * for `ellipse`/`donut`/..., `polygon` for `chevron`/`homePlate`/...). When the
 * layoutNode carries no shape override, fall back to the family default this
 * bridge has always emitted for that coarse kind (`roundRect` for a rect,
 * `ellipse` for a circle) so unauthored layouts keep their pre-existing
 * output. A `polygon` kind is only ever reached via an explicit
 * `POLYGON_PRESETS` match in `resolvePresetRenderKind`, so `shape.
 * presetGeometry` is always defined in that branch.
 */
function resolvedPreset(
	shape: PptxSmartArtLayoutNodeShape | undefined,
	kind: PresetRenderKind,
): string {
	return shape?.presetGeometry ?? (kind === 'circle' ? 'ellipse' : 'roundRect');
}

/** Build a node covering `[x,y,width,height]`, in the kind `shape` resolves to. */
export function presetBoxNode(params: PresetBoxNodeParams): RenderedNode {
	const {
		x,
		y,
		width,
		height,
		shape,
		fallbackKind,
		fontSizeOverride,
		descendantFontSize,
		preserveEllipseAspect,
		...common
	} = params;
	const kind = resolvePresetRenderKind(shape, fallbackKind);
	const presetOverride = resolvedPreset(shape, kind);

	if (kind === 'circle') {
		const r = Math.min(width, height) / 2;
		const ellipseRadii = preserveEllipseAspect ? { rx: width / 2, ry: height / 2 } : {};
		return {
			...circleNode({
				...common,
				cx: x + width / 2,
				cy: y + height / 2,
				r,
				...ellipseRadii,
				fontSizeOverride,
				descendantFontSize,
			}),
			presetOverride,
		};
	}

	if (kind === 'polygon') {
		const points = presetPolygonPoints(shape?.presetGeometry, x, y, width, height);
		return {
			...polygonNode({
				...common,
				points,
				textX: x + width / 2,
				textY: y + height / 2,
				fontWidth: width * 0.9,
				fontHeight: height,
				fontSizeOverride,
				descendantFontSize,
			}),
			presetOverride,
		};
	}

	const built = rectNode({ ...common, x, y, width, height, fontSizeOverride, descendantFontSize });
	const rxFraction = presetCornerRadiusFraction(shape);
	return {
		...(rxFraction === undefined ? built : { ...built, rx: Math.min(width, height) * rxFraction }),
		presetOverride,
	};
}
