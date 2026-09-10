import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { resolveAxisCount, resolveAxisNodes } from './smartart-layout-interpreter-axis-count';

describe('resolveAxisNodes', () => {
	it('is undecidable (undefined) for an empty axis list', () => {
		expect(resolveAxisNodes([], [], undefined, undefined, undefined)).toBeUndefined();
	});

	it('is undecidable (undefined) with no context when hop 0 is none of ch/self/root', () => {
		const nodes: PptxSmartArtNode[] = [{ id: 'a', text: 'A' }];
		expect(resolveAxisNodes(nodes, ['des'], undefined, undefined, undefined)).toBeUndefined();
	});

	/**
	 * `nested-target--hier5.pptx`'s `outerBox`/`middleBox`/`centerBox` guards
	 * and `basic-venn--hier5.pptx`'s `circ1TxSh` guard all gate on
	 * `axis="root ch"` (`dgm:if/@func="cnt"`) - `root` at hop 0, root-
	 * relatively, means the SAME thing `ch`/`self` already mean there (the
	 * diagram's own top-level point list), whether used alone or compounded
	 * with an immediately-following `ch` - see `resolveAxisNodes`'s own doc
	 * comment for the full derivation and why `des`/`desOrSelf` are
	 * deliberately NOT given the same treatment.
	 */
	it('bare "root" resolves to the diagram\'s own top-level points, same as ch/self', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three' };
		const nodes = [one, two, three];
		const result = resolveAxisNodes(nodes, ['root'], ['node'], undefined, undefined);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'three']);
	});

	/**
	 * COM-verified via `basic-venn--hier5.pptx` (3 top-level points, 2 of
	 * which have a child of their own): `resolveAxisNodes(flat, ['root',
	 * 'ch'], ['all', 'node'])` must read as the top-level COUNT (3), never
	 * `flat.length` (5, the undecidable fallback `evaluateWhen` used before
	 * this fix) NOR a real "children of the top-level points" hop (2 - "ch"
	 * here is absorbed into the `root` read, not a second real tree-hop).
	 */
	it('"root ch" resolves to the top-level points themselves, not their children', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const child: PptxSmartArtNode = { id: 'child', text: 'Child', parentId: 'one' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three' };
		const grandchild: PptxSmartArtNode = { id: 'gc', text: 'GC', parentId: 'three' };
		const nodes = [one, child, two, three, grandchild];
		const result = resolveAxisNodes(nodes, ['root', 'ch'], ['all', 'node'], undefined, undefined);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'two', 'three']);
	});

	/**
	 * `nested-target--hier5.pptx`'s real shape: ONE top-level point ("Node
	 * One") with three children of its own. `outerBox`/`middleBox`/
	 * `centerBox` each gate on `axis="root ch" st="1 1" cnt="0 0"` with
	 * `op="gte"` thresholds of 1/2/3 - against the correct top-level count
	 * (1), only the `>= 1` guard should pass; against the old undecidable
	 * fallback (`flat.length`, 5 for this fixture: 1 root + 4 total
	 * descendants) all three incorrectly passed at once.
	 */
	it('"root ch" with st/cnt reads the top-level count, discriminating nested-target\'s three ring guards', () => {
		const nodeOne: PptxSmartArtNode = { id: 'one', text: 'Node One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three', parentId: 'one' };
		const four: PptxSmartArtNode = { id: 'four', text: 'Four', parentId: 'one' };
		const five: PptxSmartArtNode = { id: 'five', text: 'Five', parentId: 'four' };
		const nodes = [nodeOne, two, three, four, five];
		const result = resolveAxisNodes(nodes, ['root', 'ch'], ['all', 'node'], [1, 1], [0, 0]);
		expect(result?.map((n) => n.id)).toStrictEqual(['one']);
	});

	/**
	 * `root` compounded with anything OTHER than an immediately-following
	 * `ch` (no fixture measured needs this) stays exactly as undecidable as
	 * before this change - extending the same "absorb the next hop" reading
	 * to `des`/`desOrSelf` is the same "every node in the diagram" trap a
	 * fuller root-hop generalisation hit and was reverted for (see the
	 * `des` case above and `resolveAxisNodes`'s own doc comment).
	 */
	it('"root des" (root compounded with a non-ch hop) stays undecidable', () => {
		const nodes: PptxSmartArtNode[] = [{ id: 'a', text: 'A' }];
		expect(
			resolveAxisNodes(nodes, ['root', 'des'], undefined, undefined, undefined),
		).toBeUndefined();
	});

	/**
	 * `funnel--flat3.pptx`'s exact shape: `item1..3` each carry their OWN
	 * single-point `forEachOrigin` (used for the SLOT's own box identity) AND
	 * a presOf axis explicitly starting with `root` (used for the slot's
	 * TEXT content, scoped to the whole diagram - NOT the forEachOrigin
	 * anchor). Before this fix, `root` at hop 0 was only special-cased when
	 * `context` was OMITTED; with `context` supplied, `navigateAxisHop` was
	 * asked to treat `'root'` as a context-relative hop token, which it does
	 * not implement, silently returning an empty result for every such node
	 * (corpus-verified corpus-unique to this one fixture, `D:/tmp/root-
	 * axis-scan.ts`, 3 hits, all `item1..3`).
	 */
	it('an explicit "root" hop 0 ignores a supplied context (opts out of anchor-relative navigation)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const anchor: PptxSmartArtNode = { id: 'anchor', text: 'Anchor' };
		const nodes = [one, two];
		// `context` (the forEachOrigin's own resolved anchor) is a DIFFERENT
		// node entirely from `nodes` - if it were consulted at all for a
		// `root` hop, the result would differ from the root-relative case.
		const result = resolveAxisNodes(nodes, ['root'], ['node'], undefined, undefined, [anchor]);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	it('"root ch" with context still absorbs the ch hop into the root read, ignoring context', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const child: PptxSmartArtNode = { id: 'child', text: 'Child', parentId: 'one' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const anchor: PptxSmartArtNode = { id: 'anchor', text: 'Anchor' };
		const nodes = [one, child, two];
		const result = resolveAxisNodes(nodes, ['root', 'ch'], ['all', 'node'], undefined, undefined, [
			anchor,
		]);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	it('"root des" with context stays undecidable, same as without one', () => {
		const nodes: PptxSmartArtNode[] = [{ id: 'a', text: 'A' }];
		const anchor: PptxSmartArtNode = { id: 'anchor', text: 'Anchor' };
		expect(
			resolveAxisNodes(nodes, ['root', 'des'], undefined, undefined, undefined, [anchor]),
		).toBeUndefined();
	});

	it('bare "ch" resolves to the diagram\'s own top-level points', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three' };
		const nodes = [one, two, three];
		const result = resolveAxisNodes(nodes, ['ch'], ['node'], undefined, undefined);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'three']);
	});

	/**
	 * `smartart-layout-interpreter-axis-count.ts`'s `selectRange`: a
	 * `dgm:forEach`/`dgm:if` with a `@cnt` but NO explicit `@st` (ECMA-376
	 * default `st=1`) was silently returning EVERY matched node instead of
	 * just the first `@cnt` of them - COM-verified via `basic-venn--hier5
	 * .pptx`'s `circ1Tx` `forEachOrigin` (`axis="ch" cnt="1"`, no `st`): its
	 * anchor resolved to ALL THREE top-level points instead of just the
	 * first, folding three unrelated points' text into one shape.
	 */
	it('count without an explicit start defaults start to 1 (does not return every node)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three' };
		const nodes = [one, two, three];
		const result = resolveAxisNodes(nodes, ['ch'], ['node'], undefined, [1]);
		expect(result?.map((n) => n.id)).toStrictEqual(['one']);
	});

	it('neither start nor count is still a true no-op (every matched node)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const nodes = [one, two];
		const result = resolveAxisNodes(nodes, ['ch'], ['node'], undefined, undefined);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	it('an explicit start still behaves exactly as before (unaffected by the count-defaulting fix)', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Three' };
		const nodes = [one, two, three];
		const result = resolveAxisNodes(nodes, ['ch'], ['node'], [2], [1]);
		expect(result?.map((n) => n.id)).toStrictEqual(['two']);
	});

	/**
	 * `Phased Process`'s `circ1Tx`: a compound `presOf axis="desOrSelf"`
	 * anchored by its OWN `forEachOrigin` (`axis="ch ch" st="2 1" cnt="1 1"` -
	 * "point 2's first child"), resolved via the `context` parameter instead
	 * of the diagram root.
	 */
	it('an explicit context anchors hop 0 instead of the diagram root', () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'Node One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Node Two', parentId: 'one' };
		const three: PptxSmartArtNode = { id: 'three', text: 'Node Three' };
		const nodes = [one, two, three];
		// Anchored at "Node One": desOrSelf should be [one, two], never "three".
		const result = resolveAxisNodes(nodes, ['desOrSelf'], ['node'], undefined, undefined, [one]);
		expect(result?.map((n) => n.id)).toStrictEqual(['one', 'two']);
	});

	it('a context lets hop 0 accept every single-hop axis token, not just ch/self', () => {
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const b: PptxSmartArtNode = { id: 'b', text: 'B', parentId: 'a' };
		const nodes = [a, b];
		expect(
			resolveAxisNodes(nodes, ['ancst'], undefined, undefined, undefined, [b])?.map((n) => n.id),
		).toStrictEqual(['a']);
	});
});

describe('resolveAxisCount', () => {
	it("matches resolveAxisNodes's own length", () => {
		const one: PptxSmartArtNode = { id: 'one', text: 'One' };
		const two: PptxSmartArtNode = { id: 'two', text: 'Two' };
		const nodes = [one, two];
		expect(resolveAxisCount(nodes, ['ch'], ['node'], undefined, undefined)).toBe(2);
	});

	it("forwards an optional anchor context to resolveAxisNodes (round 13's maxDepth mechanism, extended to cnt)", () => {
		const a: PptxSmartArtNode = { id: 'a', text: 'A' };
		const b: PptxSmartArtNode = { id: 'b', text: 'B', parentId: 'a' };
		const c: PptxSmartArtNode = { id: 'c', text: 'C', parentId: 'a' };
		const nodes = [a, b, c];
		// Root-relative (no anchor): `ch` at hop 0 is the `roots` shortcut - `a` alone.
		expect(resolveAxisCount(nodes, ['ch'], undefined, undefined, undefined)).toBe(1);
		// Anchored on `a`: `ch` navigates to its own children, B and C.
		expect(resolveAxisCount(nodes, ['ch'], undefined, undefined, undefined, [a])).toBe(2);
	});
});
