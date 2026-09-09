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
 *   `followSib`/`precedSib`/`follow`/`preced`/`root`/`none`) - needed for a
 *   `presOf`/`dgm:if` reached through a `dgm:forEach` (a node's own
 *   {@link PptxSmartArtLayoutNode.forEachOrigin}), where content is scoped
 *   to ONE specific point, not the whole diagram (`Phased Process`'s
 *   `circ1Tx`, `presOf axis="desOrSelf"`, is anchored one hop up by its
 *   `forEachOrigin`'s `axis="ch ch" st="2 1" cnt="1 1"` - "point 2's first
 *   child" - so `desOrSelf` there must resolve relative to THAT point).
 * - `context` omitted (the pre-existing default, used by every caller before
 *   this parameter existed): hop 0 is root-relative, and ONLY `ch`/`self`
 *   are decidable there (both yield the diagram's own top-level points) -
 *   every other token returns `undefined` (undecidable), exactly as before.
 *   This is deliberately NOT generalised the way the `context`-supplied path
 *   is: the diagram's own document root is not itself a member of `nodes`
 *   in this codebase's data model, so a bare, un-anchored `des`/`desOrSelf`/
 *   `root`/... has no single correct reading, and guessing one (this was
 *   tried and reverted - see git history) silently changed `dgm:if/
 *   func="cnt"` guard decisions gallery-wide, regressing `basic-venn` and 17
 *   other fixtures at once by resolving a `desOrSelf`-anchored content slot
 *   that was supposed to stay undecided (and fall through to a DIFFERENT,
 *   correct resolution path) into a wrong, over-eager "every node in the
 *   diagram" answer instead. A caller that legitimately needs a scoped
 *   answer for one of these tokens must supply `context` explicitly.
 *
 * Returns `undefined` (undecidable) when `axis` is empty, or (with no
 * `context`) hop 0 is neither `ch` nor `self`; a recognised-but-empty hop (a
 * leaf's `ch`, or an anchored `desOrSelf` set that resolved to nothing) is a
 * real empty array, not undecidable. Exported (not just `resolveAxisCount`'s
 * own count) for `smartart-layout-interpreter-composite-choose.ts` and
 * `smartart-layout-interpreter-composite-foreach.ts`'s content resolution,
 * which need the actual resolved NODES, not just how many.
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
	if (context === undefined && axis[0] !== 'ch' && axis[0] !== 'self') {
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
	let current =
		context !== undefined
			? navigateAxisHop(context, axis[0], nodes, childrenOf, parentOf, roots)
			: roots;
	for (let hop = 0; hop < axis.length; hop += 1) {
		if (hop > 0) {
			current = navigateAxisHop(current, axis[hop], nodes, childrenOf, parentOf, roots);
		}
		const pointType = pointTypes?.[hop];
		if (pointType) {
			current = current.filter((n) => pointTypeMatches(n, pointType));
		}
		current = selectRange(current, start?.[hop], count?.[hop]);
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
