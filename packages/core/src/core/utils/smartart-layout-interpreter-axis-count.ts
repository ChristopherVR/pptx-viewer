/**
 * SmartArt DiagramML interpreter - ECMA-376 21.4.7.5 compound `@axis`
 * navigation for `dgm:if/@func="cnt"`.
 *
 * Split out of `smartart-layout-interpreter-when.ts` (the file-size budget):
 * `evaluateWhen`'s `cnt` case calls {@link resolveAxisCount} here when a
 * `dgm:if` needs real tree navigation (a compound `@axis` list, or a single
 * hop with its own `@st`/`@cnt`) rather than a bare node count - see that
 * function's own doc comment for the derivation and the fixture that needed
 * it (`basic-radial--hier5.pptx`'s `axis="ch ch" ptType="node node" st="1 1"
 * cnt="1 0"` `stAng` choose).
 *
 * Pure tree navigation; no framework code.
 */

import type { PptxSmartArtNode } from '../types';
import { navigateAxisHop } from './smartart-layout-interpreter-axis-hop';

/**
 * `dgm:pt/@type` match for one hop's `@ptType` (ECMA-376 `ST_ElementType`):
 * `"node"` (the schema default, and the value every ordinary data point's
 * OWN `dgm:pt` omits) matches a point with no explicit type OR an explicit
 * `"node"`; `"all"` matches anything; any other declared type
 * (`"asst"`/`"doc"`/`"parTrans"`/`"sibTrans"`/...) must match exactly.
 */
function pointTypeMatches(node: PptxSmartArtNode, pointType: string): boolean {
	if (pointType === 'all') {
		return true;
	}
	if (pointType === 'node') {
		return node.nodeType === undefined || node.nodeType === 'node';
	}
	return node.nodeType === pointType;
}

/**
 * One `dgm:if/@st`+`@cnt` pair (ECMA-376 21.4.2.16, `CT_Iterate`): 1-based
 * `start` (schema default `1` when omitted), and `count` where `0` (the
 * schema default, also `undefined` here) means "every remaining element
 * from `start`", matching how a plain `dgm:forEach axis="ch"` with no
 * `@cnt` at all iterates every child.
 *
 * When BOTH are omitted this is a true no-op (`nodes` unchanged) - the exact
 * pre-existing shortcut this took for `start === undefined` alone. That
 * shortcut was a latent bug once a caller could supply `count` WITHOUT an
 * explicit `start` (flagged, unfixed, in an earlier round): `count` alone
 * was silently ignored entirely, returning every node instead of the first
 * `count` of them - COM-verified via `basic-venn--hier5.pptx`'s `circ1Tx`
 * (`forEachOrigin` `axis="ch" cnt="1"`, no `st`): its anchor resolved to ALL
 * THREE top-level points instead of just the first, folding `circ1Tx`'s
 * content (`presOf axis="desOrSelf"`) into `"Node Two...\nNode Three\nNode
 * Five"` - three unrelated points' worth of text - instead of the correct
 * single-point anchor. Defaulting `start` to its ECMA-376 schema value (`1`)
 * whenever `count` is meaningfully constraining fixes this generally, for
 * every caller, not just the one that exposed it.
 */
function selectRange(
	nodes: PptxSmartArtNode[],
	start: number | undefined,
	count: number | undefined,
): PptxSmartArtNode[] {
	if (start === undefined && count === undefined) {
		return nodes;
	}
	const zeroBasedStart = Math.max(0, (start ?? 1) - 1);
	const take = count !== undefined && count > 0 ? count : nodes.length - zeroBasedStart;
	return nodes.slice(zeroBasedStart, zeroBasedStart + take);
}

/** One hop's `@ptType` filter followed by its own `@st`/`@cnt` range, the pair every hop in {@link resolveAxisNodes}'s loop applies. */
function applyPointTypeAndRange(
	nodes: PptxSmartArtNode[],
	pointType: string | undefined,
	start: number | undefined,
	count: number | undefined,
): PptxSmartArtNode[] {
	const filtered = pointType ? nodes.filter((n) => pointTypeMatches(n, pointType)) : nodes;
	return selectRange(filtered, start, count);
}

/**
 * ECMA-376 21.4.7.5's compound axis navigation: `axis`/`ptType`/`st`/`cnt`
 * are PARALLEL lists, one entry per hop, applied pairwise in order -
 * `axis="ch ch" ptType="node node" st="1 1" cnt="1 0"` means "from the
 * diagram root: take child 1 (`ch`, `st=1 cnt=1`), then ALL of that point's
 * own children (`ch`, `st=1 cnt=0` = unbounded)" - general over any axis
 * list length, not a special case for exactly two `"ch"` hops (a single bare
 * `axis="ch"` with its own `st`/`cnt`, or a 3+-hop chain, go through the
 * SAME loop).
 *
 * Hop 0's starting point has TWO modes:
 *
 * - `context` supplied: hop 0 navigates from that explicit ANCHOR point set
 *   via {@link navigateAxisHop}, accepting every single-hop axis token the
 *   spec defines (`self`/`ch`/`des`/`desOrSelf`/`par`/`ancst`/`ancstOrSelf`/
 *   `followSib`/`precedSib`/`follow`/`preced`/`none`) - needed for a
 *   `presOf`/`dgm:if` reached through a `dgm:forEach` (a node's own
 *   {@link PptxSmartArtLayoutNode.forEachOrigin}), where content is scoped
 *   to ONE specific point, not the whole diagram (`Phased Process`'s
 *   `circ1Tx`, `presOf axis="desOrSelf"`, is anchored one hop up by its
 *   `forEachOrigin`'s `axis="ch ch" st="2 1" cnt="1 1"` - "point 2's first
 *   child" - so `desOrSelf` there must resolve relative to THAT point).
 *   EXCEPT `root`: an explicit `root` hop 0 always opts OUT of anchor-
 *   relative navigation and resolves exactly as the `context`-omitted case
 *   below does, `context` or not - `navigateAxisHop` has no relative
 *   reading for `root` at all (it is only ever meaningful root-relatively),
 *   and a node CAN legitimately have both its own `forEachOrigin` (for its
 *   OWN box's identity/position) and a `root`-starting presOf (for content
 *   explicitly scoped to the whole diagram, not that anchor) - `funnel--
 *   flat3.pptx`'s `item1..3`, each reached through its own single-point
 *   `forEachOrigin` (`axis="ch" st="2"/"3"/"4" cnt="1"`) but with presOf
 *   `axis="root ch desOrSelf"`.
 * - `context` omitted (the pre-existing default, used by every caller before
 *   this parameter existed): hop 0 is root-relative, and `ch`/`self`/`root`
 *   are decidable there - every other token returns `undefined`
 *   (undecidable), exactly as before. This is deliberately NOT generalised
 *   the way the `context`-supplied path is: the diagram's own document root
 *   is not itself a member of `nodes` in this codebase's data model, so a
 *   bare, un-anchored `des`/`desOrSelf`/... has no single correct reading,
 *   and guessing one (this was tried and reverted - see git history)
 *   silently changed `dgm:if/func="cnt"` guard decisions gallery-wide,
 *   regressing `basic-venn` and 17 other fixtures at once by resolving a
 *   `desOrSelf`-anchored content slot that was supposed to stay undecided
 *   (and fall through to a DIFFERENT, correct resolution path) into a wrong,
 *   over-eager "every node in the diagram" answer instead. A caller that
 *   legitimately needs a scoped answer for one of those tokens must supply
 *   `context` explicitly.
 *   - `ch`/`self` at hop 0 both yield the diagram's own top-level points
 *     (`roots`) - this codebase's data model never carries the actual
 *     document/`doc`-typed point `self` would otherwise mean, so both
 *     tokens collapse to the same "start from the top" reading.
 *   - `root` at hop 0, USED ALONE, means exactly the same thing (`roots`) -
 *     ECMA-376's `root` axis means "the topmost ancestor", and root-
 *     relatively (no anchor) that topmost ancestor IS the diagram's own
 *     document node, whose own top-level point list is `roots`.
 *   - `root` COMPOUNDED with an immediately-following `ch` (`axis="root
 *     ch..."`, the ONLY compound shape measured against real fixtures -
 *     `nested-target--hier5.pptx`'s `outerBox`/`middleBox`/`centerBox`
 *     guards, `basic-venn--hier5.pptx`'s `circ1TxSh` guard) means "the
 *     document node, then ITS children" - since the document node is not a
 *     real member of `nodes`, `ch` here is not a real tree-hop (there is
 *     nothing in `childrenOf` to hop from); it is ABSORBED into the `root`
 *     read itself, and the pair together STILL means exactly `roots` -
 *     COM-verified: `basic-venn--hier5.pptx` (3 top-level points, 2 of which
 *     have a child each) has `resolveAxisNodes(flat, ['root','ch'], ['all',
 *     'node'])` correctly returning length 3 (the top-level COUNT), not the
 *     5 a fallback `flat.length` denominator gives NOR the 2 a real
 *     "children of the top-level points" hop would give; `nested-target`'s
 *     single top-level point ("Node One", with 3 children of its own) needs
 *     the SAME `root ch` shape to read 1 (not 3), or its three concentric-
 *     ring `dgm:if`/@func="cnt"` thresholds (`>= 1`/`>= 2`/`>= 3`) cannot
 *     discriminate at all. `ch`'s own `@ptType`/`@st`/`@cnt` (the compound's
 *     SECOND hop) still applies, to the FULL `roots` list (`root`'s own hop
 *     is a true no-op: the document is always exactly one node, so its own
 *     `@st`/`@cnt` never meaningfully narrows anything real fixtures use).
 *     A `root` compounded with anything OTHER than an immediately-following
 *     `ch` (e.g. a hypothetical `axis="root des"`) is left exactly as
 *     undecidable as before this change - not measured against any fixture,
 *     and extending the same "absorb the next hop" reading to `des`/
 *     `desOrSelf` is the SAME "every node in the diagram" trap the reverted
 *     generalisation above hit.
 *
 * Returns `undefined` (undecidable) when `axis` is empty, or (with no
 * `context`) hop 0 is none of `ch`/`self`/`root`, or hop 0 is `root`
 * compounded with anything other than a following `ch`; a recognised-but-
 * empty hop (a leaf's `ch`, or an anchored `desOrSelf` set that resolved to
 * nothing) is a real empty array, not undecidable. Exported (not just
 * `resolveAxisCount`'s own count) for `smartart-layout-interpreter-
 * composite-choose.ts` and `smartart-layout-interpreter-composite-
 * foreach.ts`'s content resolution, which need the actual resolved NODES,
 * not just how many.
 */
export function resolveAxisNodes(
	nodes: PptxSmartArtNode[],
	axis: string[],
	pointTypes: string[] | undefined,
	start: number[] | undefined,
	count: number[] | undefined,
	context?: PptxSmartArtNode[],
): PptxSmartArtNode[] | undefined {
	if (axis.length === 0) {
		return undefined;
	}
	const rootRelative = context === undefined;
	if (rootRelative && axis[0] !== 'ch' && axis[0] !== 'self' && axis[0] !== 'root') {
		return undefined;
	}
	// An explicit `root` hop 0 ALWAYS means "ignore any anchor, start fresh
	// from the document root" - true whether or not `context` was supplied
	// (`navigateAxisHop` does not implement `root` as a context-relative hop
	// token at all, so a `context`-anchored node whose own axis happens to
	// start with `root` previously fell through to an empty result here,
	// silently - corpus-verified corpus-unique to `funnel--flat3.pptx`'s
	// `item1..3`, `D:/tmp/root-axis-scan.ts`, 3 hits total, all this one
	// fixture).
	if (axis[0] === 'root' && axis.length > 1 && axis[1] !== 'ch') {
		return undefined;
	}
	const byId = new Map(nodes.map((n) => [n.id, n] as const));
	const childrenOf = new Map<string, PptxSmartArtNode[]>();
	const parentOf = new Map<string, PptxSmartArtNode>();
	for (const node of nodes) {
		const parent = node.parentId ? byId.get(node.parentId) : undefined;
		if (parent) {
			parentOf.set(node.id, parent);
			const list = childrenOf.get(parent.id);
			if (list) {
				list.push(node);
			} else {
				childrenOf.set(parent.id, [node]);
			}
		}
	}
	const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));

	// Hop 0 (and, for a `root`+`ch` compound, hop 1 too - see the doc comment)
	// is resolved OUTSIDE the general per-hop loop below: an explicit `root`
	// hop 0 (alone or `root`+`ch`) ALWAYS absorbs the document-node hop into
	// the `roots` shortcut, applying whichever hop's OWN `@ptType`/`@st`/
	// `@cnt` is the real, meaningful one (hop 1's, when `ch` follows) - this
	// takes precedence over `context` (see the guard above: `root` opts out
	// of anchor-relative navigation regardless). Otherwise a `context`-
	// anchored hop 0 uses `navigateAxisHop` like every later hop does, and a
	// bare (non-`root`) `ch`/`self` is the pre-existing `roots` shortcut.
	let current: PptxSmartArtNode[];
	let nextHop: number;
	if (axis[0] === 'root' && axis.length > 1) {
		current = applyPointTypeAndRange(roots, pointTypes?.[1], start?.[1], count?.[1]);
		nextHop = 2;
	} else if (axis[0] === 'root') {
		current = applyPointTypeAndRange(roots, pointTypes?.[0], start?.[0], count?.[0]);
		nextHop = 1;
	} else if (context !== undefined) {
		current = applyPointTypeAndRange(
			navigateAxisHop(context, axis[0], nodes, childrenOf, parentOf, roots),
			pointTypes?.[0],
			start?.[0],
			count?.[0],
		);
		nextHop = 1;
	} else {
		current = applyPointTypeAndRange(roots, pointTypes?.[0], start?.[0], count?.[0]);
		nextHop = 1;
	}
	for (let hop = nextHop; hop < axis.length; hop += 1) {
		current = applyPointTypeAndRange(
			navigateAxisHop(current, axis[hop], nodes, childrenOf, parentOf, roots),
			pointTypes?.[hop],
			start?.[hop],
			count?.[hop],
		);
	}
	return current;
}

/**
 * `resolveAxisCount`'s own callers (`dgm:if/@func="cnt"` evaluation) only
 * need the resolved COUNT - see {@link resolveAxisNodes} for the full
 * derivation, shared verbatim.
 */
export function resolveAxisCount(
	nodes: PptxSmartArtNode[],
	axis: string[],
	pointTypes: string[] | undefined,
	start: number[] | undefined,
	count: number[] | undefined,
): number | undefined {
	return resolveAxisNodes(nodes, axis, pointTypes, start, count)?.length;
}
