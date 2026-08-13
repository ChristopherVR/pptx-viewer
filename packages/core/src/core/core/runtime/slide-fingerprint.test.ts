import { describe, it, expect } from 'vitest';

import type { PptxSlide } from '../../types';
import {
	fingerprintSlide,
	recordSlideFingerprints,
	slideMatchesFingerprint,
} from './slide-fingerprint';

/**
 * The fingerprint is the only thing standing between "we stopped rewriting
 * untouched slides" and "we silently dropped the user's edit". Every test here
 * is about one of those two failure directions:
 *
 * - a change the hash CANNOT see is lost work;
 * - a non-change the hash reacts to is only a wasted write.
 *
 * So the bar for "different slides hash differently" is exhaustive, and the
 * bar for "equivalent slides hash the same" covers exactly the equivalences
 * the five bindings actually produce (spread-reordered keys, explicit
 * `undefined`, and the position field the save pipeline rewrites itself).
 */
const baseSlide = (): PptxSlide =>
	({
		id: 'ppt/slides/slide1.xml',
		rId: 'rId2',
		slideNumber: 1,
		elements: [
			{
				id: 'el-1',
				type: 'text',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				text: 'Hello',
				textSegments: [{ text: 'Hello', bold: false }],
			},
			{ id: 'el-2', type: 'shape', x: 0, y: 0, width: 10, height: 10, shapeType: 'rect' },
		],
	}) as unknown as PptxSlide;

describe('fingerprintSlide', () => {
	it('is stable for the same content', () => {
		expect(fingerprintSlide(baseSlide())).toBe(fingerprintSlide(baseSlide()));
	});

	it('ignores key order, because every binding rebuilds slides by spreading', () => {
		const slide = baseSlide();
		const reordered = Object.fromEntries(Object.entries(slide).reverse()) as unknown as PptxSlide;
		expect(fingerprintSlide(reordered)).toBe(fingerprintSlide(slide));
	});

	it('treats an explicitly-undefined key as an absent key', () => {
		const slide = baseSlide();
		const withUndefined = { ...slide, notes: undefined, backgroundColor: undefined } as PptxSlide;
		expect(fingerprintSlide(withUndefined)).toBe(fingerprintSlide(slide));
	});

	it('ignores isDirty and slideNumber, which the save pipeline sets itself', () => {
		const slide = baseSlide();
		expect(fingerprintSlide({ ...slide, isDirty: true })).toBe(fingerprintSlide(slide));
		expect(fingerprintSlide({ ...slide, slideNumber: 9 })).toBe(fingerprintSlide(slide));
	});

	it('reacts to a nested text edit', () => {
		const slide = baseSlide();
		const edited = {
			...slide,
			elements: slide.elements.map((element, index) =>
				index === 0 ? { ...element, text: 'Goodbye' } : element,
			),
		} as PptxSlide;
		expect(fingerprintSlide(edited)).not.toBe(fingerprintSlide(slide));
	});

	it('reacts to a change deep inside a run style', () => {
		const slide = baseSlide();
		const edited = structuredClone(slide);
		(edited.elements[0] as unknown as { textSegments: { bold: boolean }[] }).textSegments[0].bold =
			true;
		expect(fingerprintSlide(edited)).not.toBe(fingerprintSlide(slide));
	});

	it('reacts to a moved element, a deleted element and a reordered spTree', () => {
		const slide = baseSlide();
		const moved = structuredClone(slide);
		(moved.elements[1] as unknown as { x: number }).x = 1;
		const deleted = { ...slide, elements: slide.elements.slice(0, 1) } as PptxSlide;
		const reordered = { ...slide, elements: [...slide.elements].reverse() } as PptxSlide;
		const original = fingerprintSlide(slide);
		expect(fingerprintSlide(moved)).not.toBe(original);
		expect(fingerprintSlide(deleted)).not.toBe(original);
		expect(fingerprintSlide(reordered)).not.toBe(original);
	});

	it('distinguishes an added key from an absent one, however new the field is', () => {
		const slide = baseSlide();
		const extended = { ...slide, somethingNobodyHasWrittenYet: 1 } as unknown as PptxSlide;
		expect(fingerprintSlide(extended)).not.toBe(fingerprintSlide(slide));
	});

	it('distinguishes types that stringify alike', () => {
		const asNumber = { ...baseSlide(), rId: 5 } as unknown as PptxSlide;
		const asString = { ...baseSlide(), rId: '5' } as unknown as PptxSlide;
		expect(fingerprintSlide(asNumber)).not.toBe(fingerprintSlide(asString));
	});

	it('sees a change in raw passthrough XML', () => {
		const slide = { ...baseSlide(), rawXml: { 'p:sld': { 'p:cSld': { '@_name': 'A' } } } };
		const edited = { ...baseSlide(), rawXml: { 'p:sld': { 'p:cSld': { '@_name': 'B' } } } };
		expect(fingerprintSlide(edited as PptxSlide)).not.toBe(fingerprintSlide(slide as PptxSlide));
	});

	it('sees a change in binary payload bytes', () => {
		const slide = { ...baseSlide(), thumbnail: new Uint8Array([1, 2, 3]) };
		const edited = { ...baseSlide(), thumbnail: new Uint8Array([1, 2, 4]) };
		expect(fingerprintSlide(edited as PptxSlide)).not.toBe(fingerprintSlide(slide as PptxSlide));
	});

	it('terminates on a cyclic model instead of overflowing the stack', () => {
		const slide = baseSlide() as unknown as Record<string, unknown>;
		const loop: Record<string, unknown> = { name: 'group' };
		loop.self = loop;
		slide.custom = loop;
		expect(() => fingerprintSlide(slide as unknown as PptxSlide)).not.toThrow();
	});

	it('refuses to claim a slide it could not hash is unchanged', () => {
		// A throwing getter (or XML deep enough to exhaust the stack) means the
		// walk cannot prove anything, so the answer must never match a baseline.
		const slide = baseSlide() as unknown as Record<string, unknown>;
		Object.defineProperty(slide, 'hostile', {
			enumerable: true,
			get() {
				throw new Error('no');
			},
		});
		const first = fingerprintSlide(slide as unknown as PptxSlide);
		expect(first).toContain('unhashable');
		expect(fingerprintSlide(slide as unknown as PptxSlide)).not.toBe(first);
	});

	it('ignores callbacks, whose identity changes on every render', () => {
		const slide = { ...baseSlide(), onThing: () => 1 } as unknown as PptxSlide;
		const other = { ...baseSlide(), onThing: () => 2 } as unknown as PptxSlide;
		expect(fingerprintSlide(slide)).toBe(fingerprintSlide(other));
	});
});

describe('slideMatchesFingerprint', () => {
	it('matches a recorded slide and rejects an edited one', () => {
		const fingerprints = new Map<string, string>();
		const slide = baseSlide();
		recordSlideFingerprints(fingerprints, [slide]);
		expect(slideMatchesFingerprint(fingerprints, slide)).toBeTruthy();
		// The bindings hand `save()` a NEW object every time; content decides.
		expect(slideMatchesFingerprint(fingerprints, { ...slide })).toBeTruthy();
		expect(slideMatchesFingerprint(fingerprints, { ...slide, notes: 'new' })).toBeFalsy();
	});

	it('never claims a slide it has never seen is unchanged', () => {
		expect(slideMatchesFingerprint(new Map(), baseSlide())).toBeFalsy();
	});
});
