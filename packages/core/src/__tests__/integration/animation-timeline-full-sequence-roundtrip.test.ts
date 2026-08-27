/**
 * Round-trip proof that dragging an editor-authored animation ahead of a
 * deck's own (native) effect group leaves that native effect byte-identical
 * aside from its position in the saved `p:timing` sequence.
 *
 * `anatidae-animation.pptx` slide 1 is a real PowerPoint-authored deck: two
 * text boxes (`shape-2`, `shape-3`) share one native entrance click group,
 * and the editor never authored anything on this slide (`animations` is
 * empty on load). This exercises the full pipeline end to end: parsing
 * grounds `PptxAnimationTimelineAnchor.order` in the live tree
 * (`computeAnimationTimelineOrder`), the authoring model lets a NEW
 * editor-authored effect be given an `order` ahead of that anchor, and
 * `surgicallyUpdateTimingTree`/`reorderOwnedGroups` place it there on save
 * without touching the native group's own nodes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { groupTopLevelEffects } from '../../core/services/animation-timing-groups';
import type { XmlObject } from '../../core/types';
import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/anatidae-animation.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** The `p:cTn` attributes of the effects targeting `spids`, in document order, for a byte-identical comparison. */
function effectSnapshotFor(
	rawTiming: XmlObject,
	spids: ReadonlySet<string>,
): Array<Record<string, unknown>> {
	return groupTopLevelEffects(rawTiming)
		.flatMap((group) => group.effects)
		.filter((effect) => effect.spid !== undefined && spids.has(effect.spid))
		.map((effect) => ({ ...effect.cTn }));
}

describe('animation timeline full-sequence reorder (round-trip)', () => {
	it('places a new editor effect ahead of the deck-native group, leaving it byte-identical', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const slide = data.slides[0]!;

		const nativeAnchor = slide.animationTimelineAnchors?.[0];
		expect(nativeAnchor).toBeDefined();
		expect(nativeAnchor?.targetIds).toStrictEqual(
			expect.arrayContaining([
				expect.stringContaining('shape-2'),
				expect.stringContaining('shape-3'),
			]),
		);
		expect(slide.animations ?? []).toHaveLength(0);

		const nativeSpids = new Set(
			groupTopLevelEffects(slide.rawTiming!)
				.flatMap((group) => group.effects)
				.map((effect) => effect.spid)
				.filter((spid): spid is string => spid !== undefined),
		);
		const nativeBefore = effectSnapshotFor(slide.rawTiming!, nativeSpids);

		// Author a brand new entrance on a shape the native group does not
		// target, and drag it ahead of the native anchor (order below its own).
		const targetElement = slide.elements.find((el) => el.id.endsWith('shape-4'))!;
		slide.animations = [
			{
				elementId: targetElement.id,
				entrance: 'fadeIn',
				durationMs: 500,
				order: (nativeAnchor?.order ?? 0) - 1,
				trigger: 'onClick',
			},
		];
		slide.isDirty = true;

		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reloadedSlide = reloaded.slides[0]!;

		// The new editor effect round-trips and is now grounded ahead of the
		// native anchor's (recomputed) order.
		const reloadedAnim = reloadedSlide.animations?.[0];
		expect(reloadedAnim?.entrance).toBe('fadeIn');
		const reloadedAnchor = reloadedSlide.animationTimelineAnchors?.[0];
		expect(reloadedAnchor).toBeDefined();
		expect(reloadedAnim?.order).toBeLessThan(reloadedAnchor!.order);

		// The deck's own effect nodes are repositioned, never rewritten.
		const nativeAfter = effectSnapshotFor(reloadedSlide.rawTiming!, nativeSpids);
		expect(nativeAfter).toStrictEqual(nativeBefore);
	});
});
