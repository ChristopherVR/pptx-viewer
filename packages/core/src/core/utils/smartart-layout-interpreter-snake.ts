/**
 * SmartArt DiagramML interpreter - `snake` arranger.
 *
 * Split out of `smartart-layout-interpreter-linear.ts` (which was pushing past
 * the repo's per-file line budget): `snake` wraps the data-model points into a
 * boustrophedon grid, honouring `grDir`/`flowDir`/`contDir`/`bkpt`/`off`. Pure
 * geometry; no framework code. `arrangeLinear` (the `lin` algorithm) stays in
 * the split-from file; both are re-exported from there so no caller's import
 * path changes.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import { resolveRatioConstraint } from './smartart-constraint-ratio-fallback';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX, roleOf } from './smartart-constraint-solver';
import { foldedDescendantTexts } from './smartart-interpreter-drawing-bridge';
import { INSET } from './smartart-layout-interpreter-linear-shared';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { algorithmParam, itemNode } from './smartart-layout-interpreter-model';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import { resolveItemSelfAspect } from './smartart-layout-item-font-size';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';
import { findCompositeItemShape, roundRectCornerInsetPx } from './smartart-layout-shape-preset';
import type { SnakeFlowDir, SnakeGridDims, SnakeGrowDir } from './smartart-layout-snake-grid';
import { snakeCell, snakeGridDims } from './smartart-layout-snake-grid';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/** Execute the `snake` algorithm: a grid honouring `grDir`/`flowDir`/`contDir`/`bkpt`. */
export function arrangeSnake(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
	childrenOf?: Map<string, PptxSmartArtNode[]>,
	fontName?: string,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	const n = nodes.length;
	const sib = resolveRatioConstraint(
		plan.node.constraints,
		index,
		roleOf(plan.node),
		['sibSp', 'sp'],
		0.15,
	);
	const flowDir: SnakeFlowDir = algorithmParam(plan.node, 'flowDir') === 'col' ? 'col' : 'row';
	const grDirRaw = algorithmParam(plan.node, 'grDir');
	const grDir: SnakeGrowDir =
		grDirRaw === 'tR' || grDirRaw === 'bL' || grDirRaw === 'bR' ? grDirRaw : 'tL';
	// `contDir` defaults to the pre-existing boustrophedon behaviour (alternate
	// lines reverse) when absent, so an unauthored diagram renders exactly as
	// before; only an explicit `sameDir` disables the reversal.
	const sameDir = algorithmParam(plan.node, 'contDir') === 'sameDir';
	const { cols, rows } = snakeGridDims(plan, n, w, h, flowDir);
	const usableW = w - INSET * 2;
	const usableH = h - INSET * 2;
	// The between-cell gap is ONE absolute pixel amount shared by both grid
	// axes, not a separate fraction of each axis's own cell size. Measured
	// against `basic-block-list--hier5.pptx` (smartart-gallery-ground-truth.test.ts):
	// its cached row gap (41px, between y=120+246=366 and y=407) exactly equals
	// its cached column gap (41px, between x=53+413=466 and x=507) even though
	// the cell height (246px) and width (413px) differ - `sib`'s reference
	// chain (`sp` -> `sibTrans.w` -> `fact * node.w`) resolves it as a fraction
	// of the FLOW axis's own cell extent (the axis `flowDir` fills first: `w`
	// for `row`, `h` for `col`); that single absolute gap is then reused,
	// unscaled, for the perpendicular axis. Solving `gap = sib * cellMain` and
	// `cellMain = (usableMain - (mainCount-1) * gap) / mainCount`
	// simultaneously for `gap` gives the closed form below; the OLD per-axis
	// `sib * cellH` formula instead re-derived a SECOND, smaller gap from the
	// cross axis's own cell size, overshooting `cellH` by ~1.5% of the frame
	// on that fixture (254px interpreted vs 246px cached).
	const mainCount = flowDir === 'col' ? rows : cols;
	const usableMain = flowDir === 'col' ? usableH : usableW;
	const gap = (sib * usableMain) / (mainCount + sib * (mainCount - 1));
	const cellW = (usableW - Math.max(0, cols - 1) * gap) / cols;
	const cellH = (usableH - Math.max(0, rows - 1) * gap) / rows;
	const gapX = gap;
	const gapY = gap;
	// Font-fit's WIDTH axis is solved against a per-axis-independent estimate
	// rather than the real (shared-gap) display cell width - algebraically
	// identical to it when `flowDir` is the main axis (both reduce to
	// `usableMain/(mainCount + (mainCount-1)*sib)`), so this is a no-op for
	// the common case and only matters when `flowDir` is `col`. The HEIGHT
	// axis uses the real display `cellH` directly (see below), NOT this same
	// independent-estimate treatment: that was tried (an inflated ~254px
	// cross-axis guess, matching the OLD single-tier uniform font model this
	// arranger used before `smartart-layout-item-font-tier.ts`'s two-tier
	// fold-aware fit) and, once the two-tier model's own per-level paragraph
	// spacing and demoted descendant size are accounted for, it systematically
	// overshoots the shared font size past the cached value - measured against
	// `basic-block-list--hier5.pptx` (only exact against the true 246px
	// `cellH`, not the inflated ~254px estimate).
	const cellWForFont = usableW / (cols + Math.max(0, cols - 1) * sib);
	const itemTemplate = itemNode(plan.node);
	const itemShape = findCompositeItemShape(itemTemplate);
	const dims: SnakeGridDims = { cols, rows };

	// Every cell shares ONE font size; see `smartart-layout-item-font-size.ts`.
	// Capped by the item template's own self-scoped aspect when it declares
	// one - see `resolveItemSelfAspect`'s doc comment and `arrangeLinear`'s
	// matching wiring.
	const naturalAspect = resolveItemSelfAspect(itemTemplate);
	// See `arrangeLinear`'s matching comment: a descendant added via the text
	// pane's Tab/"Add Bullet" folds into its top-level ancestor's own box, but
	// renders at its OWN, smaller, independently-shrunk size - see
	// `smartart-layout-item-font-tier.ts`'s module doc comment.
	const renderedIds = new Set(nodes.map((node) => node.id));
	const descendantTextsFor = (node: PptxSmartArtNode): readonly string[] =>
		childrenOf ? foldedDescendantTexts(node, renderedIds, childrenOf) : [];
	// See `arrangeLinear`'s matching comment: a `roundRect`-family cell's real
	// text box is inset further than its own margins alone.
	const cornerInset = roundRectCornerInsetPx(itemShape, cellWForFont, cellH);
	const { rootSizePx: fontSizeOverride, descendantSizePx } = resolveTieredItemFontSize(
		plan,
		index,
		nodes.map((node) => ({
			rootText: node.text,
			descendantTexts: descendantTextsFor(node),
			width: cellWForFont,
			height: cellH,
		})),
		fontName,
		naturalAspect,
		cornerInset,
	);

	// `dgm:param[@type=off] val="ctr"` centers an INCOMPLETE final line (fewer
	// items than the grid's full row/column count - e.g. a 3-item, 2-column
	// grid's lone third item) within the grid's own full width/height, rather
	// than leaving it flush against the growth-corner edge. Measured against
	// `basic-block-list--flat3.pptx` ("Basic Block List" declares `off="ctr"`
	// on its `diagram` root): the cached "Gamma" (the row-2 lone item) sits at
	// x=280 in an 867-wide frame, centered under the two-item row above it
	// (867/2 - itemWidth/2 = 280), not flush at the grid's own left edge (x=0).
	const cells = nodes.map((_node, i) => snakeCell(i, dims, flowDir, sameDir, grDir));
	const centerIncompleteLines = algorithmParam(plan.node, 'off') === 'ctr';
	const fullLineCount = flowDir === 'row' ? dims.cols : dims.rows;
	const lineCounts = new Map<number, number>();
	if (centerIncompleteLines) {
		for (const cell of cells) {
			const key = flowDir === 'row' ? cell.row : cell.col;
			lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
		}
	}

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const { col, row } = cells[i];
		let x = INSET + col * (cellW + gapX);
		let y = INSET + row * (cellH + gapY);
		if (centerIncompleteLines) {
			const key = flowDir === 'row' ? row : col;
			const count = lineCounts.get(key) ?? fullLineCount;
			if (count < fullLineCount) {
				const shift =
					((fullLineCount - count) * (flowDir === 'row' ? cellW + gapX : cellH + gapY)) / 2;
				if (flowDir === 'row') {
					x += shift;
				} else {
					y += shift;
				}
			}
		}
		return presetBoxNode({
			key: `${elementId}-snake-${node.id}-${i}`,
			x,
			y,
			width: cellW,
			height: cellH,
			node,
			index: i,
			total: n,
			palette,
			style,
			ctx,
			shape: itemShape,
			fallbackKind: 'rect',
			fontSizeOverride,
			descendantFontSize: descendantSizePx,
		});
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'matrix',
	};
}
