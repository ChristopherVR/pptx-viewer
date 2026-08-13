/**
 * One escaper for every string-concatenated SVG in `render/`.
 *
 * Four modules here build SVG markup as a STRING that a binding then injects
 * with `innerHTML` / `v-html` / `{@html}`: `visual-effects` (filters),
 * `chart-sparkline`, `svg-gradient-paint` and `image-tiling`. Each of them
 * grew its own private four-`replace` escaper. The copies are the defect, not
 * the escaping: four escapers means a hardening applied to one protects a
 * quarter of the surface, and nobody diffs four functions that all look fine.
 *
 * These tests assert the BEHAVIOUR through each module's real public entry
 * point rather than importing `escapeSvgAttr` and testing it once, so a fifth
 * private copy re-introduced tomorrow (or one of these call sites quietly
 * dropping the escape) fails here.
 */
import { describe, expect, it } from 'vitest';

import { renderSparklineSvg } from './chart-sparkline';
import { buildMirrorTiledBackground } from './image-tiling';
import { buildSvgGradientDef, svgGradientMarkup } from './svg-gradient-paint';
import { escapeSvgAttr, getDuotoneSvgFilterMarkup } from './visual-effects';

/** A value that closes its attribute and opens a script element if unescaped. */
const HOSTILE = '"><script>alert(1)</script><x y="';

/** Every escaped form the shared escaper produces, so a partial copy is caught. */
function expectEscaped(markup: string): void {
	expect(markup).not.toContain('<script>');
	expect(markup).toContain('&quot;&gt;&lt;script&gt;');
}

describe('escapeSvgAttr', () => {
	it('escapes all four characters that can break out of an attribute', () => {
		expect(escapeSvgAttr('a&b"c<d>e')).toBe('a&amp;b&quot;c&lt;d&gt;e');
	});

	it('escapes the ampersand first, so an escape is never double-escaped', () => {
		expect(escapeSvgAttr('&quot;')).toBe('&amp;quot;');
	});

	it('coerces rather than throwing on a value that is not a string', () => {
		// The gradient builder is handed descriptors assembled from parsed OOXML,
		// where a field typed `string` can still arrive `undefined` from a
		// malformed deck. Its private copy coerced; the consolidated one has to
		// keep doing so, or a bad deck throws mid-way through building markup
		// instead of rendering an inert attribute.
		expect(escapeSvgAttr(undefined as unknown as string)).toBe('undefined');
		expect(escapeSvgAttr(12 as unknown as string)).toBe('12');
	});
});

describe('every string-building SVG module escapes through the shared escaper', () => {
	it('chart-sparkline escapes a hostile series colour', () => {
		expectEscaped(renderSparklineSvg({ values: [1, 2, 3], type: 'line', color: HOSTILE }));
		expectEscaped(renderSparklineSvg({ values: [1, -2], type: 'bar', color: HOSTILE }));
		expectEscaped(renderSparklineSvg({ values: [1, -2], type: 'winLoss', negativeColor: HOSTILE }));
	});

	it('svg-gradient-paint escapes a hostile element id and stop colour', () => {
		const def = buildSvgGradientDef(
			{
				fillMode: 'gradient',
				fillGradientStops: [
					{ position: 0, color: HOSTILE },
					{ position: 100, color: '#000000' },
				],
			} as unknown as Parameters<typeof buildSvgGradientDef>[0],
			'e1',
		);
		expect(def).toBeDefined();
		expectEscaped(svgGradientMarkup({ ...def!, id: HOSTILE }));
	});

	it('visual-effects escapes a hostile filter id', () => {
		expectEscaped(getDuotoneSvgFilterMarkup(HOSTILE, '#112233', '#445566'));
	});

	it('image-tiling escapes a hostile image src', () => {
		// A data URI carrying a raw SVG payload (`data:image/svg+xml,<svg …>`) is
		// legal and already contains `<`, `&` and `"`, so this is the one call
		// site whose hostile input is also its ordinary input. The tile SVG is
		// URI-encoded into a `url("data:…")`, so decode before asserting.
		const tiled = buildMirrorTiledBackground(`data:image/svg+xml,${HOSTILE}`, 'xy', 100, 100);
		expect(tiled).toBeDefined();
		expectEscaped(decodeURIComponent(tiled!.backgroundImage));
	});
});
