/**
 * Regression coverage for the text/run/paragraph/font fidelity cluster:
 *   - #68 table cell rich text preserved (not flattened to one plain run)
 *   - #69 per-paragraph a:pPr emitted per paragraph (not collapsed)
 *   - #83 per-script theme fonts populate byScript + script fallback
 *   - #84 theme font tokens preserved; ea/cs not force-synthesised
 *   - #85 underline a:uLn / a:uLnTx / a:uFillTx round-trip
 *
 * These drive the real `PptxHandlerRuntime` methods (via a thin subclass that
 * exposes the otherwise-protected methods), so they exercise the shipped code
 * rather than a reimplementation.
 */
import { describe, it, expect } from 'vitest';

import type { TextSegment, TextStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';
import { flattenCellTxBodyText, isRichCellTxBody } from './PptxHandlerRuntimeSaveTableStyles';

function ensureArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? (value as XmlObject[]) : [value as XmlObject];
}

class TestRuntime extends PptxHandlerRuntime {
	public seedThemeFonts(fontMap: Record<string, string>): void {
		(this as unknown as { themeFontMap: Record<string, string> }).themeFontMap = fontMap;
	}

	public seedMinorFontScripts(themePath: string, overrides: Record<string, string>): void {
		(
			this as unknown as { masterThemeMinorFontScripts: Map<string, Record<string, string>> }
		).masterThemeMinorFontScripts.set(themePath, overrides);
	}

	public runWriteTableCellText(cell: XmlObject, text: string): void {
		(this as unknown as { writeTableCellText(c: XmlObject, t: string): void }).writeTableCellText(
			cell,
			text,
		);
	}

	public runWriteTableCellStyle(cell: XmlObject, style: Record<string, unknown>): void {
		(
			this as unknown as { writeTableCellStyle(c: XmlObject, s: Record<string, unknown>): void }
		).writeTableCellStyle(cell, style);
	}

	public runExtractTextRunStyle(rPr: XmlObject | undefined): TextStyle {
		return (
			this as unknown as {
				extractTextRunStyle(r: XmlObject | undefined, a: TextStyle['align']): TextStyle;
			}
		).extractTextRunStyle(rPr, undefined);
	}

	public runCreateRunProps(style: TextStyle): XmlObject {
		return (
			this as unknown as {
				createRunPropertiesFromTextStyle(s: TextStyle): XmlObject;
			}
		).createRunPropertiesFromTextStyle(style);
	}

	public runBuildThemeObject(): unknown {
		return (this as unknown as { buildThemeObject(): unknown }).buildThemeObject();
	}

	public runResolveScriptFallbackFont(text: string): string | undefined {
		return (
			this as unknown as { resolveScriptFallbackFont(t: string): string | undefined }
		).resolveScriptFallbackFont(text);
	}

	public runExtractParagraphOwnProperties(
		p: XmlObject,
		basisFontSize: number | undefined,
	): TextStyle | undefined {
		return (
			this as unknown as {
				extractParagraphOwnProperties(x: XmlObject, b: number | undefined): TextStyle | undefined;
			}
		).extractParagraphOwnProperties(p, basisFontSize);
	}

	public runCreateParagraphs(
		text: string | undefined,
		style: TextStyle | undefined,
		segments: TextSegment[] | undefined,
	): XmlObject[] {
		return (
			this as unknown as {
				createParagraphsFromTextContent(
					t: string | undefined,
					s: TextStyle | undefined,
					seg: TextSegment[] | undefined,
				): XmlObject[];
			}
		).createParagraphsFromTextContent(text, style, segments);
	}
}

// ===========================================================================
// #68 — table cell rich text preservation
// ===========================================================================

describe('#68 table cell rich text', () => {
	/** A two-run cell: bold "Hello " + hyperlinked "link". */
	function richCell(): XmlObject {
		return {
			'a:txBody': {
				'a:bodyPr': {},
				'a:p': {
					'a:r': [
						{ 'a:rPr': { '@_b': '1' }, 'a:t': 'Hello ' },
						{ 'a:rPr': { 'a:hlinkClick': { '@_r:id': 'rId5' } }, 'a:t': 'link' },
					],
				},
			},
		};
	}

	it('flattens a multi-run cell to the parser plain string', () => {
		expect(flattenCellTxBodyText(richCell()['a:txBody'] as XmlObject, ensureArray)).toBe(
			'Hello link',
		);
	});

	it('detects a rich (multi-run / hyperlinked) cell', () => {
		expect(isRichCellTxBody(richCell()['a:txBody'] as XmlObject, ensureArray)).toBeTruthy();
		const plain: XmlObject = { 'a:p': { 'a:r': { 'a:rPr': {}, 'a:t': 'plain' } } };
		expect(isRichCellTxBody(plain, ensureArray)).toBeFalsy();
	});

	it('detects a field-bearing cell as rich', () => {
		const withField: XmlObject = {
			'a:p': { 'a:fld': { '@_type': 'slidenum', 'a:t': '3' } },
		};
		expect(isRichCellTxBody(withField, ensureArray)).toBeTruthy();
	});

	it('preserves the multi-run structure when the cell text is unchanged', () => {
		const runtime = new TestRuntime();
		const cell = richCell();
		runtime.runWriteTableCellText(cell, 'Hello link');
		const runs = ensureArray(((cell['a:txBody'] as XmlObject)['a:p'] as XmlObject)['a:r']);
		expect(runs).toHaveLength(2);
		expect((runs[0]['a:rPr'] as XmlObject)['@_b']).toBe('1');
		expect((runs[1]['a:rPr'] as XmlObject)['a:hlinkClick']).toBeDefined();
	});

	it('rebuilds a single run when the cell text was edited', () => {
		const runtime = new TestRuntime();
		const cell = richCell();
		runtime.runWriteTableCellText(cell, 'Changed');
		const p = (cell['a:txBody'] as XmlObject)['a:p'] as XmlObject;
		const runs = ensureArray(p['a:r']);
		expect(runs).toHaveLength(1);
		expect((runs[0] as XmlObject)['a:t']).toBe('Changed');
	});

	it('does not stamp the cell-level font over every run of a rich cell', () => {
		const runtime = new TestRuntime();
		const cell = richCell();
		// A parsed cell style captured from the first (bold) run must not be
		// re-applied to the hyperlinked second run.
		runtime.runWriteTableCellStyle(cell, { bold: true });
		const runs = ensureArray(((cell['a:txBody'] as XmlObject)['a:p'] as XmlObject)['a:r']);
		expect((runs[1]['a:rPr'] as XmlObject)['@_b']).toBeUndefined();
		expect((runs[1]['a:rPr'] as XmlObject)['a:hlinkClick']).toBeDefined();
	});
});

// ===========================================================================
// #69 — per-paragraph pPr
// ===========================================================================

describe('#69 per-paragraph pPr', () => {
	it('parses a paragraph-own pPr into per-paragraph properties', () => {
		const runtime = new TestRuntime();
		const pp = runtime.runExtractParagraphOwnProperties(
			{ 'a:pPr': { '@_algn': 'r', '@_marL': '457200' } },
			12,
		);
		expect(pp?.align).toBe('right');
		expect(pp?.paragraphMarginLeft).toBeCloseTo(48, 5);
	});

	it('returns undefined when the paragraph has no own pPr', () => {
		const runtime = new TestRuntime();
		expect(runtime.runExtractParagraphOwnProperties({ 'a:r': {} }, undefined)).toBeUndefined();
	});

	it('emits each paragraph its own alignment instead of one shape-level algn', () => {
		const runtime = new TestRuntime();
		const segments: TextSegment[] = [
			{ text: 'Left', style: {}, paragraphProperties: { align: 'left' } },
			{ text: '\n', style: {} },
			{ text: 'Right', style: {}, paragraphProperties: { align: 'right' } },
		];
		const paragraphs = runtime.runCreateParagraphs(undefined, {}, segments);
		expect(paragraphs.length).toBeGreaterThanOrEqual(2);
		const first = paragraphs[0]['a:pPr'] as XmlObject;
		const last = paragraphs[paragraphs.length - 1]['a:pPr'] as XmlObject;
		expect(first['@_algn']).toBe('l');
		expect(last['@_algn']).toBe('r');
	});
});

// ===========================================================================
// #83 — per-script theme fonts
// ===========================================================================

describe('#83 per-script theme fonts', () => {
	it('populates byScript on the built theme font groups', () => {
		const runtime = new TestRuntime();
		runtime.seedThemeFonts({ 'mn-lt': 'Calibri', 'mj-lt': 'Calibri Light' });
		runtime.seedMinorFontScripts('ppt/theme/theme1.xml', {
			Hans: 'DengXian',
			Arab: 'Traditional Arabic',
		});
		const theme = runtime.runBuildThemeObject() as {
			fontScheme?: { minorFont?: { byScript?: Record<string, string> } };
		};
		expect(theme.fontScheme?.minorFont?.byScript?.['Hans']).toBe('DengXian');
		expect(theme.fontScheme?.minorFont?.byScript?.['Arab']).toBe('Traditional Arabic');
	});

	it('resolves a CJK run to the themed script font', () => {
		const runtime = new TestRuntime();
		runtime.seedMinorFontScripts('ppt/theme/theme1.xml', { Hans: 'DengXian' });
		expect(runtime.runResolveScriptFallbackFont('你好世界')).toBe('DengXian');
	});

	it('does not apply a fallback for Latin text or when no overrides exist', () => {
		const runtime = new TestRuntime();
		runtime.seedMinorFontScripts('ppt/theme/theme1.xml', { Hans: 'DengXian' });
		expect(runtime.runResolveScriptFallbackFont('hello world')).toBeUndefined();
		const empty = new TestRuntime();
		expect(empty.runResolveScriptFallbackFont('你好')).toBeUndefined();
	});
});

// ===========================================================================
// #84 — theme font tokens + ea/cs synthesis
// ===========================================================================

describe('#84 theme font token preservation', () => {
	it('preserves the +mn-lt token linkage on parse while resolving fontFamily', () => {
		const runtime = new TestRuntime();
		runtime.seedThemeFonts({ 'mn-lt': 'Calibri' });
		const style = runtime.runExtractTextRunStyle({ 'a:latin': { '@_typeface': '+mn-lt' } });
		expect(style.fontFamily).toBe('Calibri');
		expect(style.latinFontThemeToken).toBe('+mn-lt');
	});

	it('re-emits the theme token rather than the flattened face', () => {
		const runtime = new TestRuntime();
		const rPr = runtime.runCreateRunProps({ fontFamily: 'Calibri', latinFontThemeToken: '+mn-lt' });
		expect((rPr['a:latin'] as XmlObject)['@_typeface']).toBe('+mn-lt');
	});

	it('does not synthesise a:ea / a:cs when the source run lacked them', () => {
		const runtime = new TestRuntime();
		const rPr = runtime.runCreateRunProps({ fontFamily: 'Calibri' });
		expect((rPr['a:latin'] as XmlObject)['@_typeface']).toBe('Calibri');
		expect(rPr['a:ea']).toBeUndefined();
		expect(rPr['a:cs']).toBeUndefined();
	});

	it('still emits a:ea / a:cs when the source run carried them', () => {
		const runtime = new TestRuntime();
		const rPr = runtime.runCreateRunProps({
			fontFamily: 'Calibri',
			eastAsiaFont: 'MS Gothic',
			complexScriptFont: 'Arial',
		});
		expect((rPr['a:ea'] as XmlObject)['@_typeface']).toBe('MS Gothic');
		expect((rPr['a:cs'] as XmlObject)['@_typeface']).toBe('Arial');
	});
});

// ===========================================================================
// #85 — underline line styling
// ===========================================================================

describe('#85 underline a:uLn / a:uLnTx / a:uFillTx', () => {
	it('parses a:uLn width and dash into underlineLine', () => {
		const runtime = new TestRuntime();
		const style = runtime.runExtractTextRunStyle({
			'@_u': 'sng',
			'a:uLn': { '@_w': '12700', 'a:prstDash': { '@_val': 'dash' } },
		});
		expect(style.underlineLine?.widthEmu).toBe(12700);
		expect(style.underlineLine?.prstDash).toBe('dash');
	});

	it('parses the follows-text markers', () => {
		const runtime = new TestRuntime();
		const style = runtime.runExtractTextRunStyle({ '@_u': 'sng', 'a:uLnTx': {}, 'a:uFillTx': {} });
		expect(style.underlineLineFollowsText).toBeTruthy();
		expect(style.underlineFillFollowsText).toBeTruthy();
	});

	it('serialises a styled underline line back to a:uLn', () => {
		const runtime = new TestRuntime();
		const rPr = runtime.runCreateRunProps({
			underline: true,
			underlineLine: { widthEmu: 12700, prstDash: 'dash' },
		});
		const uLn = rPr['a:uLn'] as XmlObject;
		expect(uLn['@_w']).toBe('12700');
		expect((uLn['a:prstDash'] as XmlObject)['@_val']).toBe('dash');
	});

	it('round-trips a styled underline through parse and save', () => {
		const runtime = new TestRuntime();
		const parsed = runtime.runExtractTextRunStyle({
			'@_u': 'sng',
			'a:uLn': { '@_w': '19050', 'a:prstDash': { '@_val': 'sysDot' } },
		});
		const rPr = runtime.runCreateRunProps(parsed);
		const uLn = rPr['a:uLn'] as XmlObject;
		expect(uLn['@_w']).toBe('19050');
		expect((uLn['a:prstDash'] as XmlObject)['@_val']).toBe('sysDot');
	});

	it('emits a:uLnTx / a:uFillTx for the follows-text markers', () => {
		const runtime = new TestRuntime();
		const rPr = runtime.runCreateRunProps({
			underline: true,
			underlineLineFollowsText: true,
			underlineFillFollowsText: true,
		});
		expect(rPr['a:uLnTx']).toBeDefined();
		expect(rPr['a:uFillTx']).toBeDefined();
	});
});
