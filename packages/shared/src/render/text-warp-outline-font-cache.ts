/**
 * Best-effort glyph-outline font source for `text-warp-glyph-outline.ts`.
 *
 * Parses actual font FILES (TrueType/CFF) with `opentype.js` so a WordArt
 * envelope glyph can be warped as its real outline instead of an affine
 * approximation of its bounding box (see that module's doc comment). Outlines
 * are obtainable from two places, matching CLAUDE.md's Rule 2 "pure decision
 * function" shape: this module only ever produces a `Font | undefined`
 * lookup, never touches the DOM, and never decides how a binding renders.
 *
 *  - Embedded fonts (`PptxEmbeddedFont[]`): the deck's own loader already
 *    holds the clear-text bytes in memory (see
 *    `embedded-fonts.ts`'s `resolveEmbeddedFontClearBytes`), so parsing is
 *    synchronous and needs no network round-trip.
 *  - Catalogue webfonts (Google Fonts): the family's actual `.woff2` bytes
 *    are fetched separately from the `<link rel=stylesheet>` each binding
 *    already injects for on-screen text (see
 *    `text-warp-outline-webfont-fetch.ts`), since the stylesheet alone
 *    carries no usable glyph geometry.
 *
 * A font this cache cannot resolve (parse failure, unknown family, a webfont
 * fetch still in flight, or a system font with no file the browser exposes at
 * all) simply has no entry: `text-warp-envelope-layout.ts` falls back to the
 * existing per-glyph affine transform for that glyph, unchanged.
 */
import type { Font } from 'opentype.js';
import { parse } from 'opentype.js';
import type { PptxEmbeddedFont } from 'pptx-viewer-core';

import { DEFAULT_TEXT_FONT_SIZE } from '../constants';
import { resolveEmbeddedFontClearBytes } from './embedded-fonts';
import type { GlyphOutlineCommand } from './text-warp-glyph-outline';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	// `opentype.parse` wants a real ArrayBuffer; `bytes` may be a view over a
	// larger buffer (e.g. `rawFontData` sliced from a ZIP entry), so this
	// copies only the bytes this font actually owns.
	const copy = bytes.slice();
	return copy.buffer as ArrayBuffer;
}

/**
 * The primary family name out of a CSS `font-family` VALUE, which may be a
 * comma-separated fallback list with quoted entries (e.g.
 * `'"Calibri", "Carlito", sans-serif'`, what `getSubstituteFontFamily` in
 * `pptx-viewer-core` returns and every binding's segment-font resolver
 * passes through here) - a plain, single family name (what
 * `PptxEmbeddedFont.name` and `collectReferencedFontFamilies` already
 * produce) passes through unchanged.
 */
function primaryFontFamily(family: string): string {
	const first = family.split(',')[0] ?? family;
	return first.trim().replace(/^['"]|['"]$/gu, '');
}

function cacheKey(family: string, bold: boolean, italic: boolean): string {
	return `${primaryFontFamily(family).toLowerCase()}|${bold ? 1 : 0}|${italic ? 1 : 0}`;
}

/**
 * Caches parsed `opentype.js` fonts by `(family, bold, italic)`.
 *
 * A binding constructs one instance per loaded deck, calls
 * {@link registerEmbeddedFonts} (synchronous) as soon as the deck's embedded
 * fonts are known, optionally feeds it webfont bytes as they arrive via
 * {@link registerFontBytes}, and passes `.get(...)` into
 * `buildGlyphEnvelope`'s `getOutlineFont` option.
 */
export class GlyphOutlineFontCache {
	private readonly fonts = new Map<string, Font>();
	private readonly attempted = new Set<string>();

	/** The parsed font for `(family, bold, italic)`, or `undefined` if unavailable. */
	get(
		family: string | undefined,
		bold: boolean | undefined,
		italic: boolean | undefined,
	): Font | undefined {
		if (!family) {
			return undefined;
		}
		return this.fonts.get(cacheKey(family, Boolean(bold), Boolean(italic)));
	}

	/** True once this `(family, bold, italic)` has been looked up, whether or not it resolved. */
	hasAttempted(family: string, bold: boolean, italic: boolean): boolean {
		return this.attempted.has(cacheKey(family, bold, italic));
	}

	/**
	 * Synchronously parse every embedded font whose bytes are already
	 * resolvable, no network involved. Safe to call repeatedly (e.g. once per
	 * render) with the same list: already-resolved or already-failed entries
	 * are skipped.
	 */
	registerEmbeddedFonts(fonts: readonly PptxEmbeddedFont[]): void {
		for (const font of fonts) {
			if (!font.name) {
				continue;
			}
			const key = cacheKey(font.name, Boolean(font.bold), Boolean(font.italic));
			if (this.fonts.has(key) || this.attempted.has(key)) {
				continue;
			}
			this.attempted.add(key);
			const bytes = resolveEmbeddedFontClearBytes(font);
			if (!bytes || bytes.length < 4) {
				continue;
			}
			try {
				this.fonts.set(key, parse(toArrayBuffer(bytes)));
			} catch {
				// Unparseable font (corrupt or an outline format opentype.js does
				// not support): leave unset so the affine fallback applies.
			}
		}
	}

	/**
	 * Register raw bytes fetched separately for `(family, bold, italic)` (see
	 * `text-warp-outline-webfont-fetch.ts`). Returns whether parsing
	 * succeeded; a caller that owns re-rendering can use this to know whether
	 * a re-render is worth triggering.
	 */
	registerFontBytes(family: string, bold: boolean, italic: boolean, bytes: Uint8Array): boolean {
		const key = cacheKey(family, bold, italic);
		this.attempted.add(key);
		if (bytes.length < 4) {
			return false;
		}
		try {
			this.fonts.set(key, parse(toArrayBuffer(bytes)));
			return true;
		} catch {
			return false;
		}
	}
}

/** Characters with no visible glyph outline (a legitimate "nothing to draw" result). */
const WHITESPACE_RE = /^\s$/u;

/**
 * Extract one glyph's outline commands from `font`, positioned at `(x, y)`
 * (the glyph's own baseline origin, matching `EnvelopeGlyphPlacement.x`/`.y`)
 * and scaled to `fontSizePx`.
 *
 * Returns `[]` for whitespace (no visible outline; still a resolvable
 * result, distinct from "unobtainable") and `undefined` when `font` cannot
 * shape `char` at all, so the caller falls back to the affine transform.
 */
export function extractGlyphOutlineCommands(
	font: Font,
	char: string,
	x: number,
	y: number,
	fontSizePx: number,
): GlyphOutlineCommand[] | undefined {
	if (!char) {
		return undefined;
	}
	if (WHITESPACE_RE.test(char)) {
		return [];
	}
	try {
		if (!font.hasChar(char)) {
			return undefined;
		}
		const path = font.getPath(char, x, y, fontSizePx);
		return path.commands.map((cmd): GlyphOutlineCommand => {
			switch (cmd.type) {
				case 'M':
				case 'L':
					return { type: cmd.type, x: cmd.x, y: cmd.y };
				case 'Q':
					return { type: 'Q', x1: cmd.x1, y1: cmd.y1, x: cmd.x, y: cmd.y };
				case 'C':
					return { type: 'C', x1: cmd.x1, y1: cmd.y1, x2: cmd.x2, y2: cmd.y2, x: cmd.x, y: cmd.y };
				case 'Z':
				default:
					return { type: 'Z' };
			}
		});
	} catch {
		return undefined;
	}
}

/** A minimal font-spec shape, structurally compatible with `EnvelopeFontSpec`. */
export interface GlyphOutlineCacheFontSpec {
	fontFamily?: string;
	fontSizePx?: number;
	bold?: boolean;
	italic?: boolean;
}

/**
 * Build the `getGlyphOutline` callback `buildGlyphEnvelope` (in
 * `text-warp-envelope-layout.ts`) accepts: looks up `cache` for the segment's
 * resolved font and, if found, extracts that glyph's outline.
 */
export function createGlyphOutlineLookup(
	cache: GlyphOutlineFontCache,
): (
	char: string,
	font: GlyphOutlineCacheFontSpec,
	x: number,
	y: number,
) => GlyphOutlineCommand[] | undefined {
	return (char, font, x, y) => {
		const parsed = cache.get(font.fontFamily, font.bold, font.italic);
		if (!parsed) {
			return undefined;
		}
		const size = font.fontSizePx && font.fontSizePx > 0 ? font.fontSizePx : DEFAULT_TEXT_FONT_SIZE;
		return extractGlyphOutlineCommands(parsed, char, x, y, size);
	};
}
