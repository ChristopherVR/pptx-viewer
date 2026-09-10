/**
 * SmartArt DiagramML interpreter - linear (`lin`) arranger.
 *
 * `lin` lays the data-model points out in a single row or column, honouring
 * `linDir` and the scalar `sibSp`/`begPad`/`endPad`/`w`/`h` constraints,
 * producing fully-styled rect view-models. Pure geometry; no framework code.
 * The `snake` algorithm (a boustrophedon grid) is a sibling module,
 * `smartart-layout-interpreter-snake.ts`, re-exported below so no caller's
 * import path changes.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import { resolveConstraintDeclaredBy } from './smartart-constraint-declared-by';
import { resolveRatioConstraint } from './smartart-constraint-ratio-fallback';
import {
	isDesRootedFontRole,
	isPrimFontSzRoleSplitItem,
} from './smartart-constraint-sibling-roles';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX, roleOf } from './smartart-constraint-solver';
import { foldedDescendantTexts } from './smartart-interpreter-drawing-bridge';
import {
	isMainAxisContentSized,
	resolveContentSizedExtents,
} from './smartart-layout-interpreter-linear-content-size';
import { resolveMainAxisLayout } from './smartart-layout-interpreter-linear-main-axis';
import { INSET } from './smartart-layout-interpreter-linear-shared';
import type { ArrangementPlan, FlowDirection } from './smartart-layout-interpreter-model';
import { itemNode } from './smartart-layout-interpreter-model';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import { itemFontBoundsPx } from './smartart-layout-item-font-role';
import {
	primFontSzCeilingPx,
	resolveFontTable,
	resolveItemSelfAspect,
} from './smartart-layout-item-font-size';
import { resolveTieredItemFontSize } from './smartart-layout-item-font-tier';
import { findCompositeItemShape, roundRectCornerInsetPx } from './smartart-layout-shape-preset';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';
import { SMARTART_LINE_SPACING_FACTOR } from './smartart-text-wrap-fit';

export { arrangeSnake } from './smartart-layout-interpreter-snake';

/**
 * Item aspect (height / width), resolved ONLY from the ARRANGER's own
 * `constrLst` (`for="ch" forName="<item role>"` / `ptType="<item ptType>"`),
 * via {@link resolveConstraintDeclaredBy} - the item's OWN self-scoped
 * `h`/`w` is a SEPARATE fallback the caller applies itself (`naturalAspect`
 * below), not considered here.
 *
 * Round 25: a same-axis "inherit the arranger's own dimension" declaration
 * (`<dgm:constr type="h" for="ch" forName="linNode" refType="h"/>`, no
 * cross-axis reference or literal factor of its own - "Vertical Bracket
 * List"'s `linNode`) resolves to a spurious 1:1 "aspect" via this same
 * code path (both axes bottom out at the root's own implicit `w=h=1`) and
 * squashes a genuinely WIDE item template into a narrow square. A dedicated
 * fix EXCLUDING that pattern was implemented, measured against the full
 * 227-fixture corpus, and found to REGRESS WIDELY (dozens of OTHER
 * fixtures' FONT/GEOM values moved measurably further from cached - e.g.
 * `alternating-flow--hier5.pptx` 44.0px->74.7px against a 37.3px cached
 * target, `bullet-timeline--hier5.pptx`'s `maxGeomDelta` 34%->88% - the
 * SAME degenerate 1:1 resolution this fix targeted is, empirically,
 * load-bearing for many OTHER fixtures' correct box shape, not merely
 * "coincidentally correct" for them). REVERTED - see the round-25 successor
 * doc's own section for the measured regression numbers and the
 * `smartart-layout-interpreter-linear-item-aspect.ts` file this attempt
 * added (deleted along with this revert). `vertical-bracket-list`'s own
 * squashed-box symptom is real and unfixed; whoever continues needs a
 * NARROWER trigger than "same-axis inherit resolves to 1" - possibly
 * conditioned on the item template's own nested arranger being a
 * DIFFERENT-orientation `lin` (a horizontal `linNode` inside a vertical
 * outer arranger), not a blanket exemption.
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
	// The item template's own `dgm:shape` override wins over the arranger's
	// hardcoded rect default when present.
	const itemTemplate = itemNode(plan.node);
	const itemShape = findCompositeItemShape(itemTemplate);
	// The item template's OWN self-scoped `h`/`w` aspect (`resolveItemSelfAspect`)
	// - see that function's doc comment. "Basic Block List"'s 0.6 aspect is
	// ARRANGER-declared instead, resolving via `itemAspect`/`aspect` above,
	// so this is `undefined` for it (no double application).
	const naturalAspect = resolveItemSelfAspect(itemTemplate);
	// No aspect anywhere -> fill the full cross-axis extent. A self-scoped
	// aspect with no ARRANGER aspect shapes DISPLAY geometry too (measured
	// against `vertical-process--hier5.pptx`'s real cached 180x100pt box).
	// `naturalAspect` is h/w; multiply by it when the main axis is w
	// (`horizontal`) but DIVIDE when the main axis is h (vertical) -
	// `vertical-process--hier5.pptx`'s self-scoped `w refType="h" fact="1.8"`
	// (h/w 0.5556) exposed this: the horizontal-only `mainExtent * aspect`
	// formula gave 55.5pt width against its cached 180pt for a vertical
	// arranger. Applied to `naturalAspect` ONLY, never the ARRANGER-declared
	// `aspect`: `itemAspect`'s own resolution is not always a genuine
	// geometric ratio (`vertical-bullet-list--hier5.pptx`'s `parentText` role
	// resolves `height` from `primFontSz`, giving `aspect=33.8`, garbage as a
	// ratio) - only `naturalAspect` (`resolveItemSelfAspect` restricts it to
	// literal `h refType="w"`/`w refType="h"` constructs) is trusted with the
	// division.
	const crossExtent = aspect
		? Math.min(usableCross, Math.max(12, mainExtent * aspect))
		: typeof naturalAspect === 'number'
			? Math.min(
					usableCross,
					Math.max(12, mainExtent * (horizontal ? naturalAspect : 1 / naturalAspect)),
				)
			: usableCross;
	const crossPos = INSET + (usableCross - crossExtent) / 2;
	const start = INSET + begPad * mainExtent;
	// Every item shares ONE font size (see `smartart-layout-item-font-size.ts`):
	// all boxes here are the same [mainExtent x crossExtent] regardless of
	// orientation, so one shared computation covers the whole set.
	const itemW = horizontal ? mainExtent : crossExtent;
	const itemH = horizontal ? crossExtent : mainExtent;
	// Round 24: a `val="INF"` main-axis declaration ("Vertical Box List"'s own
	// `parentLin` item template) means THIS item's own main-axis extent comes
	// from its content, not the uniform per-slot division above - see
	// `smartart-layout-interpreter-linear-content-size.ts`'s module doc
	// comment. Scoped to vertical flow only (the one fixture using this today).
	const contentSized =
		!horizontal && isMainAxisContentSized(index, role, roleOf(itemTemplate), 'h');
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
	// comment. Fed to the fitter as an extra inset alongside its own margins,
	// not pre-subtracted from `itemW`/`itemH` (would distort the font-fit's
	// own `naturalAspect` cap). `min(w, h)` is the shape's TRUE displayed
	// short side (already `naturalAspect`-capped when `itemH` came from
	// that path above, making this `Math.min` a no-op there; still correct
	// when `aspect` shaped `itemH` instead).
	const naturalHeightForInset =
		typeof naturalAspect === 'number' ? Math.min(itemH, itemW * naturalAspect) : itemH;
	const cornerInset = roundRectCornerInsetPx(itemShape, itemW, naturalHeightForInset);
	// Round 23: a role-split item's descendant is its OWN separate box - see
	// `isPrimFontSzRoleSplitItem`'s doc comment. Keyed off the DFS-resolved
	// text role `itemFontBoundsPx` fits against, not a wrapper `itemTemplate`.
	// Round 25: NOT for a `des`-rooted driving role ("Vertical Box List"'s
	// `parentText`, nested inside a `parentLin` wrapper) - see
	// `isDesRootedFontRole`'s own doc comment. Its `childText` is a genuinely
	// separate, independently content-sized box, never sharing `parentText`'s
	// height budget at all; skipping the trailing `spcAft` term here
	// measurably OVER-shoots the shared size (49pt, against a cached 30pt -
	// dragging every item in the set up with it through the shared binary
	// search, worse than the pre-existing joint fold-fit's own 40pt, which
	// this flag being off keeps unaffected). Neither value is yet exact - see
	// this construct's own remaining-gap note in the round-25 successor doc:
	// the real governing quantity (likely a margin-resolution gap for a
	// `for="des"`-rooted role) is a separate, not-yet-root-caused bug.
	const fontRole = itemFontBoundsPx(plan, index).role;
	const separateDescendantBox =
		isPrimFontSzRoleSplitItem(index, role, fontRole) && !isDesRootedFontRole(index, role, fontRole);
	// Content-sized items fit against a GENEROUS bound (the whole usable main
	// axis), never the uniform per-slot `itemH` - that slot does not exist yet
	// for this construct; the real per-item extent is derived FROM the fit
	// below instead of feeding it.
	// Content-sized items still fit against the UNIFORM `itemH` here (not a
	// generous/unbounded height): the shared font size is a SEPARATE question
	// from the per-item extent it then drives (below) - fitting against an
	// artificially generous bound let short items overshoot toward the
	// ceiling (measured: `vertical-box-list--hier5.pptx`'s leaf "Node Three"
	// moved from an exact 40pt to 65pt/ceiling when tried).
	const { rootSizePx: fontSizeOverride, descendantSizePx } = resolveTieredItemFontSize(
		plan,
		index,
		flow2.map((node) => ({
			rootText: node.text,
			descendantTexts: descendantTextsFor(node),
			width: itemW,
			height: itemH,
			separateDescendantBox,
		})),
		fontName,
		naturalAspect,
		cornerInset,
	);
	const contentExtents = contentSized
		? resolveContentSizedExtents(
				flow2.map((node) => node.text),
				itemW,
				fontSizeOverride,
				resolveFontTable(fontName),
				SMARTART_LINE_SPACING_FACTOR,
				fontRole,
				index,
				cornerInset,
				usableMain,
				gap,
			)
		: undefined;
	let cursor = start;

	const renderedNodes: RenderedNode[] = flow2.map((node, i) => {
		const itemMainExtent = contentExtents?.[i] ?? mainExtent;
		const mainPos = contentExtents ? cursor : start + i * (mainExtent + gap);
		cursor += itemMainExtent + gap;
		return presetBoxNode({
			key: `${elementId}-lin-${node.id}-${i}`,
			x: horizontal ? mainPos : crossPos,
			y: horizontal ? crossPos : mainPos,
			width: horizontal ? itemMainExtent : itemW,
			height: horizontal ? itemH : itemMainExtent,
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
