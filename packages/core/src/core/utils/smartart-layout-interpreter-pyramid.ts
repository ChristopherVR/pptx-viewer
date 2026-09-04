/**
 * SmartArt DiagramML interpreter - pyramid (`pyra`) arranger.
 *
 * Stacks the data-model points as horizontal trapezoid bands forming a
 * triangle. Honours the `sibSp` gap constraint between bands. When
 * `pyraAcctPos` (`dgm:param[@type=pyraAcctPos]`, `bef`/`aft`) is present -
 * PowerPoint's "Pyramid List" gallery variant - each band's text moves out of
 * the (often too-narrow) trapezoid into a dedicated accent box beside it,
 * matching real PowerPoint behaviour: the trapezoid becomes a plain colour
 * band and the accent box carries the legible text, inset by `pyraAcctTxMar`.
 * Pure geometry; no framework code.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import {
	EMPTY_CONSTRAINT_INDEX,
	resolveRatioConstraint,
	roleOf,
} from './smartart-constraint-solver';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { algorithmParam } from './smartart-layout-interpreter-model';
import { polygonNode, rectNode, styleContext } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

const INSET = 8;
/** Fraction of the box width reserved for the accent-box column when `pyraAcctPos` is set. */
const ACCENT_RATIO = 0.42;
/** Gap, in px, between a band and its accent box. */
const ACCENT_GAP = 6;

/** Horizontal band region and, when accented, the accent-box column beside it. */
interface PyramidColumns {
	bandX: number;
	bandW: number;
	acctX?: number;
	acctW?: number;
}

/** Split the usable width into a band region and, when `acctPos` is set, an accent column. */
function pyramidColumns(
	usableX: number,
	maxW: number,
	acctPos: string | undefined,
): PyramidColumns {
	if (acctPos !== 'bef' && acctPos !== 'aft') {
		return { bandX: usableX, bandW: maxW };
	}
	const acctW = maxW * ACCENT_RATIO - ACCENT_GAP;
	const bandW = maxW - acctW - ACCENT_GAP;
	if (acctPos === 'bef') {
		// Accent box reads BEFORE the band (to its left).
		return { bandX: usableX + acctW + ACCENT_GAP, bandW, acctX: usableX, acctW };
	}
	// 'aft': accent box reads AFTER the band (to its right).
	return { bandX: usableX, bandW, acctX: usableX + bandW + ACCENT_GAP, acctW };
}

/** Execute the `pyra` algorithm: stacked trapezoid bands (apex at top). */
export function arrangePyramid(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	const n = nodes.length;
	const maxW = w - INSET * 2;
	const acctPos = algorithmParam(plan.node, 'pyraAcctPos');
	const acctTxMar = resolveRatioConstraint(
		plan.node.constraints,
		index,
		roleOf(plan.node),
		['pyraAcctTxMar'],
		0.08,
	);
	const { bandX, bandW, acctX, acctW } = pyramidColumns(INSET, maxW, acctPos);
	const bandCx = bandX + bandW / 2;
	const gapRatio = resolveRatioConstraint(
		plan.node.constraints,
		index,
		roleOf(plan.node),
		['sibSp', 'sp'],
		0.06,
	);
	const usableH = h - INSET * 2;
	const bandH = n > 0 ? usableH / (n + Math.max(0, n - 1) * gapRatio) : usableH;
	const gap = gapRatio * bandH;

	const renderedNodes: RenderedNode[] = nodes.flatMap((node, i) => {
		const yTop = INSET + i * (bandH + gap);
		const yBot = yTop + bandH;
		const fTop = i / n;
		const fBot = (i + 1) / n;
		const halfTop = (bandW * fTop) / 2;
		const halfBot = (bandW * fBot) / 2;
		const points = [
			`${bandCx - halfTop},${yTop}`,
			`${bandCx + halfTop},${yTop}`,
			`${bandCx + halfBot},${yBot}`,
			`${bandCx - halfBot},${yBot}`,
		].join(' ');
		const band = polygonNode({
			key: `${elementId}-pyra-${node.id}-${i}`,
			points,
			textX: bandCx,
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
		if (acctX === undefined || acctW === undefined) {
			return [band];
		}
		// Real "Pyramid List" bands carry no text of their own once accented -
		// the accent box is the sole text carrier for this data point, so the
		// band becomes decorative (`nodeId: undefined` keeps the decompose
		// bridge from projecting the node's text onto it too, avoiding a
		// duplicate-text regression).
		const decorativeBand: RenderedNode = { ...band, nodeId: undefined, text: '' };
		const marX = acctW * acctTxMar;
		const marY = bandH * acctTxMar;
		const accent = rectNode({
			key: `${elementId}-pyra-acct-${node.id}-${i}`,
			x: acctX + marX,
			y: yTop + marY,
			width: Math.max(1, acctW - marX * 2),
			height: Math.max(1, bandH - marY * 2),
			node,
			index: i,
			total: n,
			palette,
			style,
			ctx,
		});
		// The accent box is a text callout, not another colour swatch: it reads
		// against the slide background, not the band's cycled fill.
		return [decorativeBand, { ...accent, fill: 'none', stroke: 'none' }];
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'pyramid',
	};
}
