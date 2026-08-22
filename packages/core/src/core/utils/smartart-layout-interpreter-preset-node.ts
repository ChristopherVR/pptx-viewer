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
}

/** Build a node covering `[x,y,width,height]`, in the kind `shape` resolves to. */
export function presetBoxNode(params: PresetBoxNodeParams): RenderedNode {
	const { x, y, width, height, shape, fallbackKind, ...common } = params;
	const kind = resolvePresetRenderKind(shape, fallbackKind);

	if (kind === 'circle') {
		const r = Math.min(width, height) / 2;
		return circleNode({ ...common, cx: x + width / 2, cy: y + height / 2, r });
	}

	if (kind === 'polygon') {
		const points = presetPolygonPoints(shape?.presetGeometry, x, y, width, height);
		return polygonNode({
			...common,
			points,
			textX: x + width / 2,
			textY: y + height / 2,
			fontWidth: width * 0.9,
			fontHeight: height,
		});
	}

	const built = rectNode({ ...common, x, y, width, height });
	const rxFraction = presetCornerRadiusFraction(shape);
	return rxFraction === undefined ? built : { ...built, rx: Math.min(width, height) * rxFraction };
}
