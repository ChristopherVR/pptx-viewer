/**
 * `a:overrideClrMapping` values are `ST_ColorSchemeIndex` tokens, and the
 * enumeration is CASE SENSITIVE.
 *
 * `parseClrMapOverrideNode` used to finish with `.trim().toLowerCase()`. Eleven
 * of the twelve legal tokens (`dk1`, `lt1`, `dk2`, `lt2`, `accent1`..`accent6`,
 * `hlink`) are already lower-case, so the call was an invisible no-op on all of
 * them, and fatal on `folHlink`, the one camel-cased member. The parsed map is
 * written straight back out by `buildClrMapOverrideXml`, so a no-edit save
 * emitted `folHlink="folhlink"` and PowerPoint refused the WHOLE package with
 * 0x80070570, "the file or directory is corrupted and unreadable". Confirmed
 * through COM on both decks exercised below.
 *
 * These tests drive the real production path end to end (load a committed deck
 * through `PptxHandler`, save it, inflate the slide part) rather than mirroring
 * the parser in test scope, so they cannot pass against a re-implementation.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { requireFixture } from '../../../__tests__/require-fixture';
import { PptxHandler } from '../../PptxHandler';
import {
	normalizeColorSchemeIndex,
	parseOverrideClrMapping,
	COLOR_SCHEME_INDEX_TOKENS,
} from './color-scheme-index';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '../../../../../../e2e/fixtures');

/** The two committed decks that carry a slide-level `a:overrideClrMapping`. */
const DECKS = ['descender-clip.pptx', 'shape-3d-compound.pptx'] as const;

const toArrayBuffer = (bytes: Buffer): ArrayBuffer =>
	bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Load a deck, save it with no edits, and return every slide part as text. */
async function resaveSlideParts(deck: string): Promise<string[]> {
	const fixture = requireFixture(path.join(FIXTURES, deck));
	const handler = new PptxHandler();
	const loaded = await handler.load(toArrayBuffer(readFileSync(fixture)));
	const saved = await handler.save(loaded.slides);

	// Saved packages are DEFLATE-compressed, so the raw bytes contain no
	// readable XML; the part has to be inflated before it can be asserted on.
	const zip = await JSZip.loadAsync(saved);
	const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/u.test(n));
	return Promise.all(names.map((n) => zip.files[n]!.async('string')));
}

describe('a:overrideClrMapping survives a no-edit round trip', () => {
	for (const deck of DECKS) {
		it(`${deck}: keeps every ST_ColorSchemeIndex token in spec casing`, async () => {
			const parts = await resaveSlideParts(deck);
			const mappings = parts.flatMap((xml) => [...xml.matchAll(/<a:overrideClrMapping\b[^>]*>/gu)]);
			expect(mappings.length).toBeGreaterThan(0);

			for (const [tag] of mappings) {
				// The whole point: `folhlink` is not in the enumeration.
				expect(tag).not.toMatch(/folhlink/u);
				expect(tag).toContain('folHlink="folHlink"');

				// And no other attribute drifted out of the enumeration either.
				for (const [, value] of tag.matchAll(/\s[\w:]+="([^"]*)"/gu)) {
					expect(COLOR_SCHEME_INDEX_TOKENS).toContain(value);
				}
			}
		});
	}
});

describe('normalizeColorSchemeIndex', () => {
	it('returns the spec spelling for every legal token, whatever the casing', () => {
		for (const token of COLOR_SCHEME_INDEX_TOKENS) {
			expect(normalizeColorSchemeIndex(token)).toBe(token);
			expect(normalizeColorSchemeIndex(token.toLowerCase())).toBe(token);
			expect(normalizeColorSchemeIndex(token.toUpperCase())).toBe(token);
			expect(normalizeColorSchemeIndex(` ${token} `)).toBe(token);
		}
	});

	it('recovers the camel-cased member from any casing', () => {
		for (const spelling of ['folHlink', 'folhlink', 'FOLHLINK', 'FolHLink']) {
			expect(normalizeColorSchemeIndex(spelling)).toBe('folHlink');
		}
	});

	it('folds the four alias spellings onto the slot they denote', () => {
		expect(normalizeColorSchemeIndex('bg1')).toBe('lt1');
		expect(normalizeColorSchemeIndex('tx1')).toBe('dk1');
		expect(normalizeColorSchemeIndex('bg2')).toBe('lt2');
		expect(normalizeColorSchemeIndex('TX2')).toBe('dk2');
	});

	it('rejects anything outside the enumeration rather than passing it through', () => {
		for (const bad of ['', '   ', 'accent7', 'dk3', 'phClr', '#FF0000', undefined, null, 42]) {
			expect(normalizeColorSchemeIndex(bad)).toBeUndefined();
		}
	});
});

describe('parseOverrideClrMapping', () => {
	it('keeps folHlink camel-cased whatever the source wrote', () => {
		expect(parseOverrideClrMapping({ '@_folHlink': 'folhlink', '@_hlink': 'HLINK' })).toStrictEqual(
			{
				folHlink: 'folHlink',
				hlink: 'hlink',
			},
		);
	});

	it('drops an out-of-enum value and reports it instead of writing it through', () => {
		const reported: Array<[string, string]> = [];
		const parsed = parseOverrideClrMapping(
			{ '@_bg1': 'lt1', '@_accent1': 'chartreuse' },
			(alias, raw) => reported.push([alias, raw]),
		);
		expect(parsed).toStrictEqual({ bg1: 'lt1' });
		expect(reported).toStrictEqual([['accent1', 'chartreuse']]);
	});

	it('returns null when no alias is usable', () => {
		expect(parseOverrideClrMapping({})).toBeNull();
		expect(parseOverrideClrMapping({ '@_bg1': 'nonsense' })).toBeNull();
	});
});
