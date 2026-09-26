/**
 * The drawn shape of a `conn`-algorithm node. Split out of
 * `engine-to-result.ts` for the file-size budget.
 *
 * A 2-D straight connector (ECMA-376 Part 1, 21.4.2 `conn` algorithm, `dim`
 * default `2D`, `connRout` default `stra`) is a block arrow PowerPoint caches
 * as a `rightArrow` (`adj1 60000`, `adj2 50000`) rotated to the line, e.g.
 * Basic Cycle's `sibTrans` arrows (style label `sibTrans2D1`). A `1D`
 * connector is a line and a bent / curved one has no box here, so neither
 * becomes a shape (PowerPoint rebuilds connector lines itself).
 */

import type { PptxSmartArtData } from '../../types';
import { colour } from '../smartart-layout-style-helpers';
import type { RenderedRectNode } from '../smartart-layout-types';
import type { EngineNode } from './engine-node';
import { shapeTransform } from './shape-transform';
import { engineStyleLabel } from './style-label';

/** The adjustments PowerPoint caches on a 2-D connector arrow. */
const ARROW_ADJUSTMENTS: Readonly<Record<string, number>> = { adj1: 60000, adj2: 50000 };

const PX_PER_PT = 96 / 72;

/** The preset a placed `conn` node draws as, or `undefined` when it draws no shape. */
export function connectorPreset(node: EngineNode): string | undefined {
	const type = node.shape?.type;
	if (!type || type === 'none' || node.shape?.hideGeom || !node.values.has('connDist')) {
		return undefined;
	}
	if (type !== 'conn') {
		return type;
	}
	const params = node.alg.params;
	if ((params.dim ?? '2D') !== '2D' || (params.connRout ?? 'stra') !== 'stra') {
		return undefined;
	}
	const begin = (params.begSty ?? 'noArr') === 'arr';
	const end = (params.endSty ?? 'arr') === 'arr';
	if (begin && end) {
		return 'leftRightArrow';
	}
	if (begin) {
		return 'leftArrow';
	}
	return end ? 'rightArrow' : 'rect';
}

type RoleColors = NonNullable<PptxSmartArtData['colorTransform']>['roleColors'];

/**
 * A placed 2-D connector as a rendered shape, filled from its style label's
 * own colour list (`sibTrans2D1` is a tint of the node colour) when the colour
 * transform has one. `undefined` when the connector draws no shape.
 */
export function buildConnectorNode(
	node: EngineNode,
	index: number,
	connectorIndex: number,
	palette: string[],
	roleColors: RoleColors,
): RenderedRectNode | undefined {
	const preset = connectorPreset(node);
	const transform = preset ? shapeTransform(node) : undefined;
	if (!preset || !transform || !(transform.w > 0) || !(transform.h > 0)) {
		return undefined;
	}
	const styleLabel = engineStyleLabel(node);
	const fills = styleLabel ? roleColors?.[styleLabel]?.fill : undefined;
	const fill =
		fills && fills.length > 0 ? fills[connectorIndex % fills.length] : colour(index, palette);
	const x = transform.x * PX_PER_PT;
	const y = transform.y * PX_PER_PT;
	const width = transform.w * PX_PER_PT;
	const height = transform.h * PX_PER_PT;
	return {
		kind: 'rect',
		key: `${node.name || 'engine-conn'}-${index}`,
		x,
		y,
		width,
		height,
		rx: 0,
		fill,
		stroke: 'none',
		strokeWidth: 0,
		opacity: 1,
		text: '',
		fontSize: 0,
		textX: x + width / 2,
		textY: y + height / 2,
		rotation: transform.rotation === 0 ? undefined : transform.rotation,
		presetOverride: preset,
		...(preset === 'rect' ? {} : { shapeAdjustments: { ...ARROW_ADJUSTMENTS } }),
		...(styleLabel ? { styleLabel } : {}),
	};
}
