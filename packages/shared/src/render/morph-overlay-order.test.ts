import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	boxesOverlap,
	buildMorphMergedOrder,
	resolveMorphOverlayArrivals,
	travelledBox,
} from './morph-overlay-order';
import type { MorphPair } from './morph-types';

function box(id: string, x: number, y: number, width = 100, height = 50): PptxElement {
	return { id, name: id, type: 'shape', x, y, width, height } as PptxElement;
}

function pair(from: PptxElement, to: PptxElement): MorphPair {
	return { fromElement: from, toElement: to };
}

describe('travelledBox', () => {
	it('unions the start and end boxes of a shape that moves', () => {
		expect(travelledBox(box('a', 0, 0), box('b', 100, 100))).toStrictEqual({
			left: 0,
			top: 0,
			right: 200,
			bottom: 150,
		});
	});

	it('is the shape box alone when there is no counterpart', () => {
		expect(travelledBox(box('a', 10, 20))).toStrictEqual({
			left: 10,
			top: 20,
			right: 110,
			bottom: 70,
		});
	});
});

describe('boxesOverlap', () => {
	it('is false for boxes that merely touch', () => {
		const a = travelledBox(box('a', 0, 0));
		const b = travelledBox(box('b', 100, 0));
		expect(boxesOverlap(a, b)).toBeFalsy();
	});

	it('is true when they share area', () => {
		const a = travelledBox(box('a', 0, 0));
		const b = travelledBox(box('b', 99, 0));
		expect(boxesOverlap(a, b)).toBeTruthy();
	});
});

describe('buildMorphMergedOrder', () => {
	it('gives a matched pair ONE rank, so both halves are the same object', () => {
		const from = box('a-1', 0, 0);
		const to = box('b-1', 0, 0);
		const rank = buildMorphMergedOrder([from], [to], [pair(from, to)]);

		expect(rank.get('a-1')).toBe(rank.get('b-1'));
	});

	it('keeps a departure between the shapes that surrounded it', () => {
		// Outgoing: base, leaving, cap. Incoming: base, cap. The departure has to
		// land between them, not on top of everything.
		const outgoing = [box('a-base', 0, 0), box('a-leaving', 0, 0), box('a-cap', 0, 0)];
		const incoming = [box('b-base', 0, 0), box('b-cap', 0, 0)];
		const pairs = [pair(outgoing[0], incoming[0]), pair(outgoing[2], incoming[1])];

		const rank = buildMorphMergedOrder(outgoing, incoming, pairs);

		expect(rank.get('a-base')!).toBeLessThan(rank.get('a-leaving')!);
		expect(rank.get('a-leaving')!).toBeLessThan(rank.get('a-cap')!);
	});

	it('keeps an arrival where the incoming slide put it', () => {
		const outgoing = [box('a-disc', 0, 0), box('a-cap', 0, 0)];
		const incoming = [box('b-disc', 0, 0), box('b-new', 0, 0), box('b-cap', 0, 0)];
		const pairs = [pair(outgoing[0], incoming[0]), pair(outgoing[1], incoming[2])];

		const rank = buildMorphMergedOrder(outgoing, incoming, pairs);

		expect(rank.get('b-disc')!).toBeLessThan(rank.get('b-new')!);
		expect(rank.get('b-new')!).toBeLessThan(rank.get('b-cap')!);
	});
});

describe('resolveMorphOverlayArrivals', () => {
	it('lifts an arrival that a painted ghost below it would cover', () => {
		// The wheel deck's shape: an unchanged disc, and new wording inside it.
		const disc = { from: box('a-disc', 0, 0, 300, 300), to: box('b-disc', 0, 0, 300, 300) };
		const outgoing = [disc.from];
		const incoming = [disc.to, box('b-title', 50, 50, 200, 30)];

		const lifted = resolveMorphOverlayArrivals(
			outgoing,
			incoming,
			[pair(disc.from, disc.to)],
			new Set(['a-disc']),
		);

		expect([...lifted]).toStrictEqual(['b-title']);
	});

	it('leaves an arrival alone when the ghost over it is where it belongs', () => {
		// The incoming BACKDROP arrives at the bottom of its own slide, so every
		// ghost is legitimately above it: lifting it would paint the new backdrop
		// over the whole outgoing slide.
		const disc = { from: box('a-disc', 0, 0, 300, 300), to: box('b-disc', 0, 0, 300, 300) };
		const outgoing = [disc.from];
		const incoming = [box('b-backdrop', 0, 0, 1280, 720), disc.to];

		const lifted = resolveMorphOverlayArrivals(
			outgoing,
			incoming,
			[pair(disc.from, disc.to)],
			new Set(['a-disc']),
		);

		expect([...lifted]).toStrictEqual([]);
	});

	it('leaves an arrival alone when nothing painted covers it', () => {
		const disc = { from: box('a-disc', 0, 0, 300, 300), to: box('b-disc', 0, 0, 300, 300) };
		const outgoing = [disc.from];
		const incoming = [disc.to, box('b-aside', 900, 0, 200, 30)];

		const lifted = resolveMorphOverlayArrivals(
			outgoing,
			incoming,
			[pair(disc.from, disc.to)],
			new Set(['a-disc']),
		);

		expect([...lifted]).toStrictEqual([]);
	});

	it('ignores a ghost the overlay is not painting', () => {
		// A ghost dropped as redundant hides nothing, so the arrival under it can
		// stay on the live stage where it costs nothing.
		const disc = { from: box('a-disc', 0, 0, 300, 300), to: box('b-disc', 0, 0, 300, 300) };

		const lifted = resolveMorphOverlayArrivals(
			[disc.from],
			[disc.to, box('b-title', 50, 50, 200, 30)],
			[pair(disc.from, disc.to)],
			new Set(),
		);

		expect([...lifted]).toStrictEqual([]);
	});

	it('never lifts a matched pair that is pinned at full strength', () => {
		// Anything painting a body keeps its opacity so the crossfade does not
		// hollow it out. Lifted above its own ghost it would simply cut.
		const disc = { from: box('a-disc', 0, 0, 300, 300), to: box('b-disc', 0, 0, 300, 300) };
		const chip = { from: box('a-chip', 20, 20, 80, 20), to: box('b-chip', 20, 20, 80, 20) };

		const lifted = resolveMorphOverlayArrivals(
			[disc.from, chip.from],
			[disc.to, chip.to],
			[pair(disc.from, disc.to), pair(chip.from, chip.to)],
			new Set(['a-disc', 'a-chip']),
		);

		expect([...lifted]).toStrictEqual([]);
	});

	it('lifts a matched pair whose incoming half dissolves in under a holding ghost', () => {
		// The wheel deck's centre wording, once the two panels' casts line up and
		// it pairs: it is a text box on `noFill`, so its incoming half fades in -
		// and it does so INSIDE an unchanged opaque disc whose ghost the overlay
		// paints for the whole morph, where nobody would ever see it (issue #160).
		const disc = { from: box('a-disc', 0, 0, 300, 300), to: box('b-disc', 0, 0, 300, 300) };
		const title = { from: box('a-title', 20, 20, 200, 30), to: box('b-title', 20, 20, 200, 30) };

		const lifted = resolveMorphOverlayArrivals(
			[disc.from, title.from],
			[disc.to, title.to],
			[pair(disc.from, disc.to), pair(title.from, title.to)],
			new Set(['a-disc']),
			new Set(['b-title']),
		);

		expect([...lifted]).toStrictEqual(['b-title']);
	});

	it('leaves a dissolving-in pair on the stage when no holding ghost covers it', () => {
		const title = { from: box('a-title', 20, 20, 200, 30), to: box('b-title', 20, 20, 200, 30) };

		const lifted = resolveMorphOverlayArrivals(
			[title.from],
			[title.to],
			[pair(title.from, title.to)],
			new Set(),
			new Set(['b-title']),
		);

		expect([...lifted]).toStrictEqual([]);
	});

	it('lifts a dissolving-in pair the incoming slide stacks above a travelling ghost', () => {
		// A title sits at the BOTTOM of the outgoing stack and near the top of
		// the incoming one, while a full-slide photo (same name, same image,
		// every id different) slides in from off-stage left and a full-slide
		// overlay glides in from the right. The merged order anchors the pair
		// to its outgoing layer, where the ghosts are above it - but mid-flight
		// those ghosts composite at their counterparts' INCOMING layer, below
		// the title, so the title must lift to stay visible for the whole
		// morph.
		const photo = {
			from: box('a-photo', -1279, 0, 1279, 720),
			to: box('b-photo', 1, 0, 1279, 720),
		};
		const title = {
			from: box('a-title', 219, 262, 841, 195),
			to: box('b-title', 219, 262, 841, 195),
		};
		const outgoing = [title.from, photo.from];
		const incoming = [photo.to, title.to];

		const lifted = resolveMorphOverlayArrivals(
			outgoing,
			incoming,
			[pair(photo.from, photo.to), pair(title.from, title.to)],
			new Set(['a-photo']),
			new Set(['b-title']),
		);

		expect([...lifted]).toStrictEqual(['b-title']);
	});

	it('leaves an arrival the incoming slide stacks below a travelling ghost', () => {
		// Mirror image: the incoming slide puts the title UNDER the photo, so
		// the ghost legitimately passes over it and no lift is warranted.
		const photo = {
			from: box('a-photo', -1279, 0, 1279, 720),
			to: box('b-photo', 1, 0, 1279, 720),
		};
		const title = {
			from: box('a-title', 219, 262, 841, 195),
			to: box('b-title', 219, 262, 841, 195),
		};
		const outgoing = [title.from, photo.from];
		const incoming = [title.to, photo.to];

		const lifted = resolveMorphOverlayArrivals(
			outgoing,
			incoming,
			[pair(photo.from, photo.to), pair(title.from, title.to)],
			new Set(['a-photo']),
			new Set(['b-title']),
		);

		expect([...lifted]).toStrictEqual([]);
	});
});
