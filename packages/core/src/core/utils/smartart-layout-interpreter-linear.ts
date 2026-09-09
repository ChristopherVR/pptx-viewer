/**
 * SmartArt DiagramML interpreter - linear (`lin`) arranger.
 *
 * `lin` lays the data-model points out in a single row or column, honouring the
 * `linDir` direction and the scalar `sibSp`/`begPad`/`endPad`/`w`/`h`
 * constraints, producing fully-styled rect view-models. Pure geometry; no
 * framework code. The `snake` algorithm (a boustrophedon grid) is a sibling
 * module, `smartart-layout-interpreter-snake.ts`, re-exported below so no
 * caller's import path changes.
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtNode, SmartArtStyle } from '../types';
import {
	firstConstraintDeclaredBy,
	resolveConstraintDeclaredBy,
} from './smartart-constraint-declared-by';
import { resolveRatioConstraint } from './smartart-constraint-ratio-fallback';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX, roleOf } from './smartart-constraint-solver';
import { foldedDescendantTexts } from './smartart-interpreter-drawing-bridge';
import { INSET } from './smartart-layout-interpreter-linear-shared';
import type { ArrangementPlan, FlowDirection } from './smartart-layout-interpreter-model';
import { itemNode } from './smartart-layout-interpreter-model';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import { primFontSzCeilingPx, resolveItemSelfAspect } from './smartart-layout-item-font-size';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';
import { findCompositeItemShape, roundRectCornerInsetPx } from './smartart-layout-shape-preset';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

export { arrangeSnake } from './smartart-layout-interpreter-snake';

/**
 * Item aspect (height / width), resolved ONLY from the ARRANGER's own
 * `constrLst` (`for="ch" forName="<item role>"` / `for="ch" ptType="<item
 * ptType>"`), via {@link resolveConstraintDeclaredBy} - see that function's
 * doc comment for the measured, genuine-content reason an item's OWN
 * self-scoped `h`/`w` (as opposed to one the arranger prescribes for it) is
 * deliberately NOT considered here.
 */
function itemAspect(plan: ArrangementPlan, index: ConstraintIndex): number | undefined {
	const item = itemNode(plan.node);
	if (!item) {
		return undefined;
	}
	const role = roleOf(item);
	const arrangerRole = roleOf(plan.node);
	const height = resolveConstraintDeclaredBy(index, role, 'h', arrangerRole);
	const width = resolveConstraintDeclaredBy(index, role, 'w', arrangerRole);
	if (typeof height === 'number' && typeof width === 'number' && height > 0 && width > 0) {
		return height / width;
	}
	return undefined;
}

/** Order the data nodes for the resolved flow direction. */
function ordered(nodes: PptxSmartArtNode[], flow: FlowDirection): PptxSmartArtNode[] {
	return flow.reverse ? [...nodes].reverse() : nodes;
}

/** A decorative between-item gap, resolved as either a fraction of the item's own main-axis extent, or a fixed pixel amount. */
type MainAxisGap = { relative: number } | { absolutePx: number };

/**
 * When the arranger declares no `sibSp`/`sp` fraction of its own, the real
 * gap between consecutive items is whatever decorative role fills that space
 * - two measured shapes, both resolved via {@link firstConstraintDeclaredBy}
 * so only an ARRANGER-declared (not the role's own self-scoped) constraint
 * counts:
 *  - "Basic Process"'s `sibTrans` connector: its own WIDTH is `refType="w"
 *    refFor="ch" refForName="node" fact="0.4"` - relative to the item's own
 *    main-axis extent, composing with the pre-existing `sib * mainExtent`
 *    formula (same shape a literal `sibSp` ratio already produces).
 *  - "Vertical Bullet List"'s `spacer`: its own HEIGHT is `refType=
 *    "primFontSz" fact="0.08"` - a FIXED amount relative to the shared font
 *    ceiling, independent of `mainExtent` entirely (the gap does not grow or
 *    shrink with how many items fit the row/column).
 * `undefined` when no such role is declared (the common case), so the
 * caller's own flat `0.25` default is unaffected.
 */
function resolveMainAxisGap(
	index: ConstraintIndex,
	role: string,
	mainAxisType: 'w' | 'h',
	ceilingPx: number,
): MainAxisGap | undefined {
	for (const gapRole of ['sibTrans', 'spacer']) {
		const raw = firstConstraintDeclaredBy(index, gapRole, mainAxisType, role);
		if (!raw || typeof raw.factor !== 'number' || raw.factor <= 0) {
			continue;
		}
		if (raw.referenceType === 'primFontSz') {
			return { absolutePx: raw.factor * ceilingPx };
		}
		if (raw.referenceType === mainAxisType) {
			return { relative: raw.factor };
		}
	}
	return undefined;
}

/** Resolved main-axis item extent plus the gap between consecutive items. */
function resolveMainAxisLayout(
	constraints: PptxSmartArtLayoutNode['constraints'],
	index: ConstraintIndex,
	role: string,
	mainAxisType: 'w' | 'h',
	ceilingPx: number,
	usableMain: number,
	begPad: number,
	endPad: number,
	n: number,
	clampRatio: (value: number) => number,
): { mainExtent: number; gap: number } {
	const explicitSib = resolveRatioConstraint(constraints, index, role, ['sibSp', 'sp'], Number.NaN);
	if (!Number.isNaN(explicitSib)) {
		const sib = clampRatio(explicitSib);
		const denom = begPad + endPad + n + Math.max(0, n - 1) * sib;
		const mainExtent = n > 0 ? usableMain / denom : usableMain;
		return { mainExtent, gap: sib * mainExtent };
	}
	const inferredGap = resolveMainAxisGap(index, role, mainAxisType, ceilingPx);
	if (inferredGap && 'absolutePx' in inferredGap) {
		// The gap is a FIXED pixel amount, independent of `mainExtent`: solve
		// `n * mainExtent + (n-1) * gapAbs + (begPad+endPad) * mainExtent =
		// usableMain` directly, rather than expressing the gap as a ratio of
		// the (not yet known) `mainExtent`.
		const gapAbs = Math.max(0, inferredGap.absolutePx);
		const denom = begPad + endPad + n;
		const mainExtent =
			n > 0 ? Math.max(0, usableMain - Math.max(0, n - 1) * gapAbs) / denom : usableMain;
		return { mainExtent, gap: gapAbs };
	}
	const sib = clampRatio(inferredGap && 'relative' in inferredGap ? inferredGap.relative : 0.25);
	const denom = begPad + endPad + n + Math.max(0, n - 1) * sib;
	const mainExtent = n > 0 ? usableMain / denom : usableMain;
	return { mainExtent, gap: sib * mainExtent };
}

/** Execute the `lin` algorithm: a single row/column honouring constraints. */
export function arrangeLinear(
	plan: ArrangementPlan,
	flow: FlowDirection,
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
	const constraints = plan.node.constraints;
	const role = roleOf(plan.node);
	// Clamped to a generous but finite ceiling: `resolveRatioConstraint`'s
	// reference-chasing can land on a constraint declaring an ABSOLUTE
	// DiagramML unit value on the same-scale reference chain (not a 0-1
	// fraction) and misread it as a ratio, multiplying `mainExtent` by an
	// enormous factor and sending every item far outside the container. No
	// genuine built-in `lin`/`snake` layout's gap/padding is anywhere near the
	// item's own size, so 3x is a safe ceiling that only catches that
	// misinterpretation without affecting any real layoutDef's own values.
	const clampRatio = (value: number): number => Math.min(Math.max(value, 0), 3);
	const begPad = clampRatio(resolveRatioConstraint(constraints, index, role, ['begPad'], 0));
	const endPad = clampRatio(resolveRatioConstraint(constraints, index, role, ['endPad'], 0));
	const aspect = itemAspect(plan, index);
	const flow2 = ordered(nodes, flow);
	const n = flow2.length;
	const horizontal = flow.orientation === 'horizontal';
	const usableMain = (horizontal ? w : h) - INSET * 2;
	const usableCross = (horizontal ? h : w) - INSET * 2;

	// The between-item gap and each item's own main-axis extent: an explicit
	// `sibSp`/`sp` ratio wins outright, else a decorative between-item role's
	// own declared size infers it (`resolveMainAxisGap`'s doc comment), else a
	// flat `0.25` guess.
	const { mainExtent, gap } = resolveMainAxisLayout(
		constraints,
		index,
		role,
		horizontal ? 'w' : 'h',
		primFontSzCeilingPx(plan, index),
		usableMain,
		begPad,
		endPad,
		n,
		clampRatio,
	);
	// When the item role declares no PER-ITEM `h`/`w` aspect (`itemAspect`
	// undefined), the item fills the full cross-axis extent. Measured against
	// `basic-process--hier5.pptx` (smartart-gallery-ground-truth.test.ts):
	// PowerPoint's own cached boxes span the FULL container height (533 of
	// 533), not a fraction of the item's own width. The unscoped
	// `<dgm:constr type="h" refType="w" fact="0.62"/>` real "Basic Process"
	// carries is scoped to the ARRANGER's own outer w/h aspect (used only when
	// the SmartArt frame itself has no explicit size), not a per-item box
	// aspect - `itemAspect` correctly declines to resolve it as one, but this
	// default previously reused that same 0.62 figure as a per-item fallback
	// anyway, shrinking every item lacking an explicit aspect to ~62% of its
	// own width instead of the real full-height box.
	const crossExtent = aspect
		? Math.min(usableCross, Math.max(12, mainExtent * aspect))
		: usableCross;
	const crossPos = INSET + (usableCross - crossExtent) / 2;
	const start = INSET + begPad * mainExtent;
	// The item template's own `dgm:shape` override (ellipse/chevron/diamond/...)
	// wins over the arranger's hardcoded rect default when present.
	const itemTemplate = itemNode(plan.node);
	const itemShape = findCompositeItemShape(itemTemplate);
	// Every item shares ONE font size (see `smartart-layout-item-font-size.ts`):
	// all boxes here are the same [mainExtent x crossExtent] regardless of
	// orientation, so one shared computation covers the whole set.
	const itemW = horizontal ? mainExtent : crossExtent;
	const itemH = horizontal ? crossExtent : mainExtent;

	// Font-fit is solved against the item template's OWN self-scoped `h`/`w`
	// aspect when it declares one (`resolveItemSelfAspect`), NOT the possibly
	// much taller `crossExtent` a no-aspect arranger fills full-height:
	// PowerPoint solves text fit against the diagram's own natural box size -
	// see `resolveItemSelfAspect`'s doc comment. When the item declares no
	// such self-scoped aspect (e.g. "Basic Block List", whose 0.6 aspect is
	// ARRANGER-declared and therefore already reflected in `crossExtent`
	// itself via `itemAspect`), this is a no-op and `itemH` is used as-is.
	const naturalAspect = resolveItemSelfAspect(itemTemplate);
	// A top-level `axis="ch"`-arranged node whose OWN descendant was added a
	// level deeper (the text pane's Tab/"Add Bullet") folds that descendant's
	// text into this SAME box (see `foldedItemText`'s doc comment): the
	// shared font size must fit that TRUE combined text, not just the node's
	// own short label, or it comes out far too generous - measured against
	// `basic-process--hier5.pptx`/`--hier8.pptx`.
	const renderedIds = new Set(flow2.map((node) => node.id));
	const descendantTextsFor = (node: PptxSmartArtNode): readonly string[] =>
		childrenOf ? foldedDescendantTexts(node, renderedIds, childrenOf) : [];
	// The item's TEXT-fit box is smaller than its own rendered `itemW`x`itemH`
	// for a `roundRect`-family shape: see `roundRectCornerInsetPx`'s doc
	// comment. The rendered box itself (`presetBoxNode` below) is untouched -
	// this is fed to the fitter as an extra inset alongside its own margins
	// (NOT pre-subtracted from `itemW`/`itemH` here: that would distort the
	// self-scoped-`naturalAspect` cap, which multiplies the item's own WIDTH
	// by its aspect ratio - shrinking width first under-shrinks the resulting
	// height by only `aspect` of the intended amount). Computed against the
	// item's own NATURAL box (the same `naturalAspect`-capped height the
	// fitter itself uses), not the raw, possibly much-taller `itemH` a
	// no-aspect arranger fills full-height with - `min(w, h)` must be the
	// shape's TRUE displayed short side, or the inset comes out based on the
	// wrong (larger) axis.
	const naturalHeightForInset =
		typeof naturalAspect === 'number' ? Math.min(itemH, itemW * naturalAspect) : itemH;
	const cornerInset = roundRectCornerInsetPx(itemShape, itemW, naturalHeightForInset);
	const { rootSizePx: fontSizeOverride, descendantSizePx } = resolveTieredItemFontSize(
		plan,
		index,
		flow2.map((node) => ({
			rootText: node.text,
			descendantTexts: descendantTextsFor(node),
			width: itemW,
			height: itemH,
		})),
		fontName,
		naturalAspect,
		cornerInset,
	);

	const renderedNodes: RenderedNode[] = flow2.map((node, i) => {
		const mainPos = start + i * (mainExtent + gap);
		return presetBoxNode({
			key: `${elementId}-lin-${node.id}-${i}`,
			x: horizontal ? mainPos : crossPos,
			y: horizontal ? crossPos : mainPos,
			width: itemW,
			height: itemH,
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
		family: 'list',
	};
}
