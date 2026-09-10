/**
 * SmartArt DiagramML interpreter - cycle ring/hub box building.
 *
 * Split out of `smartart-layout-interpreter-cycle.ts` (repo per-file line
 * budget): turns a solved `CycleRingLayout` plus the arranged data nodes
 * into the actual `RenderedNode` boxes (satellites, and the optional
 * `ctrShpMap="fNode"` hub). Pure node-building; no framework code.
 */

import type { PptxSmartArtLayoutNodeShape, PptxSmartArtNode, SmartArtStyle } from '../types';
import type { CycleFontFit } from './smartart-layout-interpreter-cycle-fontfit';
import type { CycleRingLayout } from './smartart-layout-interpreter-cycle-ring';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import type { StyleContext } from './smartart-layout-interpreter-render';
import type { RenderedNode } from './smartart-layout-types';

/** Shared per-box inputs every ring/hub box shares. */
export interface CycleBoxInputs {
	palette: string[];
	style: SmartArtStyle;
	ctx: StyleContext;
	shape: PptxSmartArtLayoutNodeShape | undefined;
	elementId: string;
	fontSizeOverride?: number;
	descendantFontSize?: number;
}

/** One box per ring satellite, at its own solved centre/size. */
export function buildCycleRingBoxes(
	ringNodes: PptxSmartArtNode[],
	ring: CycleRingLayout,
	inputs: CycleBoxInputs,
): RenderedNode[] {
	return ringNodes.map((node, i) => {
		const { x, y } = ring.centers[i];
		return presetBoxNode({
			key: `${inputs.elementId}-cycle-${node.id}-${i}`,
			x: x - ring.nodeWidth / 2,
			y: y - ring.nodeHeight / 2,
			width: ring.nodeWidth,
			height: ring.nodeHeight,
			node,
			index: i,
			total: ringNodes.length,
			palette: inputs.palette,
			style: inputs.style,
			ctx: inputs.ctx,
			shape: inputs.shape,
			fallbackKind: 'circle',
			preserveEllipseAspect: true,
			fontSizeOverride: inputs.fontSizeOverride,
			descendantFontSize: inputs.descendantFontSize,
		});
	});
}

/**
 * The centred `ctrShpMap="fNode"` hub box, sized from the ring's own
 * largest-clearing-ellipse fit. `hubFontFit` (round 36): the hub fits its OWN
 * box independently of the ring items - see `smartart-layout-interpreter-
 * cycle-fontfit.ts`'s module doc comment. Falls back to `inputs`' own ring
 * size when omitted, so an existing caller with no hub-specific fit is
 * unaffected.
 */
export function buildCycleHubBox(
	hubNode: PptxSmartArtNode,
	ring: CycleRingLayout,
	totalNodeCount: number,
	inputs: CycleBoxInputs,
	hubFontFit?: CycleFontFit,
): RenderedNode {
	const hubW = Math.max(1, ring.hubHalfWidth * 2);
	const hubH = Math.max(1, ring.hubHalfHeight * 2);
	return presetBoxNode({
		key: `${inputs.elementId}-cycle-hub-${hubNode.id}`,
		x: ring.hubCenter.x - hubW / 2,
		y: ring.hubCenter.y - hubH / 2,
		width: hubW,
		height: hubH,
		node: hubNode,
		index: 0,
		total: totalNodeCount,
		palette: inputs.palette,
		style: inputs.style,
		ctx: inputs.ctx,
		shape: inputs.shape,
		fallbackKind: 'circle',
		preserveEllipseAspect: true,
		fontSizeOverride: hubFontFit?.hubFontSizeOverride ?? inputs.fontSizeOverride,
		descendantFontSize: hubFontFit?.hubDescendantSizePx ?? inputs.descendantFontSize,
	});
}
