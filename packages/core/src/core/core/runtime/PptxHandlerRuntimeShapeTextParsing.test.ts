/**
 * Tests for the REAL `extractParagraphOwnProperties` on `PptxHandlerRuntime`,
 * plus the exported `a:pPr` parsers it delegates to.
 *
 * This file used to reimplement each parser as a local copy and assert on the
 * copy, which proved nothing about the shipped code and hid the gap below: the
 * production extractor never read `defTabSz`, `eaLnBrk`, `latinLnBrk`,
 * `fontAlgn` or `hangingPunct`, so a paragraph whose values differed from the
 * shape-level style (`resolveShapeParagraphStyle` keeps only the first
 * paragraph's) lost them at LOAD and no save-side preservation could recover
 * them. Measured on `e2e/fixtures/issue-132-hr-deck.pptx` slide 20, a no-edit
 * round-trip dropped 10 instances each of `eaLnBrk`, `fontAlgn` and
 * `hangingPunct`; all 30 now survive.
 */
import { describe, expect, it } from 'vitest';

import type { TextStyle, XmlObject } from '../../types';
import {
	parseAlignmentAttr,
	parseParagraphExtraAttributes,
	parseParagraphLevel,
	parseParagraphMargins,
	parseParagraphRtl,
	parseTabStops,
} from '../../utils/paragraph-properties-parser';
import { createAutoNumberSequence } from './auto-number-sequence';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';
import type { ParagraphStyleResult, ShapeTextParsingContext } from './PptxHandlerRuntimeTypes';

const EMU_PER_PX = 9525;

class ParagraphPropertiesRuntime extends PptxHandlerRuntime {
	public extractOwnProperties(p: XmlObject, basisFontSize?: number): TextStyle | undefined {
		return this.extractParagraphOwnProperties(p, basisFontSize);
	}

	public resolveParagraphStyle(
		p: XmlObject,
		textStyle: TextStyle,
		ctx: ShapeTextParsingContext,
	): ParagraphStyleResult {
		return this.resolveShapeParagraphStyle(p, textStyle, ctx);
	}
}

const runtime = new ParagraphPropertiesRuntime();

function makeContext(overrides: Partial<ShapeTextParsingContext> = {}): ShapeTextParsingContext {
	return {
		txBody: undefined,
		inheritedTxBody: undefined,
		bodyDefaultRunStyle: {},
		slideRelationshipMap: undefined,
		placeholderInfo: undefined,
		phDefaults: undefined,
		slidePath: undefined,
		effectiveLevelStyles: undefined,
		styleFontRefColor: undefined,
		styleFontRefTypeface: undefined,
		autoNumbering: createAutoNumberSequence(),
		...overrides,
	};
}

/** The `a:pPr` PowerPoint wrote on `issue-132-hr-deck.pptx` slide 20. */
const HR_DECK_SLIDE_20_PPR: XmlObject = {
	'@_eaLnBrk': '1',
	'@_fontAlgn': 'auto',
	'@_hangingPunct': '1',
};

// ---------------------------------------------------------------------------
// extractParagraphOwnProperties
// ---------------------------------------------------------------------------
describe('extractParagraphOwnProperties', () => {
	it('captures the East-Asian line-breaking and justification attributes', () => {
		const result = runtime.extractOwnProperties({ 'a:pPr': HR_DECK_SLIDE_20_PPR });

		expect(result).toBeDefined();
		expect(result!.eaLineBreak).toBeTruthy();
		expect(result!.fontAlignment).toBe('auto');
		expect(result!.hangingPunctuation).toBeTruthy();
	});

	it('captures latinLnBrk and defTabSz', () => {
		const result = runtime.extractOwnProperties({
			'a:pPr': { '@_latinLnBrk': '0', '@_defTabSz': '914400' },
		});

		expect(result!.latinLineBreak).toBeFalsy();
		expect(result!.defaultTabSize).toBeCloseTo(914400 / EMU_PER_PX, 5);
	});

	it('distinguishes an explicit "0" from an omitted attribute', () => {
		const explicit = runtime.extractOwnProperties({
			'a:pPr': { '@_eaLnBrk': '0', '@_hangingPunct': '0' },
		});
		expect(explicit!.eaLineBreak).toBeFalsy();
		expect(explicit!.hangingPunctuation).toBeFalsy();
		expect(explicit).toHaveProperty('eaLineBreak');
		expect(explicit).toHaveProperty('hangingPunctuation');

		const omitted = runtime.extractOwnProperties({ 'a:pPr': { '@_algn': 'ctr' } });
		expect(omitted).not.toHaveProperty('eaLineBreak');
		expect(omitted).not.toHaveProperty('hangingPunctuation');
	});

	it('still captures margins, indent, alignment and rtl', () => {
		const result = runtime.extractOwnProperties({
			'a:pPr': {
				'@_marL': '457200',
				'@_marR': '228600',
				'@_indent': '-228600',
				'@_algn': 'ctr',
				'@_rtl': '1',
			},
		});

		expect(result!.paragraphMarginLeft).toBeCloseTo(457200 / EMU_PER_PX, 5);
		expect(result!.paragraphMarginRight).toBeCloseTo(228600 / EMU_PER_PX, 5);
		expect(result!.paragraphIndent).toBeCloseTo(-228600 / EMU_PER_PX, 5);
		expect(result!.align).toBe('center');
		expect(result!.rtl).toBeTruthy();
	});

	it('still captures spacing, line spacing and tab stops', () => {
		const result = runtime.extractOwnProperties({
			'a:pPr': {
				'a:lnSpc': { 'a:spcPct': { '@_val': '150000' } },
				'a:spcBef': { 'a:spcPts': { '@_val': '600' } },
				'a:spcAft': { 'a:spcPts': { '@_val': '300' } },
				'a:tabLst': { 'a:tab': { '@_pos': '914400', '@_algn': 'ctr' } },
			},
		});

		expect(result!.lineSpacing).toBeCloseTo(1.5, 5);
		expect(result!.paragraphSpacingBefore).toBeGreaterThan(0);
		expect(result!.paragraphSpacingAfter).toBeGreaterThan(0);
		expect(result!.tabStops).toHaveLength(1);
		expect(result!.tabStops![0].align).toBe('ctr');
	});

	it('re-emits a:defRPr and a:extLst verbatim', () => {
		const defRPr = { '@_sz': '1200' };
		const extLst = { 'a:ext': { '@_uri': '{ABC}' } };
		const result = runtime.extractOwnProperties({
			'a:pPr': { 'a:defRPr': defRPr, 'a:extLst': extLst },
		});

		expect(result!.paragraphDefaultRunPropertiesXml).toBe(defRPr);
		expect(result!.paragraphPropertiesExtLstXml).toBe(extLst);
	});

	it('returns undefined for a paragraph with no or an empty a:pPr', () => {
		expect(runtime.extractOwnProperties({})).toBeUndefined();
		expect(runtime.extractOwnProperties({ 'a:pPr': {} })).toBeUndefined();
	});

	it('leaves lvl to TextSegment.paragraphLevel rather than duplicating it', () => {
		const result = runtime.extractOwnProperties({ 'a:pPr': { '@_lvl': '2', '@_algn': 'r' } });
		expect(result).not.toHaveProperty('paragraphLevel');
		expect(parseParagraphLevel({ '@_lvl': '2' })).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// parseParagraphExtraAttributes (the shared parser the extractor delegates to)
// ---------------------------------------------------------------------------
describe('parseParagraphExtraAttributes', () => {
	it('returns an empty object for an absent node', () => {
		expect(parseParagraphExtraAttributes(undefined)).toStrictEqual({});
	});

	it('parses every attribute it owns', () => {
		expect(
			parseParagraphExtraAttributes({
				'@_defTabSz': '914400',
				'@_eaLnBrk': '1',
				'@_latinLnBrk': '0',
				'@_fontAlgn': 'base',
				'@_hangingPunct': '1',
			}),
		).toStrictEqual({
			defaultTabSize: 914400 / EMU_PER_PX,
			eaLineBreak: true,
			latinLineBreak: false,
			fontAlignment: 'base',
			hangingPunctuation: true,
		});
	});

	it('ignores a non-numeric defTabSz and a blank fontAlgn', () => {
		expect(
			parseParagraphExtraAttributes({ '@_defTabSz': 'abc', '@_fontAlgn': '  ' }),
		).toStrictEqual({});
	});
});

// ---------------------------------------------------------------------------
// parseAlignmentAttr
// ---------------------------------------------------------------------------
describe('parseAlignmentAttr', () => {
	it('returns undefined for an absent value', () => {
		expect(parseAlignmentAttr(undefined)).toBeUndefined();
	});

	it.each([
		['l', 'left'],
		['ctr', 'center'],
		['r', 'right'],
		['just', 'justify'],
		['justify', 'justify'],
		['justLow', 'justLow'],
		['dist', 'dist'],
		['thaiDist', 'thaiDist'],
	])('maps %s to %s', (token, expected) => {
		expect(parseAlignmentAttr(token)).toBe(expected);
	});

	it('returns undefined for an unknown token', () => {
		expect(parseAlignmentAttr('unknown')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// parseParagraphMargins / parseParagraphRtl
// ---------------------------------------------------------------------------
describe('parseParagraphMargins', () => {
	it('returns an empty object for an absent node', () => {
		expect(parseParagraphMargins(undefined)).toStrictEqual({});
	});

	it('converts EMU to pixels, including a negative hanging indent', () => {
		expect(parseParagraphMargins({ '@_marL': '457200', '@_indent': '-228600' })).toStrictEqual({
			paragraphMarginLeft: 457200 / EMU_PER_PX,
			paragraphIndent: -228600 / EMU_PER_PX,
		});
	});

	it('keeps a zero margin rather than treating it as absent', () => {
		expect(parseParagraphMargins({ '@_marL': '0' })).toStrictEqual({ paragraphMarginLeft: 0 });
	});

	it('skips a non-numeric value', () => {
		expect(parseParagraphMargins({ '@_marR': 'abc' })).toStrictEqual({});
	});
});

describe('parseParagraphRtl', () => {
	it('parses the flag in both directions and reports absence', () => {
		expect(parseParagraphRtl({ '@_rtl': '1' })).toBeTruthy();
		expect(parseParagraphRtl({ '@_rtl': '0' })).toBeFalsy();
		expect(parseParagraphRtl({ '@_rtl': '0' })).toBeDefined();
		expect(parseParagraphRtl({})).toBeUndefined();
		expect(parseParagraphRtl(undefined)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// parseTabStops
// ---------------------------------------------------------------------------
describe('parseTabStops', () => {
	it('returns undefined when there is no tab list', () => {
		expect(parseTabStops(undefined)).toBeUndefined();
		expect(parseTabStops({})).toBeUndefined();
		expect(parseTabStops({ 'a:tabLst': {} })).toBeUndefined();
	});

	it('parses a single tab stop', () => {
		const result = parseTabStops({ 'a:tabLst': { 'a:tab': { '@_pos': '914400', '@_algn': 'l' } } });
		expect(result).toHaveLength(1);
		expect(result![0].position).toBeCloseTo(914400 / EMU_PER_PX, 5);
		expect(result![0].align).toBe('l');
	});

	it('parses several tab stops with their alignments', () => {
		const result = parseTabStops({
			'a:tabLst': {
				'a:tab': [
					{ '@_pos': '914400', '@_algn': 'l' },
					{ '@_pos': '1828800', '@_algn': 'ctr' },
					{ '@_pos': '2743200', '@_algn': 'r' },
					{ '@_pos': '3657600', '@_algn': 'dec' },
				],
			},
		});
		expect(result!.map((t) => t.align)).toStrictEqual(['l', 'ctr', 'r', 'dec']);
	});

	it("defaults an unknown or missing alignment to 'l'", () => {
		expect(
			parseTabStops({ 'a:tabLst': { 'a:tab': { '@_pos': '1', '@_algn': 'x' } } })![0].align,
		).toBe('l');
		expect(parseTabStops({ 'a:tabLst': { 'a:tab': { '@_pos': '1' } } })![0].align).toBe('l');
	});

	it.each(['dot', 'hyphen', 'underscore'])('keeps the %s leader', (leader) => {
		const result = parseTabStops({ 'a:tabLst': { 'a:tab': { '@_pos': '1', '@_leader': leader } } });
		expect(result![0].leader).toBe(leader);
	});

	it('drops an unknown leader and a tab stop with no position', () => {
		expect(
			parseTabStops({ 'a:tabLst': { 'a:tab': { '@_pos': '1', '@_leader': 'none' } } })![0],
		).not.toHaveProperty('leader');
		expect(
			parseTabStops({ 'a:tabLst': { 'a:tab': [{ '@_algn': 'l' }, { '@_pos': '914400' }] } }),
		).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// parseParagraphLevel
// ---------------------------------------------------------------------------
describe('parseParagraphLevel', () => {
	it('defaults an absent or omitted lvl to 0', () => {
		expect(parseParagraphLevel(undefined)).toBe(0);
		expect(parseParagraphLevel({})).toBe(0);
	});

	it('reads a declared level and clamps out-of-range values to 0..8', () => {
		expect(parseParagraphLevel({ '@_lvl': '3' })).toBe(3);
		expect(parseParagraphLevel({ '@_lvl': '20' })).toBe(8);
		expect(parseParagraphLevel({ '@_lvl': '-5' })).toBe(0);
		expect(parseParagraphLevel({ '@_lvl': 'abc' })).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// resolveShapeParagraphStyle: per-paragraph alignment must not leak
// ---------------------------------------------------------------------------
describe('resolveShapeParagraphStyle alignment', () => {
	it("does not let an earlier paragraph's explicit alignment override a later paragraph's own placeholder-level alignment", () => {
		// Paragraph 0: explicit centered heading. Paragraph 1: no explicit algn,
		// but its own placeholder level (1) is left-aligned body bullets.
		const ctx = makeContext({
			effectiveLevelStyles: { 1: { alignment: 'left' } },
		});
		const textStyle: TextStyle = {};

		const first = runtime.resolveParagraphStyle({ 'a:pPr': { '@_algn': 'ctr' } }, textStyle, ctx);
		expect(first.paraAlign).toBe('center');

		const second = runtime.resolveParagraphStyle({ 'a:pPr': { '@_lvl': '1' } }, textStyle, ctx);
		expect(second.paraAlign).toBe('left');
	});

	it('falls back to the rtl-based default when neither the paragraph nor its placeholder level declares an alignment', () => {
		const ctx = makeContext();
		const rtl = runtime.resolveParagraphStyle({ 'a:pPr': { '@_rtl': '1' } }, {}, ctx);
		expect(rtl.paraAlign).toBe('right');
	});
});
