/**
 * Issue #98 (Low tracker) text-run / colour round-trip regressions.
 *
 * Drives the real `PptxHandlerRuntime` methods via a thin subclass that
 * exposes the otherwise-protected parse/save helpers, so the shipped code is
 * exercised rather than a reimplementation.
 *
 *   1. explicit `u="none"` / `cap="none"` round-trip
 *   2. `a:fld` `@uuid` spelling + per-field `a:pPr` round-trip
 *   3. themed (`schemeClr`) run highlight preserved (not flattened to srgb)
 *   4. hyperlink `a:snd` (click + mouse-over) round-trip
 *   5. `a:pPr/a:defRPr` + run/paragraph `a:extLst` round-trip
 */
import { describe, it, expect } from 'vitest';

import type { TextSegment, TextStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

type HyperlinkResolver = (target: string) => string | undefined;

class TestRuntime extends PptxHandlerRuntime {
	public parseRun(rPr: XmlObject | undefined): TextStyle {
		return (
			this as unknown as {
				extractTextRunStyle(r: XmlObject | undefined, a: TextStyle['align']): TextStyle;
			}
		).extractTextRunStyle(rPr, undefined);
	}

	public saveRun(style: TextStyle, resolve?: HyperlinkResolver): XmlObject {
		return (
			this as unknown as {
				createRunPropertiesFromTextStyle(s: TextStyle, r?: HyperlinkResolver): XmlObject;
			}
		).createRunPropertiesFromTextStyle(style, resolve);
	}

	public parsePpr(p: XmlObject, basis: number | undefined): TextStyle | undefined {
		return (
			this as unknown as {
				extractParagraphOwnProperties(x: XmlObject, b: number | undefined): TextStyle | undefined;
			}
		).extractParagraphOwnProperties(p, basis);
	}

	public saveParagraphs(
		style: TextStyle | undefined,
		segments: TextSegment[] | undefined,
		resolve?: HyperlinkResolver,
	): XmlObject[] {
		return (
			this as unknown as {
				createParagraphsFromTextContent(
					t: string | undefined,
					s: TextStyle | undefined,
					seg: TextSegment[] | undefined,
					r?: HyperlinkResolver,
				): XmlObject[];
			}
		).createParagraphsFromTextContent(undefined, style, segments, resolve);
	}
}

// ===========================================================================
// 1. explicit u="none" / cap="none"
// ===========================================================================

describe('#98 explicit u="none" / cap="none"', () => {
	it('parses u="none" as an explicit suppression (not just underline=false)', () => {
		const style = new TestRuntime().parseRun({ '@_u': 'none' });
		expect(style.underline).toBeFalsy();
		expect(style.underlineExplicitNone).toBeTruthy();
	});

	it('re-emits u="none" from the explicit-none flag', () => {
		expect(new TestRuntime().saveRun({ underlineExplicitNone: true })['@_u']).toBe('none');
	});

	it('does not emit u="none" for an inherited (absent) underline', () => {
		expect(new TestRuntime().saveRun({})['@_u']).toBeUndefined();
	});

	it('round-trips cap="none" through parse and save', () => {
		const runtime = new TestRuntime();
		const style = runtime.parseRun({ '@_cap': 'none' });
		expect(style.textCaps).toBe('none');
		expect(style.textCapsExplicitNone).toBeTruthy();
		expect(runtime.saveRun(style)['@_cap']).toBe('none');
	});
});

// ===========================================================================
// 2. a:fld @uuid + per-field a:pPr
// ===========================================================================

describe('#98 a:fld @uuid + per-field a:pPr', () => {
	it('round-trips the @uuid spelling and per-field a:pPr in schema order', () => {
		const segments: TextSegment[] = [
			{
				text: '3',
				style: {},
				fieldType: 'slidenum',
				fieldGuid: '{ABC}',
				fieldGuidAttr: 'uuid',
				fieldParagraphPropertiesXml: { '@_algn': 'ctr' },
			},
		];
		const fld = new TestRuntime().saveParagraphs({}, segments)[0]['a:fld'] as XmlObject;
		expect(fld['@_uuid']).toBe('{ABC}');
		expect(fld['@_id']).toBeUndefined();
		expect(fld['a:pPr']).toStrictEqual({ '@_algn': 'ctr' });
		// CT_TextField child order: rPr, pPr, t.
		const keys = Object.keys(fld);
		expect(keys.indexOf('a:rPr')).toBeLessThan(keys.indexOf('a:pPr'));
		expect(keys.indexOf('a:pPr')).toBeLessThan(keys.indexOf('a:t'));
	});

	it('emits the canonical @id when the source used @id', () => {
		const segments: TextSegment[] = [
			{ text: '5', style: {}, fieldType: 'slidenum', fieldGuid: '{DEF}', fieldGuidAttr: 'id' },
		];
		const fld = new TestRuntime().saveParagraphs({}, segments)[0]['a:fld'] as XmlObject;
		expect(fld['@_id']).toBe('{DEF}');
		expect(fld['@_uuid']).toBeUndefined();
	});
});

// ===========================================================================
// 3. themed run highlight
// ===========================================================================

describe('#98 themed run highlight', () => {
	it('preserves a schemeClr highlight choice through parse and save', () => {
		const runtime = new TestRuntime();
		const style = runtime.parseRun({ 'a:highlight': { 'a:schemeClr': { '@_val': 'accent2' } } });
		expect(style.highlightColorXml).toStrictEqual({ 'a:schemeClr': { '@_val': 'accent2' } });
		expect(style.highlightColor).toBeTruthy();
		expect(runtime.saveRun(style)['a:highlight']).toStrictEqual({
			'a:schemeClr': { '@_val': 'accent2' },
		});
	});

	it('falls back to a canonical srgbClr for a plain hex highlight', () => {
		const highlight = new TestRuntime().saveRun({ highlightColor: '#FFFF00' })[
			'a:highlight'
		] as XmlObject;
		expect(highlight['a:srgbClr']).toStrictEqual({ '@_val': 'FFFF00' });
	});
});

// ===========================================================================
// 4. hyperlink a:snd
// ===========================================================================

describe('#98 hyperlink a:snd', () => {
	it('parses the a:snd child of a:hlinkClick', () => {
		const style = new TestRuntime().parseRun({
			'a:hlinkClick': { '@_r:id': 'rId1', 'a:snd': { '@_r:embed': 'rId9', '@_name': 'ding.wav' } },
		});
		expect(style.hyperlinkSoundXml).toStrictEqual({ '@_r:embed': 'rId9', '@_name': 'ding.wav' });
	});

	it('re-emits the a:snd child on the a:hlinkClick node', () => {
		const runProps = new TestRuntime().saveRun(
			{ hyperlink: 'http://x', hyperlinkSoundXml: { '@_r:embed': 'rId9', '@_name': 'ding.wav' } },
			() => 'rId1',
		);
		const hlink = runProps['a:hlinkClick'] as XmlObject;
		expect(hlink['@_r:id']).toBe('rId1');
		expect(hlink['a:snd']).toStrictEqual({ '@_r:embed': 'rId9', '@_name': 'ding.wav' });
	});

	it('re-emits the a:snd child on the a:hlinkMouseOver node (was r:id-only)', () => {
		const runProps = new TestRuntime().saveRun(
			{ hyperlinkMouseOver: 'http://y', hyperlinkMouseOverSoundXml: { '@_r:embed': 'rId8' } },
			() => 'rId2',
		);
		const mouseOver = runProps['a:hlinkMouseOver'] as XmlObject;
		expect(mouseOver['@_r:id']).toBe('rId2');
		expect(mouseOver['a:snd']).toStrictEqual({ '@_r:embed': 'rId8' });
	});
});

// ===========================================================================
// 5. a:pPr/a:defRPr + run / paragraph a:extLst
// ===========================================================================

describe('#98 defRPr + extLst preservation', () => {
	it('captures paragraph a:defRPr and a:extLst on parse', () => {
		const pp = new TestRuntime().parsePpr(
			{ 'a:pPr': { 'a:defRPr': { '@_sz': '1400' }, 'a:extLst': { 'a:ext': { '@_uri': '{X}' } } } },
			12,
		);
		expect(pp?.paragraphDefaultRunPropertiesXml).toStrictEqual({ '@_sz': '1400' });
		expect(pp?.paragraphPropertiesExtLstXml).toStrictEqual({ 'a:ext': { '@_uri': '{X}' } });
	});

	it('re-emits paragraph a:defRPr and a:extLst on save', () => {
		const segments: TextSegment[] = [
			{
				text: 'x',
				style: {},
				paragraphProperties: {
					paragraphDefaultRunPropertiesXml: { '@_sz': '1400' },
					paragraphPropertiesExtLstXml: { 'a:ext': { '@_uri': '{X}' } },
				},
			},
		];
		const pPr = new TestRuntime().saveParagraphs({}, segments)[0]['a:pPr'] as XmlObject;
		expect(pPr['a:defRPr']).toStrictEqual({ '@_sz': '1400' });
		expect(pPr['a:extLst']).toStrictEqual({ 'a:ext': { '@_uri': '{X}' } });
	});

	it('round-trips a run-level a:extLst through parse and save', () => {
		const runtime = new TestRuntime();
		const style = runtime.parseRun({ 'a:extLst': { 'a:ext': { '@_uri': '{R}' } } });
		expect(style.runPropertiesExtLstXml).toStrictEqual({ 'a:ext': { '@_uri': '{R}' } });
		expect(runtime.saveRun(style)['a:extLst']).toStrictEqual({ 'a:ext': { '@_uri': '{R}' } });
	});

	it('does not capture a defRPr default-style extLst as a run extLst', () => {
		// The defRPr / level default passes call extractTextRunStyle with
		// includeDefaultAlignment=false; capturing here would leak onto runs.
		const style = (
			new TestRuntime() as unknown as {
				extractTextRunStyle(
					r: XmlObject | undefined,
					a: TextStyle['align'],
					m: Map<string, string> | undefined,
					includeDefaultAlignment: boolean,
				): TextStyle;
			}
		).extractTextRunStyle(
			{ 'a:extLst': { 'a:ext': { '@_uri': '{D}' } } },
			undefined,
			undefined,
			false,
		);
		expect(style.runPropertiesExtLstXml).toBeUndefined();
	});
});
