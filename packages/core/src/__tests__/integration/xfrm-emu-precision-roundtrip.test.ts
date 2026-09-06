/**
 * Closes the "Element coordinates: rounded to whole pixels" limitation
 * (`docs/guide/limitations.md`).
 *
 * Positions/sizes are converted from EMU to CSS pixels on load
 * (`Math.round(emu / EMU_PER_PX)`), and the model only carries the rounded
 * pixel value forward. Re-deriving EMU from that pixel value on save
 * (`Math.round(px * EMU_PER_PX)`) re-quantizes any EMU that was not already
 * an exact multiple of 9525, drifting `a:off`/`a:ext` by up to +/-4762 EMU
 * on a slide that was re-serialized for ANY reason (one edited element on
 * the slide forces the whole slide's XML to be rebuilt, per
 * `unmodified-slide-passthrough.test.ts`'s fast-path rules) even though
 * nothing touched that particular shape/connector/picture/group.
 *
 * `PptxElementBase.xEmu`/`yEmu`/`widthEmu`/`heightEmu` now carry the exact
 * source EMU alongside the pixel value, and `resolveXfrmEmu`
 * (`xfrm-emu-resolution.ts`) re-emits it verbatim whenever the element still
 * reports the same pixel value it was parsed with. This test proves the
 * byte-identical write-back for every TOP-LEVEL element family that carries
 * its own `a:xfrm` (shape, connector, picture, graphic frame, and a group's
 * OWN bounding box), using real-world fixtures whose authored EMU is NOT a
 * multiple of 9525, and proves the opposite for a moved element: it must
 * re-quantize from its new pixel value, not carry the stale source EMU
 * forward.
 *
 * An element NESTED inside a `p:grpSp` (a group child, or a nested group's
 * own box) is now ALSO covered, whether or not the group is unmodified: see
 * `group-xfrm-preservation.ts`'s `hasCapturedChildSpace`, which lets
 * `buildGroupTransformXml` ALWAYS re-emit a group's original `a:chOff`/
 * `a:chExt` once captured (that space is a fixed authoring choice, not a
 * derived value, so an edit anywhere in the subtree never invalidates it).
 * `applyGroupChildTransform`/`PptxElementTransformUpdater` re-emit each
 * child's original `a:off`/`a:ext` verbatim when unchanged, or (via
 * `invertChildIntoGroupSpace`) the inverse of the parse-time mapping applied
 * to a moved/resized child's CURRENT geometry - never the normalized `chOff
 * 0,0` / `chExt == ext` space, unless the group has no captured child space
 * at all (an editor-created group). The dedicated group/child coverage lives
 * in the `nested/scaled groups` tests further down; the `DECKS` table above
 * only exercises TOP-LEVEL (non-grouped) elements.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { resolveGroupTightRewrap } from '../../core/core/runtime/group-tight-rewrap';
import { invertChildIntoGroupSpace } from '../../core/core/runtime/group-xfrm-preservation';
import type { GroupPptxElement } from '../../core/types';
import { resolveRotatedResizeOffset } from '../../core/utils/rotated-resize-anchor';
import { PptxHandler } from '../../index';
import { requireFixture } from '../require-fixture';

const FIXTURES = path.resolve(__dirname, '../../../../../e2e/fixtures');

const readFixture = (file: string): ArrayBuffer => {
	const buffer = readFileSync(requireFixture(path.join(FIXTURES, file)));
	return buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	) as ArrayBuffer;
};

interface OffExt {
	x: number;
	y: number;
	cx: number;
	cy: number;
}

/**
 * Every `<a:off .../><a:ext .../>` pair in a slide part, in document order,
 * with attributes read independent of their order/quoting. Deliberately does
 * NOT match `a:chOff`/`a:chExt` (a group's child-space nodes, which this fix
 * does not touch -- see `save-group-shape-xml.ts`'s module doc).
 */
function extractOffExtSequence(xml: string): OffExt[] {
	const results: OffExt[] = [];
	// Matches both the self-closing (`<a:off x="1" y="2"/>`) and expanded
	// (`<a:off x="1" y="2"></a:off>`) empty-element forms different XML
	// builders/versions of this codebase have produced.
	const re = /<a:off([^>]*)>(?:\s*<\/a:off>)?\s*<a:ext([^>]*)>/gu;
	let match: RegExpExecArray | null;
	while ((match = re.exec(xml))) {
		const [, offAttrs, extAttrs] = match;
		const x = Number(/(?:^|\s)x="(-?\d+)"/u.exec(offAttrs)?.[1]);
		const y = Number(/(?:^|\s)y="(-?\d+)"/u.exec(offAttrs)?.[1]);
		const cx = Number(/(?:^|\s)cx="(-?\d+)"/u.exec(extAttrs)?.[1]);
		const cy = Number(/(?:^|\s)cy="(-?\d+)"/u.exec(extAttrs)?.[1]);
		results.push({ x, y, cx, cy });
	}
	return results;
}

async function slideXml(bytes: ArrayBuffer | Uint8Array, slideName: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file(slideName)?.async('string');
	if (xml === undefined) {
		throw new Error(`Missing ${slideName} in package`);
	}
	return xml;
}

/**
 * Decks committed to `e2e/fixtures/`, each verified (by direct XML
 * inspection) to carry at least one TOP-LEVEL `a:off`/`a:ext` value that is
 * NOT an exact multiple of `EMU_PER_PX` (9525), across a different element
 * family:
 *   - connector-arrows.pptx:    a `p:sp` and two `p:cxnSp` connectors.
 *   - roundrect-crop.pptx:      a `p:pic` picture.
 *   - chart-data-fidelity.pptx: a `p:graphicFrame` (chart).
 *
 * Excludes any element nested inside a `p:grpSp`: that case is covered
 * separately by the `nested/scaled groups` tests further down, which also
 * exercise a non-trivial `a:chOff`/`a:chExt` (see
 * `group-xfrm-preservation.ts`) rather than the simple top-level case this
 * table targets.
 */
const DECKS: ReadonlyArray<{ file: string; slide: string }> = [
	{ file: 'connector-arrows.pptx', slide: 'ppt/slides/slide1.xml' },
	{ file: 'roundrect-crop.pptx', slide: 'ppt/slides/slide1.xml' },
	{ file: 'chart-data-fidelity.pptx', slide: 'ppt/slides/slide1.xml' },
];

/**
 * The `a:off`/`a:ext` immediately following a `<p:cNvPr .../>` carrying the
 * given `@name`, read independent of attribute order/quoting. Reliable for a
 * group's OWN transform specifically because `p:grpSpPr`'s `a:xfrm` is the
 * very next structural node after `p:nvGrpSpPr` (which is where `p:cNvPr`
 * lives): nothing else with an `a:off` can appear in between.
 */
function extractOffExtAfterName(xml: string, name: string): OffExt | undefined {
	const marker = `name="${name}"`;
	const at = xml.indexOf(marker);
	if (at === -1) {
		return undefined;
	}
	return extractOffExtSequence(xml.slice(at))[0];
}

describe('sub-pixel EMU survives a full slide re-serialization untouched', () => {
	it.each(DECKS)(
		'$file: forced full re-save re-emits byte-identical a:off/a:ext',
		async ({ file, slide }) => {
			const source = readFixture(file);
			const sourceXml = await slideXml(source, slide);
			const before = extractOffExtSequence(sourceXml);
			// Every fixture above is chosen specifically because it authors at
			// least one sub-pixel EMU value; a fixture that stopped doing so
			// (e.g. resaved by an authoring tool) would make this test vacuous.
			expect(before.some((v) => v.x % 9525 !== 0 || v.y % 9525 !== 0)).toBeTruthy();
			expect(before.length).toBeGreaterThan(0);

			const handler = new PptxHandler();
			const data = await handler.load(source.slice(0));
			// Force a full re-serialization of every slide with NO model edits,
			// exactly the scenario `unmodified-slide-passthrough.test.ts` proves
			// is otherwise skipped entirely (which would make this test pass
			// trivially without exercising the fix at all).
			const forced = data.slides.map((s) => ({ ...s, isDirty: true }));
			const saved = await handler.save(forced);

			const after = extractOffExtSequence(await slideXml(saved, slide));
			expect(after).toStrictEqual(before);
		},
	);

	it('a moved element re-quantizes from its new pixel value instead of the stale source EMU', async () => {
		const source = readFixture('connector-arrows.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const slide = data.slides[0]!;
		const target = slide.elements[0]!;
		// The fixture's first element is a `p:sp` at sub-pixel x=508000 EMU
		// (53.3px), captured on `target.xEmu` by the parser.
		expect(target.xEmu).toBe(508000);

		const movedX = target.x + 40;
		const edited = {
			...slide,
			isDirty: true,
			elements: slide.elements.map((el, index) => (index === 0 ? { ...el, x: movedX } : el)),
		};
		const saved = await handler.save([edited]);
		const [after] = extractOffExtSequence(await slideXml(saved, slide.id));

		expect(after.x).toBe(Math.round(movedX * 9525));
		expect(after.x).not.toBe(508000);
	});

	it('a TOP-LEVEL group re-emits its own byte-identical sub-pixel a:off/a:ext', async () => {
		// linked-textbox.pptx's "GroupB" and "GroupD" are both direct `p:spTree`
		// children (not nested inside another group), each with sub-pixel EMU
		// (400000 / 9525 = 42.006...). "GroupC-outer" is not asserted here (its
		// own box is unremarkable); its NESTED child "GroupC-inner" is covered
		// by the `nested/scaled groups` tests below instead, which also cover
		// GroupC-outer's own a:off/a:ext as the parent of that nested group.
		const source = readFixture('linked-textbox.pptx');
		const sourceXml = await slideXml(source, 'ppt/slides/slide1.xml');
		const beforeB = extractOffExtAfterName(sourceXml, 'GroupB');
		const beforeD = extractOffExtAfterName(sourceXml, 'GroupD');
		expect(beforeB).toStrictEqual({ x: 400000, y: 1200000, cx: 4200000, cy: 600000 });
		expect(beforeD).toStrictEqual({ x: 400000, y: 3000000, cx: 1000000, cy: 300000 });

		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const forced = data.slides.map((s) => ({ ...s, isDirty: true }));
		const saved = await handler.save(forced);

		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');
		expect(extractOffExtAfterName(savedXml, 'GroupB')).toStrictEqual(beforeB);
		expect(extractOffExtAfterName(savedXml, 'GroupD')).toStrictEqual(beforeD);
	});
});

/**
 * `a:chOff` != group's own `a:off` and/or `a:chExt` != `a:ext` (a genuinely
 * different, not merely "children keep slide-absolute coordinates", child
 * coordinate space) used to be unconditionally reset to `chOff 0,0` / `chExt
 * == ext` on every save, discarding both the group's original child space
 * AND every child's original `a:off`/`a:ext`, even when nothing in the
 * group's subtree had moved. When something in the subtree HAS moved,
 * PowerPoint keeps the child space's SCALE fixed but tightly re-wraps
 * `a:chOff`/`a:chExt` (and its own `a:off`/`a:ext`, mapped through that same
 * scale) around the new set of children - see `group-tight-rewrap.ts`.
 * `linked-textbox.pptx`'s "GroupD" is exactly the UNMODIFIED case: `a:chExt
 * cx="2000000" cy="600000"` is DOUBLE its own `a:ext cx="1000000"
 * cy="300000"` (a 0.5 scale), and its single child "ChainD-head" spans the
 * whole child space (`a:off`/`a:ext` identical to the group's
 * `a:chOff`/`a:chExt`). See `group-xfrm-preservation.ts`.
 *
 * A group nested inside another group ("GroupC-inner" inside "GroupC-outer")
 * used to fail the byte-identical check unconditionally regardless of
 * whether anything had moved: the naive comparison of a group's OWN
 * placement, `group.x` (relative to its immediate parent) directly against
 * `group.xEmu` (its absolute source EMU), uses two different coordinate
 * frames for any group below depth 0. The fix resolves a nested group's own
 * `a:off`/`a:ext` EMU from the ENCLOSING group's own
 * `invertChildIntoGroupSpace` call (which already inverts that parent's
 * `chOff`/scale correctly) instead of re-deriving it from the nested
 * group's own fields, and threads that resolved value down as
 * `ownEmuOverride` for `buildGroupTransformXml`'s recursive call on the
 * nested group. See `group-xfrm-preservation.ts` and
 * `save-group-transform-xml.ts`'s `GroupOwnEmuOverride`.
 */
describe('nested/scaled groups preserve their exact source child space when unmodified', () => {
	function extractChOffChExtAfterName(xml: string, name: string): OffExt | undefined {
		const marker = `name="${name}"`;
		const at = xml.indexOf(marker);
		if (at === -1) {
			return undefined;
		}
		const slice = xml.slice(at);
		const re = /<a:chOff([^>]*)>(?:\s*<\/a:chOff>)?\s*<a:chExt([^>]*)>/u;
		const match = re.exec(slice);
		if (!match) {
			return undefined;
		}
		const [, chOffAttrs, chExtAttrs] = match;
		return {
			x: Number(/(?:^|\s)x="(-?\d+)"/u.exec(chOffAttrs)?.[1]),
			y: Number(/(?:^|\s)y="(-?\d+)"/u.exec(chOffAttrs)?.[1]),
			cx: Number(/(?:^|\s)cx="(-?\d+)"/u.exec(chExtAttrs)?.[1]),
			cy: Number(/(?:^|\s)cy="(-?\d+)"/u.exec(chExtAttrs)?.[1]),
		};
	}

	it('an unmodified deck re-emits GroupB/GroupD a:chOff/a:chExt and their children a:off/a:ext byte-identical', async () => {
		// GroupB and GroupD are each a direct `p:spTree` child (single nesting
		// level). The NESTED case (a `p:grpSp` inside another `p:grpSp`, e.g.
		// "GroupC-inner") has its own dedicated test below, since it used to
		// hit a separate bug: see `group-xfrm-preservation.ts`'s
		// `canPreserveGroupChildSpace` `ownPlacementVerified` parameter.
		const source = readFixture('linked-textbox.pptx');
		const sourceXml = await slideXml(source, 'ppt/slides/slide1.xml');

		// Ground truth: GroupD's chOff/chExt genuinely differ from its own
		// off/ext (a real, non-identity child space: a 0.5 scale), and its
		// single child's own off/ext equal the chOff/chExt exactly.
		const groupDChildSpace = extractChOffChExtAfterName(sourceXml, 'GroupD');
		expect(groupDChildSpace).toStrictEqual({ x: 400000, y: 3000000, cx: 2000000, cy: 600000 });
		const groupDOwnOffExt = extractOffExtAfterName(sourceXml, 'GroupD');
		expect(groupDOwnOffExt).toStrictEqual({ x: 400000, y: 3000000, cx: 1000000, cy: 300000 });
		const chainDHeadOffExt = extractOffExtAfterName(sourceXml, 'ChainD-head');
		expect(chainDHeadOffExt).toStrictEqual(groupDChildSpace);

		// GroupB uses the trivial (but still a real coordinate SPACE) identity
		// convention: chOff == its own off, chExt == its own ext.
		const groupBChildSpace = extractChOffChExtAfterName(sourceXml, 'GroupB');
		expect(groupBChildSpace).toStrictEqual({ x: 400000, y: 1200000, cx: 4200000, cy: 600000 });
		const chainBHeadOffExt = extractOffExtAfterName(sourceXml, 'ChainB-head');
		const chainBTailOffExt = extractOffExtAfterName(sourceXml, 'ChainB-tail');

		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const forced = data.slides.map((s) => ({ ...s, isDirty: true }));
		const saved = await handler.save(forced);
		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');

		expect(extractChOffChExtAfterName(savedXml, 'GroupD')).toStrictEqual(groupDChildSpace);
		expect(extractOffExtAfterName(savedXml, 'GroupD')).toStrictEqual(groupDOwnOffExt);
		expect(extractOffExtAfterName(savedXml, 'ChainD-head')).toStrictEqual(chainDHeadOffExt);

		expect(extractChOffChExtAfterName(savedXml, 'GroupB')).toStrictEqual(groupBChildSpace);
		expect(extractOffExtAfterName(savedXml, 'ChainB-head')).toStrictEqual(chainBHeadOffExt);
		expect(extractOffExtAfterName(savedXml, 'ChainB-tail')).toStrictEqual(chainBTailOffExt);
	});

	it('an unmodified NESTED group (GroupC-inner) re-emits its own a:chOff/a:chExt and its children a:off/a:ext byte-identical', async () => {
		// GroupC-outer/GroupC-inner is a `p:grpSp` nested inside another
		// `p:grpSp` (both using the identity `chOff == off` / `chExt == ext`
		// convention). Before the fix, the byte-identical check compared
		// GroupC-inner's OWN placement naively (`group.x`, relative to
		// GroupC-outer, i.e. near zero, directly against `group.xEmu`, its
		// absolute source EMU) - two different frames - so the check failed
		// for every real deck (not merely a rounding edge case), permanently
		// defeating preservation for any group nested more than one level
		// deep. GroupC-inner's own children (ChainC-head/tail) were
		// re-quantized from pixels on every save even though nothing in the
		// subtree had moved.
		const source = readFixture('linked-textbox.pptx');
		const sourceXml = await slideXml(source, 'ppt/slides/slide1.xml');

		const groupCOuterChildSpace = extractChOffChExtAfterName(sourceXml, 'GroupC-outer');
		const groupCOuterOwnOffExt = extractOffExtAfterName(sourceXml, 'GroupC-outer');
		const groupCInnerChildSpace = extractChOffChExtAfterName(sourceXml, 'GroupC-inner');
		expect(groupCInnerChildSpace).toStrictEqual({
			x: 400000,
			y: 2100000,
			cx: 4200000,
			cy: 600000,
		});
		const groupCInnerOwnOffExt = extractOffExtAfterName(sourceXml, 'GroupC-inner');
		expect(groupCInnerOwnOffExt).toStrictEqual(groupCInnerChildSpace);
		const chainCHeadOffExt = extractOffExtAfterName(sourceXml, 'ChainC-head');
		const chainCTailOffExt = extractOffExtAfterName(sourceXml, 'ChainC-tail');
		expect(chainCHeadOffExt).toStrictEqual({ x: 400000, y: 2100000, cx: 2000000, cy: 600000 });
		expect(chainCTailOffExt).toStrictEqual({ x: 2600000, y: 2100000, cx: 2000000, cy: 600000 });

		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const forced = data.slides.map((s) => ({ ...s, isDirty: true }));
		const saved = await handler.save(forced);
		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');

		// GroupC-outer (the ENCLOSING group, itself top-level): own chOff/chExt
		// and own off/ext, unaffected by anything below it.
		expect(extractChOffChExtAfterName(savedXml, 'GroupC-outer')).toStrictEqual(
			groupCOuterChildSpace,
		);
		expect(extractOffExtAfterName(savedXml, 'GroupC-outer')).toStrictEqual(groupCOuterOwnOffExt);
		// GroupC-inner (the NESTED group): this is the residual this fix closes.
		expect(extractChOffChExtAfterName(savedXml, 'GroupC-inner')).toStrictEqual(
			groupCInnerChildSpace,
		);
		expect(extractOffExtAfterName(savedXml, 'GroupC-inner')).toStrictEqual(groupCInnerOwnOffExt);
		expect(extractOffExtAfterName(savedXml, 'ChainC-head')).toStrictEqual(chainCHeadOffExt);
		expect(extractOffExtAfterName(savedXml, 'ChainC-tail')).toStrictEqual(chainCTailOffExt);
	});

	it("moving a shape inside a nested group re-wraps that group's (and its ancestor's) chOff/chExt/off/ext around the new children, matching PowerPoint COM ground truth", async () => {
		// Ground truth (see this agent's COM scripts): opening a deck with a
		// group, moving one child with `Shape.GroupItems(i).Left += 40pt`-style
		// edit and re-saving from PowerPoint tightly re-wraps the group's OWN
		// `a:chOff`/`a:chExt` (plain min/max of the resulting children's own
		// `a:off`/`a:ext`) AND its own `a:off`/`a:ext` (mapped through the
		// group's fixed render scale), and propagates the SAME re-wrap up
		// through every enclosing ancestor whose own box therefore also moved -
		// see `group-tight-rewrap.ts`. The moved child's own `a:off`/`a:ext` is
		// still the inverse of the parse-time mapping through the group's
		// ORIGINAL (pre-rewrap) child space, and every untouched sibling keeps
		// its exact original `a:off`/`a:ext` verbatim - only the chOff/chExt
		// POINTER into that fixed coordinate system moves.
		const source = readFixture('linked-textbox.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const slide = data.slides[0]!;

		function moveChildNamed(
			elements: (typeof slide)['elements'],
			name: string,
			dx: number,
		): (typeof slide)['elements'] {
			return elements.map((el) => {
				if (el.type === 'group') {
					return { ...el, children: moveChildNamed(el.children, name, dx) };
				}
				return el.name === name ? { ...el, x: el.x + dx } : el;
			});
		}

		const sourceXml = await slideXml(source, 'ppt/slides/slide1.xml');
		const groupBChildSpaceBefore = extractChOffChExtAfterName(sourceXml, 'GroupB');
		const chainCTailOffExtBefore = extractOffExtAfterName(sourceXml, 'ChainC-tail');

		const edited = {
			...slide,
			isDirty: true,
			elements: moveChildNamed(slide.elements, 'ChainC-head', 40),
		};
		const saved = await handler.save([edited]);
		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');

		// ChainC-head moved 40 CSS px at 1:1 scale (chExt == ext here), so its
		// `a:off/@x` shifts by exactly 40 * 9525 EMU; every other axis, and its
		// sibling ChainC-tail, are untouched - this part is unaffected by the
		// re-wrap (see `group-xfrm-preservation.ts`).
		const chainCHeadX = 400000 + 40 * 9525;
		expect(extractOffExtAfterName(savedXml, 'ChainC-head')).toStrictEqual({
			x: chainCHeadX,
			y: 2100000,
			cx: 2000000,
			cy: 600000,
		});
		expect(extractOffExtAfterName(savedXml, 'ChainC-tail')).toStrictEqual(chainCTailOffExtBefore);

		// GroupC-inner tightly re-wraps: ChainC-head (now spanning
		// [781000, 2781000]) is the new leftmost edge, ChainC-tail (spanning
		// [2600000, 4600000]) is still the rightmost, so chOff.x = 781000 and
		// chExt.cx = 4600000 - 781000 = 3819000; the y axis is untouched
		// (neither child moved vertically). At this group's identity (scale 1)
		// mapping, its own a:off/a:ext equal its new chOff/chExt exactly.
		const groupCInnerNew = { x: chainCHeadX, y: 2100000, cx: 3819000, cy: 600000 };
		expect(extractChOffChExtAfterName(savedXml, 'GroupC-inner')).toStrictEqual(groupCInnerNew);
		expect(extractOffExtAfterName(savedXml, 'GroupC-inner')).toStrictEqual(groupCInnerNew);

		// GroupC-outer's ONLY child is GroupC-inner, so it re-wraps to exactly
		// GroupC-inner's new box too, propagating the change up one level.
		expect(extractChOffChExtAfterName(savedXml, 'GroupC-outer')).toStrictEqual(groupCInnerNew);
		expect(extractOffExtAfterName(savedXml, 'GroupC-outer')).toStrictEqual(groupCInnerNew);

		// A completely unrelated sibling group is unaffected.
		expect(extractChOffChExtAfterName(savedXml, 'GroupB')).toStrictEqual(groupBChildSpaceBefore);
	});

	it('moving a child inside a scaled group re-wraps chOff (keeping chExt, since only a POSITION moved) and inverts the moved child through its 0.5 scale', async () => {
		// GroupD has exactly ONE direct child (ChainD-head), spanning the whole
		// child space, so the tight bbox after the move is trivially that
		// child's own new box: chExt is UNCHANGED (the child's width/height
		// didn't change), but chOff moves with it, and so does the group's own
		// a:off (its a:ext stays put too, since chExt did).
		const source = readFixture('linked-textbox.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const slide = data.slides[0]!;

		function moveChildNamed(
			elements: (typeof slide)['elements'],
			name: string,
			dx: number,
		): (typeof slide)['elements'] {
			return elements.map((el) => {
				if (el.type === 'group') {
					return { ...el, children: moveChildNamed(el.children, name, dx) };
				}
				return el.name === name ? { ...el, x: el.x + dx } : el;
			});
		}

		const sourceXml = await slideXml(source, 'ppt/slides/slide1.xml');

		const edited = {
			...slide,
			isDirty: true,
			elements: moveChildNamed(slide.elements, 'ChainD-head', 40),
		};
		const saved = await handler.save([edited]);
		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');

		// ChainD-head moved 40 CSS px inside a group whose child space is 2x
		// (chExt/ext) its own extent, so the move inverts to 2x its EMU
		// distance; every other axis is untouched (it originally spanned the
		// whole child space) - unaffected by the re-wrap.
		const chainDHeadX = 400000 + 40 * 9525 * 2;
		expect(extractOffExtAfterName(savedXml, 'ChainD-head')).toStrictEqual({
			x: chainDHeadX,
			y: 3000000,
			cx: 2000000,
			cy: 600000,
		});

		// GroupD's chOff moves to the sole child's new x (chExt unchanged: the
		// child's own width/height never changed, only its position), and its
		// own a:off follows through the group's fixed 0.5 scale; its own
		// a:ext is untouched for the same reason chExt is.
		expect(extractChOffChExtAfterName(savedXml, 'GroupD')).toStrictEqual({
			x: chainDHeadX,
			y: 3000000,
			cx: 2000000,
			cy: 600000,
		});
		expect(extractOffExtAfterName(savedXml, 'GroupD')).toStrictEqual({
			x: 400000 + 40 * 9525,
			y: 3000000,
			cx: 1000000,
			cy: 300000,
		});

		// A completely untouched sibling group is unaffected: it still
		// re-emits its exact original a:chOff/a:chExt.
		expect(extractChOffChExtAfterName(savedXml, 'GroupB')).toStrictEqual(
			extractChOffChExtAfterName(sourceXml, 'GroupB'),
		);
	});

	it("resizing the group itself (no child touched) keeps chOff/chExt AND every child a:off/a:ext byte-identical, only rewriting the group's own a:ext (matches PowerPoint COM ground truth)", async () => {
		// Ground truth (see this agent's COM script): `Shape.Width *= 1.5` on
		// a GROUP itself, with no child touched, re-saves through PowerPoint
		// with `a:chOff`/`a:chExt` AND every child's `a:off`/`a:ext` untouched
		// byte-for-byte; only the group's OWN `a:off`/`a:ext` changes. The
		// render-time scale (ext/chExt) shifts as a side effect, which is what
		// makes the children visually scale with the resized box on reload.
		const source = readFixture('linked-textbox.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const slide = data.slides[0]!;

		const sourceXml = await slideXml(source, 'ppt/slides/slide1.xml');
		const groupBChildSpaceBefore = extractChOffChExtAfterName(sourceXml, 'GroupB');
		const chainBHeadOffExtBefore = extractOffExtAfterName(sourceXml, 'ChainB-head');
		const chainBTailOffExtBefore = extractOffExtAfterName(sourceXml, 'ChainB-tail');
		const groupDChildSpaceBefore = extractChOffChExtAfterName(sourceXml, 'GroupD');
		const groupBBefore = slide.elements.find((el) => el.type === 'group' && el.name === 'GroupB')!;
		const newWidth = groupBBefore.width + 60;

		const edited = {
			...slide,
			isDirty: true,
			elements: slide.elements.map((el) =>
				el.type === 'group' && el.name === 'GroupB' ? { ...el, width: newWidth } : el,
			),
		};
		const saved = await handler.save([edited]);
		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');

		// GroupB's own child space is UNCHANGED: a resize never touches it.
		expect(extractChOffChExtAfterName(savedXml, 'GroupB')).toStrictEqual(groupBChildSpaceBefore);
		// Every child's own a:off/a:ext is UNCHANGED too: neither child moved.
		expect(extractOffExtAfterName(savedXml, 'ChainB-head')).toStrictEqual(chainBHeadOffExtBefore);
		expect(extractOffExtAfterName(savedXml, 'ChainB-tail')).toStrictEqual(chainBTailOffExtBefore);
		// GroupB's own a:ext is the only thing that changed, re-quantized from
		// its new pixel width.
		const groupBOffExtAfter = extractOffExtAfterName(savedXml, 'GroupB');
		expect(groupBOffExtAfter?.cx).toBe(Math.round(newWidth * 9525));

		// An unrelated sibling group is unaffected.
		expect(extractChOffChExtAfterName(savedXml, 'GroupD')).toStrictEqual(groupDChildSpaceBefore);
	});

	it("resizing a ROTATED group directly (no child touched) moves the group's own a:off to keep the anchor edge on screen, matching PowerPoint COM ground truth", async () => {
		// Ground truth (see this agent's COM matrix, `rotated-resize-anchor.ts`):
		// unlike the UNROTATED case above, a rotated group's `a:off` is NOT
		// left untouched by a plain `Shape.Width` resize - rotating a box
		// around its own center means growing that box shifts the center,
		// and PowerPoint compensates `a:off` so the edge the resize held in
		// place (here: the untouched left edge, since only Width changed)
		// stays at the same on-screen position once rotated.
		const source = readFixture('linked-textbox.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const slide = data.slides[0]!;

		const sourceXml = await slideXml(source, 'ppt/slides/slide1.xml');
		const groupBChildSpaceBefore = extractChOffChExtAfterName(sourceXml, 'GroupB');
		const chainBHeadOffExtBefore = extractOffExtAfterName(sourceXml, 'ChainB-head');
		const chainBTailOffExtBefore = extractOffExtAfterName(sourceXml, 'ChainB-tail');
		const groupBBefore = slide.elements.find((el) => el.type === 'group' && el.name === 'GroupB')!;
		const newWidth = groupBBefore.width + 60;

		const edited = {
			...slide,
			isDirty: true,
			elements: slide.elements.map((el) =>
				el.type === 'group' && el.name === 'GroupB' ? { ...el, width: newWidth, rotation: 25 } : el,
			),
		};
		const saved = await handler.save([edited]);
		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');

		// Neither child, nor the group's own child space, is touched: only a
		// direct-resize edit happened, no child moved - identical to the
		// unrotated case above.
		expect(extractChOffChExtAfterName(savedXml, 'GroupB')).toStrictEqual(groupBChildSpaceBefore);
		expect(extractOffExtAfterName(savedXml, 'ChainB-head')).toStrictEqual(chainBHeadOffExtBefore);
		expect(extractOffExtAfterName(savedXml, 'ChainB-tail')).toStrictEqual(chainBTailOffExtBefore);

		// The group's own a:ext.cx re-quantizes from the new pixel width,
		// exactly as the unrotated case does.
		const groupBOffExtAfter = extractOffExtAfterName(savedXml, 'GroupB');
		const expectedExtCx = Math.round(newWidth * 9525);
		expect(groupBOffExtAfter?.cx).toBe(expectedExtCx);
		expect(groupBOffExtAfter?.cy).toBe(groupBBefore.heightEmu);

		// The group's own a:off is NOT byte-identical (unlike the unrotated
		// case): `resolveRotatedResizeOffset` compensates for the rotation,
		// computed here independently of `buildGroupTransformXml`'s own call
		// to it, from the SAME inputs a real save would feed it, so this
		// pins the WIRING (rotation/xEmu/widthEmu reaching the formula)
		// rather than re-deriving the formula itself (pinned separately, with
		// literal COM EMU, in `rotated-resize-anchor.test.ts`).
		const naiveOffXEmu = groupBBefore.xEmu!;
		const naiveOffYEmu = groupBBefore.yEmu!;
		const expected = resolveRotatedResizeOffset({
			rotationDeg: 25,
			oldOffXEmu: groupBBefore.xEmu,
			oldOffYEmu: groupBBefore.yEmu,
			oldExtWidthEmu: groupBBefore.widthEmu,
			oldExtHeightEmu: groupBBefore.heightEmu,
			newExtWidthEmu: expectedExtCx,
			newExtHeightEmu: groupBBefore.heightEmu!,
			naiveOffXEmu,
			naiveOffYEmu,
		});
		expect(expected).toBeDefined();
		expect(groupBOffExtAfter?.x).toBe(expected!.offXEmu);
		expect(groupBOffExtAfter?.y).toBe(expected!.offYEmu);
		// Sanity: the rotation genuinely moved a:off away from the naive
		// (rotation-unaware) value the unrotated sibling test above pins.
		expect(groupBOffExtAfter?.x).not.toBe(naiveOffXEmu);
	});

	it("re-wraps a ROTATED group's own box correctly when it is ALSO resized directly in the SAME save as a child move+resize (closes the 'two narrower combinations remain unverified' gap, combination 1)", async () => {
		// Ground truth (see this agent's COM matrix, s1-combined-{25,90}.pptx,
		// and `group-tight-rewrap-own-box.ts`'s module doc): a ROTATED group's
		// combined self-resize + child-edit re-wrap does NOT pivot the naive
		// translated delta around the group's ORIGINAL (pre-resize) corner -
		// the formula the UNROTATED combined case above already covers.
		// PowerPoint applies its own plain-resize anchor rule FIRST (as if
		// only the group's own resize had happened), THEN re-wraps around
		// THAT intermediate box. This test pins the WIRING (both edits -
		// the group's own resize/rotation AND the child's move+resize -
		// landing through the SAME save into `rewrapGroupOwnBox`); the
		// formula itself is pinned separately, with literal COM EMU, in
		// `group-tight-rewrap-own-box.test.ts`.
		const source = readFixture('linked-textbox.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const slide = data.slides[0]!;
		const groupBBefore = slide.elements.find(
			(el) => el.type === 'group' && el.name === 'GroupB',
		) as GroupPptxElement;
		const newWidth = groupBBefore.width + 60;
		const newHeight = groupBBefore.height + 12;

		function editGroupB(elements: (typeof slide)['elements']): (typeof slide)['elements'] {
			return elements.map((el) => {
				if (el.type !== 'group' || el.name !== 'GroupB') {
					return el;
				}
				const edited: GroupPptxElement = {
					...el,
					width: newWidth,
					height: newHeight,
					rotation: 25,
					children: el.children.map((child) =>
						child.name === 'ChainB-head'
							? { ...child, x: child.x + 10, width: child.width + 5 }
							: child,
					),
				};
				return edited;
			});
		}

		const edited = { ...slide, isDirty: true, elements: editGroupB(slide.elements) };
		const editedGroupB = edited.elements.find(
			(el) => el.type === 'group' && el.name === 'GroupB',
		) as GroupPptxElement;
		// Computed independently of the save path, from the SAME edited model,
		// so this pins wiring rather than re-deriving the formula.
		const expected = resolveGroupTightRewrap(editedGroupB, 9525);
		expect(expected).toBeDefined();

		const saved = await handler.save([edited]);
		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');

		expect(extractChOffChExtAfterName(savedXml, 'GroupB')).toStrictEqual({
			x: expected!.chOffXEmu,
			y: expected!.chOffYEmu,
			cx: expected!.chExtWidthEmu,
			cy: expected!.chExtHeightEmu,
		});
		expect(extractOffExtAfterName(savedXml, 'GroupB')).toStrictEqual({
			x: expected!.offXEmu,
			y: expected!.offYEmu,
			cx: expected!.extWidthEmu,
			cy: expected!.extHeightEmu,
		});

		// Sanity: the rotation genuinely moves the group's own a:off away from
		// where the pre-existing UNROTATED combined-resize+child-edit formula
		// (anchored on the group's ORIGINAL corner) would put it.
		const naiveOffXEmu = groupBBefore.xEmu!;
		expect(expected!.offXEmu).not.toBe(naiveOffXEmu);
	});

	it("preserves a ROTATED group child's on-screen anchor when it is resized (not moved), closing the 'two narrower combinations remain unverified' gap, combination 2", async () => {
		// Ground truth (see this agent's COM matrix, s2-childresize-{25,90}.pptx,
		// and `group-child-rotated-resize.ts`'s module doc): a group child
		// that is itself rotated needs the SAME anchor-preserving `a:off`
		// correction a top-level rotated element gets on resize
		// (`rotated-resize-anchor.ts`), computed in the child's own isotropic
		// render-relative frame before being inverted into the group's
		// (possibly anisotropic) child space. This test pins the WIRING
		// (the child's own `rotation` reaching `invertChildIntoGroupSpace` via
		// `PptxElementTransformUpdater`/`resolveGroupChildBoxEmu`); the
		// formula itself is pinned separately, with literal COM EMU, in
		// `group-child-rotated-resize.test.ts`.
		const source = readFixture('linked-textbox.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const slide = data.slides[0]!;
		const groupBBefore = slide.elements.find(
			(el) => el.type === 'group' && el.name === 'GroupB',
		) as GroupPptxElement;
		const chainBHeadBefore = groupBBefore.children.find((c) => c.name === 'ChainB-head')!;

		function editChainBHead(elements: (typeof slide)['elements']): (typeof slide)['elements'] {
			return elements.map((el) => {
				if (el.type !== 'group' || el.name !== 'GroupB') {
					return el;
				}
				const edited: GroupPptxElement = {
					...el,
					children: el.children.map((child) =>
						child.name === 'ChainB-head'
							? { ...child, rotation: 25, width: child.width + 30 }
							: child,
					),
				};
				return edited;
			});
		}

		const edited = { ...slide, isDirty: true, elements: editChainBHead(slide.elements) };
		const editedGroupB = edited.elements.find(
			(el) => el.type === 'group' && el.name === 'GroupB',
		) as GroupPptxElement;
		const editedChainBHead = editedGroupB.children.find((c) => c.name === 'ChainB-head')!;

		// Computed independently of the save path (GroupB itself untouched, so
		// its immutable EMU is still the correct `owner` for the inversion),
		// so this pins wiring rather than re-deriving the formula.
		const expectedChild = invertChildIntoGroupSpace(editedChainBHead, groupBBefore, 9525);
		expect(expectedChild).toBeDefined();
		const expectedRewrap = resolveGroupTightRewrap(editedGroupB, 9525);
		expect(expectedRewrap).toBeDefined();

		const saved = await handler.save([edited]);
		const savedXml = await slideXml(saved, 'ppt/slides/slide1.xml');

		expect(extractOffExtAfterName(savedXml, 'ChainB-head')).toStrictEqual({
			x: expectedChild!.xEmu,
			y: expectedChild!.yEmu,
			cx: expectedChild!.widthEmu,
			cy: expectedChild!.heightEmu,
		});
		expect(extractChOffChExtAfterName(savedXml, 'GroupB')).toStrictEqual({
			x: expectedRewrap!.chOffXEmu,
			y: expectedRewrap!.chOffYEmu,
			cx: expectedRewrap!.chExtWidthEmu,
			cy: expectedRewrap!.chExtHeightEmu,
		});
		expect(extractOffExtAfterName(savedXml, 'GroupB')).toStrictEqual({
			x: expectedRewrap!.offXEmu,
			y: expectedRewrap!.offYEmu,
			cx: expectedRewrap!.extWidthEmu,
			cy: expectedRewrap!.extHeightEmu,
		});

		// Sanity: the rotation genuinely moves the child's own a:off away from
		// the naive (rotation-unaware) top-left-anchored value.
		expect(expectedChild!.xEmu).not.toBe(chainBHeadBefore.xEmu);
	});
});
