/**
 * SmartArt DiagramML interpreter - pyramid (`pyra`) arranger.
 *
 * Stacks the data-model points as horizontal trapezoid bands forming a
 * triangle. Honours the `sibSp` gap constraint between bands. Pure geometry;
 * no framework code.
 */

import type { PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';

import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { ratioConstraint } from './smartart-layout-interpreter-model';
import { polygonNode, styleContext } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

const INSET = 8;

/** Execute the `pyra` algorithm: stacked trapezoid bands (apex at top). */
export function arrangePyramid(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	const n = nodes.length;
	const cx = w / 2;
	const maxW = w - INSET * 2;
	const gapRatio = ratioConstraint(plan.node.constraints, ['sibSp', 'sp'], 0.06);
	const usableH = h - INSET * 2;
	const bandH = n > 0 ? usableH / (n + Math.max(0, n - 1) * gapRatio) : usableH;
	const gap = gapRatio * bandH;

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const yTop = INSET + i * (bandH + gap);
		const yBot = yTop + bandH;
		const fTop = i / n;
		const fBot = (i + 1) / n;
		const halfTop = (maxW * fTop) / 2;
		const halfBot = (maxW * fBot) / 2;
		const points = [
			`${cx - halfTop},${yTop}`,
			`${cx + halfTop},${yTop}`,
			`${cx + halfBot},${yBot}`,
			`${cx - halfBot},${yBot}`,
		].join(' ');
		return polygonNode({
			key: `${elementId}-pyra-${node.id}-${i}`,
			points,
			textX: cx,
			textY: (yTop + yBot) / 2,
			fontWidth: Math.max(20, halfBot * 1.4),
			fontHeight: bandH,
			node,
			index: i,
			total: n,
			palette,
			style,
			ctx,
		});
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'pyramid',
	};
}
