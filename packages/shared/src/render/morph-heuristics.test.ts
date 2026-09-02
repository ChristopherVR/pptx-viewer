/**
 * Tests for the appearance/media morph matching heuristics
 * (`morph-heuristics.ts`): the same-media picture pass and the
 * identical-twin and group-twin passes, plus the vetoes they share.
 *
 * The motivating scenario parks a full-bleed photo off the slide's LEFT edge
 * and a full-slide black overlay off the RIGHT edge, then morphs both
 * on-screen while the title recolours. PowerPoint pairs the photo with its
 * same-named twin (every id differs: the slides were authored
 * independently), the overlay with its identical-paint twin (same type, box,
 * fill and line, different name), and a rotated title group with its
 * un-rotated landing spot (same box, same words, corresponding casts).
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	matchGroupTwins,
	matchIdenticalTwins,
	matchNamedTextTwins,
	matchSameMedia,
} from './morph-heuristics';
import { matchMorphElementsFull } from './morph-matching';
import { appearanceSignature, differentText } from './morph-predicates';

function makeElement(
	overrides: Partial<PptxElement> & { id: string; type: PptxElement['type'] },
): PptxElement {
	return {
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

function makeSlide(elements: PptxElement[], id = 'slide-1'): PptxSlide {
	return { id, elements } as PptxSlide;
}

/** Full-slide overlay with declared paint. */
function overlay(id: string, x: number, name?: string): PptxElement {
	return makeElement({
		id,
		type: 'shape',
		name,
		x,
		y: 0,
		width: 1279,
		height: 720,
		shapeType: 'rect',
		shapeStyle: {
			fillMode: 'solid',
			fillColor: '#000000',
			fillOpacity: 0.58824,
			strokeColor: '#000000',
			strokeWidth: 2,
			strokeOpacity: 0.50196,
		},
	});
}

function picture(id: string, x: number, overrides: Partial<PptxElement> = {}): PptxElement {
	return makeElement({
		id,
		type: 'picture',
		name: 'Picture 2',
		x,
		y: 0,
		width: 1279,
		height: 720,
		imagePath: 'ppt/media/image1.jpeg',
		...overrides,
	});
}

describe('differentText', () => {
	it('flags two wordful elements that say different things', () => {
		const a = makeElement({ id: 'a', type: 'text', text: 'Hello' });
		const b = makeElement({ id: 'b', type: 'text', text: 'World' });
		expect(differentText(a, b)).toBeTruthy();
	});

	it('ignores whitespace differences and wordless elements', () => {
		const a = makeElement({ id: 'a', type: 'text', text: 'Hello  world' });
		const b = makeElement({ id: 'b', type: 'text', text: 'Hello world' });
		expect(differentText(a, b)).toBeFalsy();
		expect(differentText(makeElement({ id: 'c', type: 'text' }), b)).toBeFalsy();
	});
});

describe('appearanceSignature', () => {
	it('separates shapes by their declared paint', () => {
		const black = overlay('a', 0);
		const white = overlay('b', 0);
		(white as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor = '#FFFFFF';
		expect(appearanceSignature(black)).not.toBe(appearanceSignature(white));
	});

	it('separates pictures by their media part', () => {
		expect(appearanceSignature(picture('a', 0))).not.toBe(
			appearanceSignature(picture('b', 0, { imagePath: 'ppt/media/image2.png' })),
		);
		expect(appearanceSignature(picture('a', 0))).toBe(appearanceSignature(picture('b', 500)));
	});
});

describe('matchSameMedia', () => {
	it('pairs same-named pictures carrying the same media across the slide', () => {
		const from = makeSlide([picture('a', -1279)]);
		const to = makeSlide([picture('b', 1)], 'slide-2');
		const usedFrom = new Set<string>();
		const usedTo = new Set<string>();
		const pairs = matchSameMedia(from.elements, to.elements, usedFrom, usedTo);
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('b');
	});

	it('refuses the same name when the media differs', () => {
		const from = makeSlide([picture('a', -1279)]);
		const to = makeSlide(
			[picture('b', 1, { imagePath: 'ppt/media/image2.png', name: 'Picture 2' })],
			'slide-2',
		);
		expect(matchSameMedia(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('pairs the same media even when the names differ', () => {
		const from = makeSlide([picture('a', -729, { name: 'Picture 12' })]);
		const to = makeSlide([picture('b', 0, { name: 'Picture 8' })], 'slide-2');
		const pairs = matchSameMedia(from.elements, to.elements, new Set(), new Set());
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fromElement.id).toBe('a');
	});

	it('pairs unnamed pictures carrying the same media', () => {
		const from = makeSlide([picture('a', -1279, { name: undefined })]);
		const to = makeSlide([picture('b', 1, { name: undefined })], 'slide-2');
		expect(matchSameMedia(from.elements, to.elements, new Set(), new Set())).toHaveLength(1);
	});

	it('does not cross-path two same-named pictures', () => {
		// The same thumbnail sits off the LEFT edge (520 wide) and off the RIGHT
		// edge (457 wide); each morphs into the nearest on-slide copy. A
		// first-in-order pairing would cross them and read as a speed mismatch.
		const from = makeSlide([
			picture('a-left', -1148, { width: 520, height: 297, x: -1148 }),
			picture('a-right', 1966, { width: 457, height: 297, x: 1966 }),
		]);
		const to = makeSlide(
			[
				picture('b-right', 671, { width: 457, height: 297, x: 671 }),
				picture('b-left', 152, { width: 520, height: 297, x: 152 }),
			],
			'slide-2',
		);
		const pairs = matchSameMedia(from.elements, to.elements, new Set(), new Set());
		const byFrom = new Map(pairs.map((p) => [p.fromElement.id, p.toElement.id]));
		expect(byFrom.get('a-left')).toBe('b-left');
		expect(byFrom.get('a-right')).toBe('b-right');
	});

	it('pairs a split-picture mosaic piece-for-piece', () => {
		// One artwork is staged as a 971x971 base plus seven cropped tiles, ALL
		// the same media part, all named "Picture 2" but the base. The next
		// slide repeats the same eight boxes shifted straight up; several tiles
		// SHARE the base's exact corner, so nearest-first greedy pairing runs
		// into equidistant candidates, lets early iterations consume a
		// neighbour's twin and forces later ones across the slide ("the pieces
		// jump around"). The incoming list here is even authored bottom-up,
		// unlike the outgoing one.
		const from = [
			picture('f-base', 155, { y: 581, width: 971, height: 971, name: 'Picture 5' }),
			picture('f-t1', 513, { y: 1217, width: 384, height: 335 }),
			picture('f-t2', 481, { y: 958, width: 414, height: 259 }),
			picture('f-t3', 158, { y: 1121, width: 356, height: 431 }),
			picture('f-t4', 492, { y: 581, width: 381, height: 377 }),
			picture('f-t5', 873, { y: 581, width: 254, height: 584 }),
			picture('f-t6', 896, { y: 1165, width: 231, height: 386 }),
			// Same top-left corner as the base, different box: the tie trap.
			picture('f-t7', 155, { y: 581, width: 356, height: 540 }),
		];
		const SHIFT_Y = -700;
		const twin = (id: string, el: PptxElement): PptxElement =>
			picture(id, el.x, {
				y: el.y + SHIFT_Y,
				width: el.width,
				height: el.height,
				name: el.name,
			});
		const to = [
			...from
				.slice(1)
				.reverse()
				.map((el, i) => twin(`b-t${7 - i}`, el)),
			twin('b-base', from[0]),
		];
		const pairs = matchSameMedia(from, to, new Set(), new Set());
		expect(pairs).toHaveLength(8);
		for (const pair of pairs) {
			const f = pair.fromElement;
			const t = pair.toElement;
			expect(t.x).toBe(f.x);
			expect(t.y).toBe(f.y + SHIFT_Y);
			expect(t.width).toBe(f.width);
			expect(t.height).toBe(f.height);
		}
	});

	it('refuses conflicting !! names', () => {
		const from = makeSlide([picture('a', -1279, { name: '!!hero' })]);
		const to = makeSlide([picture('b', 1, { name: '!!villain' })], 'slide-2');
		expect(matchSameMedia(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});
});

describe('matchNamedTextTwins', () => {
	/** A same-named headline parked far off-stage on the outgoing slide. */
	function headline(id: string, y: number, overrides: Partial<PptxElement> = {}): PptxElement {
		return makeElement({
			id,
			type: 'text',
			name: 'Title 1',
			x: 78,
			y,
			width: 1123,
			height: 486,
			text: 'ROADMAP 2026',
			...overrides,
		});
	}

	it('pairs a same-named headline parked far off-stage with its landing spot', () => {
		const from = makeSlide([headline('a', -1439)]);
		const to = makeSlide([headline('b', 117)], 'slide-2');
		const pairs = matchNamedTextTwins(from.elements, to.elements, new Set(), new Set());
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('b');
	});

	it('refuses twins whose words differ (a rebuilt headline)', () => {
		const from = makeSlide([headline('a', -1439)]);
		const to = makeSlide([headline('b', 117, { text: 'ROADMAP 2027' })], 'slide-2');
		expect(matchNamedTextTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('refuses different names, which carry no identity', () => {
		const from = makeSlide([headline('a', -1439)]);
		const to = makeSlide([headline('b', 117, { name: 'Title 2' })], 'slide-2');
		expect(matchNamedTextTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('refuses a different box, which is a rebuilt frame', () => {
		const from = makeSlide([headline('a', -1439)]);
		const to = makeSlide([headline('b', 117, { width: 900 })], 'slide-2');
		expect(matchNamedTextTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('takes the nearest twin when several share the name', () => {
		// Two panels each carry a layout "Title 1"; the headline that slid a
		// short way is the twin, not the one across the deck.
		const from = makeSlide([headline('a', 100)]);
		const to = makeSlide([headline('far', 1900), headline('near', 140)], 'slide-2');
		const pairs = matchNamedTextTwins(from.elements, to.elements, new Set(), new Set());
		expect(pairs.map((p) => p.toElement.id)).toStrictEqual(['near']);
	});
});

describe('matchGroupTwins', () => {
	/** A staged title panel: backdrop + title, rotated. */
	function titlePanel(
		id: string,
		x: number,
		y: number,
		rotation: number,
		overrides: Partial<PptxElement> = {},
	): PptxElement {
		return makeElement({
			id,
			type: 'group',
			name: overrides.name ?? `Group ${id}`,
			x,
			y,
			width: 1280,
			height: 720,
			rotation,
			children: [
				makeElement({ id: `${id}-backdrop`, type: 'shape', width: 1280, height: 720 }),
				makeElement({
					id: `${id}-title`,
					type: 'text',
					name: 'Title 1',
					text: overrides.text ?? 'Panel headline',
				}),
			],
		} as Partial<PptxElement>);
	}

	it('pairs same-size groups with corresponding casts however far apart they sit', () => {
		const from = makeSlide([titlePanel('a', -411, -1009, 327.1)]);
		const to = makeSlide([titlePanel('b', 0, 0, 0)], 'slide-2');
		const pairs = matchGroupTwins(from.elements, to.elements, new Set(), new Set());
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('b');
	});

	it('refuses groups whose words differ (issue #144 drifting text)', () => {
		const from = makeSlide([titlePanel('a', 533, 285, 0, { text: 'Secure Data Movement' })]);
		const to = makeSlide([titlePanel('b', 717, 283, 0, { text: 'Possumus continer' })], 'slide-2');
		expect(matchGroupTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('refuses groups of different sizes', () => {
		const from = makeSlide([titlePanel('a', -411, -1009, 327.1)]);
		const to = makeSlide(
			[makeElement({ id: 'b', type: 'group', x: 0, y: 0, width: 640, height: 360, children: [] })],
			'slide-2',
		);
		expect(matchGroupTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('refuses groups whose casts do not line up one for one', () => {
		const from = makeSlide([titlePanel('a', -411, -1009, 327.1)]);
		const to = makeSlide(
			[
				makeElement({
					id: 'b',
					type: 'group',
					x: 0,
					y: 0,
					width: 1280,
					height: 720,
					children: [makeElement({ id: 'b-only', type: 'shape', width: 1280, height: 720 })],
				}),
			],
			'slide-2',
		);
		expect(matchGroupTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('refuses conflicting !! names', () => {
		const from = makeSlide([titlePanel('a', -411, -1009, 327.1, { name: '!!hero' })]);
		const to = makeSlide([titlePanel('b', 0, 0, 0, { name: '!!villain' })], 'slide-2');
		expect(matchGroupTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('pairs the staged title panel through the full matcher', () => {
		const from = makeSlide([picture('a-photo', 1), titlePanel('a-group', -411, -1009, 327.1)]);
		const to = makeSlide([picture('b-photo', 1), titlePanel('b-group', 0, 0, 0)], 'slide-2');
		const { pairs } = matchMorphElementsFull(from, to);
		const byFrom = new Map(pairs.map((p) => [p.fromElement.id, p.toElement.id]));
		expect(byFrom.get('a-group')).toBe('b-group');
	});
});

describe('matchIdenticalTwins', () => {
	it('pairs identical painted shapes however far apart they sit', () => {
		const from = makeSlide([overlay('a', 1279, 'Rectangle 6')]);
		const to = makeSlide([overlay('b', 1, 'Rectangle 1')], 'slide-2');
		const pairs = matchIdenticalTwins(from.elements, to.elements, new Set(), new Set());
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('b');
	});

	it('refuses unstyled shapes, which carry no identity statement', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 0, y: 0 })]);
		const to = makeSlide([makeElement({ id: 'b', type: 'shape', x: 900, y: 900 })], 'slide-2');
		expect(matchIdenticalTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('refuses the same size when the paint differs', () => {
		const white = overlay('b', 1, 'Rectangle 1');
		(white as { shapeStyle: Record<string, unknown> }).shapeStyle.fillColor = '#FFFFFF';
		const from = makeSlide([overlay('a', 1279, 'Rectangle 6')]);
		const to = makeSlide([white], 'slide-2');
		expect(matchIdenticalTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('refuses the same paint when the size differs', () => {
		const from = makeSlide([overlay('a', 1279, 'Rectangle 6')]);
		const to = makeSlide([overlay('b', 1, 'Rectangle 1')], 'slide-2');
		(to.elements[0] as { width: number }).width = 640;
		expect(matchIdenticalTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});

	it('refuses wordful twins that say different things', () => {
		const from = makeSlide([overlay('a', 1279)]);
		const to = makeSlide([overlay('b', 1)], 'slide-2');
		(from.elements[0] as { text: string }).text = 'Hello';
		(to.elements[0] as { text: string }).text = 'World';
		expect(matchIdenticalTwins(from.elements, to.elements, new Set(), new Set())).toHaveLength(0);
	});
});

describe('morph matching end to end', () => {
	// The full matcher wiring: the title recolours via its creationId, the
	// photo glides in from the left via name + media, and the overlay glides
	// in from the right as an identical twin.
	function stagedSlides(): { from: PptxSlide; to: PptxSlide } {
		const from = makeSlide([
			makeElement({ id: 'a-text', type: 'text', text: 'The Future', x: 219, y: 262 }),
			picture('a-pic', -1279),
			overlay('a-rect', 1279, 'Rectangle 6'),
		]);
		const to = makeSlide(
			[
				picture('b-pic-in', 1),
				makeElement({
					id: 'b-pic-top',
					type: 'picture',
					name: 'Picture 5',
					x: 0,
					y: -737,
					imagePath: 'ppt/media/image2.png',
				}),
				overlay('b-rect', 1, 'Rectangle 1'),
				makeElement({ id: 'b-text', type: 'text', text: 'The Future', x: 219, y: 262 }),
				makeElement({ id: 'b-dot', type: 'shape', x: 624, y: 344, width: 32, height: 32 }),
			],
			'slide-2',
		);
		return { from, to };
	}

	it('pairs the photo, the overlay, and the title', () => {
		const { from, to } = stagedSlides();
		const { pairs } = matchMorphElementsFull(from, to);
		const byFrom = new Map(pairs.map((p) => [p.fromElement.id, p.toElement.id]));
		expect(byFrom.get('a-pic')).toBe('b-pic-in');
		expect(byFrom.get('a-rect')).toBe('b-rect');
		// The title carries no identity here beyond its words and position, so
		// it pairs by proximity; the off-stage leftovers stay unmatched.
		expect(pairs.length).toBeGreaterThanOrEqual(2);
	});
});
