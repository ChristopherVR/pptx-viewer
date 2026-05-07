import { describe, it, expect } from 'vitest';

import type { TextStyle, TextSegment, XmlObject } from '../../types';
import {
	EMU_PER_PX,
	buildParagraphPropertiesXml,
	applyBulletProperties,
	assembleParagraphXml,
	computeUniformSegmentOverrides,
} from './PptxHandlerRuntimeSaveParagraphHelpers';
import type { ParagraphSpacingConfig } from './PptxHandlerRuntimeSaveParagraphHelpers';

// ---------------------------------------------------------------------------
// buildParagraphPropertiesXml
// ---------------------------------------------------------------------------
describe('buildParagraphPropertiesXml', () => {
	const emptySpacing: ParagraphSpacingConfig = {
		spacingBefore: undefined,
		spacingAfter: undefined,
		lineSpacing: undefined,
		lineSpacingExactPt: undefined,
	};

	it('should return empty object when all inputs are undefined/empty', () => {
		const result = buildParagraphPropertiesXml(undefined, undefined, undefined, emptySpacing);
		expect(result).toStrictEqual({});
	});

	it('should set alignment attribute', () => {
		const result = buildParagraphPropertiesXml(undefined, 'ctr', undefined, emptySpacing);
		expect(result['@_algn']).toBe('ctr');
	});

	it('should set rtl attribute from textStyle', () => {
		const result = buildParagraphPropertiesXml({ rtl: true }, undefined, undefined, emptySpacing);
		expect(result['@_rtl']).toBe('1');
	});

	it('should set rtl to 0 when false', () => {
		const result = buildParagraphPropertiesXml({ rtl: false }, undefined, undefined, emptySpacing);
		expect(result['@_rtl']).toBe('0');
	});

	it('should include spacingBefore when provided', () => {
		const spacing: ParagraphSpacingConfig = {
			...emptySpacing,
			spacingBefore: { 'a:spcPts': { '@_val': '1200' } },
		};
		const result = buildParagraphPropertiesXml(undefined, undefined, undefined, spacing);
		expect(result['a:spcBef']).toStrictEqual({ 'a:spcPts': { '@_val': '1200' } });
	});

	it('should include spacingAfter when provided', () => {
		const spacing: ParagraphSpacingConfig = {
			...emptySpacing,
			spacingAfter: { 'a:spcPts': { '@_val': '600' } },
		};
		const result = buildParagraphPropertiesXml(undefined, undefined, undefined, spacing);
		expect(result['a:spcAft']).toStrictEqual({ 'a:spcPts': { '@_val': '600' } });
	});

	it('should include lineSpacing when provided', () => {
		const spacing: ParagraphSpacingConfig = {
			...emptySpacing,
			lineSpacing: { 'a:spcPct': { '@_val': '120000' } },
		};
		const result = buildParagraphPropertiesXml(undefined, undefined, undefined, spacing);
		expect(result['a:lnSpc']).toStrictEqual({ 'a:spcPct': { '@_val': '120000' } });
	});

	it('should use lineSpacingExactPt as fallback when lineSpacing is undefined', () => {
		const spacing: ParagraphSpacingConfig = {
			...emptySpacing,
			lineSpacingExactPt: 14,
		};
		const result = buildParagraphPropertiesXml(undefined, undefined, undefined, spacing);
		expect(result['a:lnSpc']).toStrictEqual({
			'a:spcPts': { '@_val': String(Math.round(14 * 100)) },
		});
	});

	it('should prefer lineSpacing over lineSpacingExactPt', () => {
		const spacing: ParagraphSpacingConfig = {
			spacingBefore: undefined,
			spacingAfter: undefined,
			lineSpacing: { 'a:spcPct': { '@_val': '150000' } },
			lineSpacingExactPt: 14,
		};
		const result = buildParagraphPropertiesXml(undefined, undefined, undefined, spacing);
		expect(result['a:lnSpc']).toStrictEqual({ 'a:spcPct': { '@_val': '150000' } });
	});

	it('should convert paragraph margins from px to EMU', () => {
		const textStyle: TextStyle = {
			paragraphMarginLeft: 10,
			paragraphMarginRight: 5,
			paragraphIndent: 20,
		};
		const result = buildParagraphPropertiesXml(textStyle, undefined, undefined, emptySpacing);
		expect(result['@_marL']).toBe(String(Math.round(10 * EMU_PER_PX)));
		expect(result['@_marR']).toBe(String(Math.round(5 * EMU_PER_PX)));
		expect(result['@_indent']).toBe(String(Math.round(20 * EMU_PER_PX)));
	});

	it('should serialize tab stops with position, align, and leader', () => {
		const textStyle: TextStyle = {
			tabStops: [
				{ position: 100, align: 'ctr' },
				{ position: 200, align: 'r', leader: 'dot' },
			],
		};
		const result = buildParagraphPropertiesXml(textStyle, undefined, undefined, emptySpacing);
		const tabs = (result['a:tabLst'] as XmlObject)['a:tab'] as XmlObject[];
		expect(tabs).toHaveLength(2);
		expect(tabs[0]['@_pos']).toBe(String(Math.round(100 * EMU_PER_PX)));
		expect(tabs[0]['@_algn']).toBe('ctr');
		expect(tabs[0]['@_leader']).toBeUndefined();
		expect(tabs[1]['@_leader']).toBe('dot');
	});

	it("should omit left-aligned tab's algn attribute", () => {
		const textStyle: TextStyle = {
			tabStops: [{ position: 50, align: 'l' }],
		};
		const result = buildParagraphPropertiesXml(textStyle, undefined, undefined, emptySpacing);
		const tabs = (result['a:tabLst'] as XmlObject)['a:tab'] as XmlObject;
		expect(tabs['@_algn']).toBeUndefined();
	});

	it('should set defaultTabSize', () => {
		const result = buildParagraphPropertiesXml(
			{ defaultTabSize: 50 },
			undefined,
			undefined,
			emptySpacing,
		);
		expect(result['@_defTabSz']).toBe(String(Math.round(50 * EMU_PER_PX)));
	});

	it('should set eaLineBreak, latinLineBreak, fontAlignment, and hangingPunctuation', () => {
		const textStyle: TextStyle = {
			eaLineBreak: true,
			latinLineBreak: false,
			fontAlignment: 'base',
			hangingPunctuation: true,
		};
		const result = buildParagraphPropertiesXml(textStyle, undefined, undefined, emptySpacing);
		expect(result['@_eaLnBrk']).toBe('1');
		expect(result['@_latinLnBrk']).toBe('0');
		expect(result['@_fontAlgn']).toBe('base');
		expect(result['@_hangingPunct']).toBe('1');
	});
});

// ---------------------------------------------------------------------------
// applyBulletProperties
// ---------------------------------------------------------------------------
describe('applyBulletProperties', () => {
	it('should set buNone when bullet.none is true', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { none: true });
		expect(props['a:buNone']).toStrictEqual({});
		// Should return early — no other bullet props
		expect(props['a:buChar']).toBeUndefined();
	});

	it('should set bullet font', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { fontFamily: 'Wingdings' });
		expect(props['a:buFont']).toStrictEqual({ '@_typeface': 'Wingdings' });
	});

	it('should set bullet size percentage', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { sizePercent: 75 });
		expect(props['a:buSzPct']).toStrictEqual({
			'@_val': String(Math.round(75 * 1000)),
		});
	});

	it('should set bullet size in points', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { sizePts: 12 });
		expect(props['a:buSzPts']).toStrictEqual({
			'@_val': String(Math.round(12 * 100)),
		});
	});

	it('should set bullet color and strip # prefix', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { color: '#FF0000' });
		expect(props['a:buClr']).toStrictEqual({
			'a:srgbClr': { '@_val': 'FF0000' },
		});
	});

	it('should set bullet char', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { char: '\u2022' });
		expect(props['a:buChar']).toStrictEqual({ '@_char': '\u2022' });
	});

	it('should set auto-numbered bullet with type and start', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, {
			autoNumType: 'arabicPeriod',
			autoNumStartAt: 5,
		});
		const buAutoNum = props['a:buAutoNum'] as Record<string, unknown>;
		expect(buAutoNum['@_type']).toBe('arabicPeriod');
		expect(buAutoNum['@_startAt']).toBe('5');
	});

	it('should omit startAt when it equals 1', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, {
			autoNumType: 'romanUcPeriod',
			autoNumStartAt: 1,
		});
		const buAutoNum = props['a:buAutoNum'] as Record<string, unknown>;
		expect(buAutoNum['@_startAt']).toBeUndefined();
	});

	it('should set image bullet', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { imageRelId: 'rId5' });
		expect(props['a:buBlip']).toStrictEqual({
			'a:blip': { '@_r:embed': 'rId5' },
		});
	});
});

// ---------------------------------------------------------------------------
// assembleParagraphXml
// ---------------------------------------------------------------------------
describe('assembleParagraphXml', () => {
	it('should include endParaRPr and paragraph properties', () => {
		const pProps: XmlObject = { '@_algn': 'ctr' };
		const result = assembleParagraphXml([], pProps);
		expect(result['a:endParaRPr']).toStrictEqual({ '@_lang': 'en-US' });
		expect(result['a:pPr']).toBe(pProps);
	});

	it('should unwrap a single regular run', () => {
		const run: XmlObject = {
			'a:rPr': { '@_lang': 'en-US' },
			'a:t': 'Hello',
		};
		const result = assembleParagraphXml([run], {});
		expect(result['a:r']).toStrictEqual(run);
	});

	it('should keep multiple regular runs as array', () => {
		const run1: XmlObject = { 'a:t': 'Hello ' };
		const run2: XmlObject = { 'a:t': 'World' };
		const result = assembleParagraphXml([run1, run2], {});
		expect(result['a:r']).toStrictEqual([run1, run2]);
	});

	it('should separate field runs from regular runs', () => {
		const regular: XmlObject = { 'a:t': 'text' };
		const field: XmlObject = {
			__isField: true,
			'@_type': 'slidenum',
			'a:t': '1',
		};
		const result = assembleParagraphXml([regular, field], {});
		expect(result['a:r']).toStrictEqual(regular);
		// Field run should have __isField stripped
		const fld = result['a:fld'] as XmlObject;
		expect(fld['@_type']).toBe('slidenum');
		expect(fld['__isField']).toBeUndefined();
	});

	it('should handle multiple field runs as array', () => {
		const f1: XmlObject = { __isField: true, '@_type': 'a' };
		const f2: XmlObject = { __isField: true, '@_type': 'b' };
		const result = assembleParagraphXml([f1, f2], {});
		expect(Array.isArray(result['a:fld'])).toBeTruthy();
		expect(result['a:fld'] as XmlObject[]).toHaveLength(2);
	});

	it('should fall back to a:r when no regular or field runs', () => {
		const result = assembleParagraphXml([], {});
		expect(result['a:r']).toBeUndefined();
	});

	it('should emit a:br for line-break runs and strip the marker', () => {
		const text: XmlObject = { 'a:t': 'Hello' };
		const br: XmlObject = {
			__isLineBreak: true,
			'a:rPr': { '@_lang': 'en-US' },
		};
		const result = assembleParagraphXml([text, br], {});
		expect(result['a:r']).toStrictEqual(text);
		const brOut = result['a:br'] as XmlObject;
		expect(brOut['__isLineBreak']).toBeUndefined();
		expect(brOut['a:rPr']).toStrictEqual({ '@_lang': 'en-US' });
	});

	it('should keep multiple a:br as array', () => {
		const br1: XmlObject = { __isLineBreak: true };
		const br2: XmlObject = { __isLineBreak: true };
		const result = assembleParagraphXml([br1, br2], {});
		expect(Array.isArray(result['a:br'])).toBeTruthy();
		expect(result['a:br'] as XmlObject[]).toHaveLength(2);
	});

	it('should re-emit m:oMath equation runs verbatim', () => {
		const equationXml = {
			'm:oMath': { 'm:r': { 'm:t': 'x^2' } },
		};
		const equationRun: XmlObject = {
			__isEquation: true,
			__equationXml: equationXml,
		};
		const result = assembleParagraphXml([equationRun], {});
		expect(result['m:oMath']).toStrictEqual({ 'm:r': { 'm:t': 'x^2' } });
		// Marker keys should not leak into the paragraph output.
		expect(result['__isEquation']).toBeUndefined();
		expect(result['__equationXml']).toBeUndefined();
	});

	it('should re-emit m:oMathPara equation runs verbatim', () => {
		const oMathParaNode = { 'm:oMath': { 'm:r': { 'm:t': 'a+b' } } };
		const equationXml = { 'm:oMathPara': oMathParaNode };
		const equationRun: XmlObject = {
			__isEquation: true,
			__equationXml: equationXml,
		};
		const result = assembleParagraphXml([equationRun], {});
		expect(result['m:oMathPara']).toStrictEqual(oMathParaNode);
	});

	it('should re-emit mc:AlternateContent equation wrappers verbatim', () => {
		const acNode = {
			'mc:Choice': { '@_Requires': 'a14', 'a14:m': { 'm:oMath': {} } },
			'mc:Fallback': { 'a:r': { 'a:t': '[Equation]' } },
		};
		const equationXml = { 'mc:AlternateContent': acNode };
		const equationRun: XmlObject = {
			__isEquation: true,
			__equationXml: equationXml,
		};
		const result = assembleParagraphXml([equationRun], {});
		expect(result['mc:AlternateContent']).toStrictEqual(acNode);
	});

	it('buildParagraphPropertiesXml emits a:lnSpc before a:spcBef before a:spcAft', () => {
		// CT_TextParagraphProperties schema order for spacing children:
		//   lnSpc, spcBef, spcAft. Out-of-order emission yields
		//   Sch_UnexpectedElementContentExpectingComplex when PowerPoint
		//   or any schema validator reads the file.
		const result = buildParagraphPropertiesXml(undefined, undefined, undefined, {
			spacingBefore: { 'a:spcPct': { '@_val': '20000' } },
			spacingAfter: { 'a:spcPct': { '@_val': '10000' } },
			lineSpacing: { 'a:spcPct': { '@_val': '150000' } },
			lineSpacingExactPt: undefined,
		});
		const keys = Object.keys(result).filter((k) => !k.startsWith('@_'));
		const lnSpcIdx = keys.indexOf('a:lnSpc');
		const spcBefIdx = keys.indexOf('a:spcBef');
		const spcAftIdx = keys.indexOf('a:spcAft');
		expect(lnSpcIdx).toBeGreaterThanOrEqual(0);
		expect(spcBefIdx).toBeGreaterThan(lnSpcIdx);
		expect(spcAftIdx).toBeGreaterThan(spcBefIdx);
	});

	it('preserves parsed endParaRPr verbatim when supplied', () => {
		const parsedEnd: Record<string, unknown> = {
			'@_lang': 'fr-FR',
			'@_dirty': '0',
			'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
		};
		const result = assembleParagraphXml([], {}, parsedEnd);
		expect(result['a:endParaRPr']).toBe(parsedEnd);
	});

	it('falls back to en-US stub when no parsed endParaRPr supplied', () => {
		const result = assembleParagraphXml([], {});
		expect(result['a:endParaRPr']).toStrictEqual({ '@_lang': 'en-US' });
	});

	it('buildParagraphPropertiesXml emits @_lvl when level > 0', () => {
		const result = buildParagraphPropertiesXml(
			undefined,
			undefined,
			undefined,
			{
				spacingBefore: undefined,
				spacingAfter: undefined,
				lineSpacing: undefined,
				lineSpacingExactPt: undefined,
			},
			3,
		);
		expect(result['@_lvl']).toBe('3');
	});

	it('buildParagraphPropertiesXml omits @_lvl when level is 0 or undefined', () => {
		const spacing = {
			spacingBefore: undefined,
			spacingAfter: undefined,
			lineSpacing: undefined,
			lineSpacingExactPt: undefined,
		};
		const zeroLevel = buildParagraphPropertiesXml(undefined, undefined, undefined, spacing, 0);
		expect(zeroLevel['@_lvl']).toBeUndefined();
		const undefinedLevel = buildParagraphPropertiesXml(
			undefined,
			undefined,
			undefined,
			spacing,
			undefined,
		);
		expect(undefinedLevel['@_lvl']).toBeUndefined();
	});

	it('buildParagraphPropertiesXml clamps level to [0, 8]', () => {
		const spacing = {
			spacingBefore: undefined,
			spacingAfter: undefined,
			lineSpacing: undefined,
			lineSpacingExactPt: undefined,
		};
		const high = buildParagraphPropertiesXml(undefined, undefined, undefined, spacing, 99);
		expect(high['@_lvl']).toBe('8');
	});

	it('should emit children in schema order: a:pPr, a:r/a:fld, a:endParaRPr', () => {
		// OOXML CT_TextParagraph requires children in order:
		//   pPr? , (r | br | fld)* , endParaRPr?
		// fast-xml-parser serialises object keys in insertion order, so the
		// key order of the returned paragraph object IS the emitted XML order.
		const run: XmlObject = { 'a:rPr': { '@_lang': 'en-US' }, 'a:t': 'text' };
		const result = assembleParagraphXml([run], { '@_algn': 'ctr' });
		const keys = Object.keys(result).filter((k) => !k.startsWith('@_'));
		const pPrIdx = keys.indexOf('a:pPr');
		const runIdx = keys.indexOf('a:r');
		const endIdx = keys.indexOf('a:endParaRPr');
		expect(pPrIdx).toBeGreaterThanOrEqual(0);
		expect(runIdx).toBeGreaterThan(pPrIdx);
		expect(endIdx).toBeGreaterThan(runIdx);
	});
});

// ---------------------------------------------------------------------------
// computeUniformSegmentOverrides
// ---------------------------------------------------------------------------
describe('computeUniformSegmentOverrides', () => {
	it('should return empty object when textStyle is undefined', () => {
		const segments: TextSegment[] = [
			{ text: 'a', style: { bold: true } },
			{ text: 'b', style: { bold: true } },
		];
		const result = computeUniformSegmentOverrides(undefined, segments);
		expect(result).toStrictEqual({});
	});

	it('should return override when all segments share the same value', () => {
		const segments: TextSegment[] = [
			{ text: 'a', style: { fontFamily: 'Arial' } },
			{ text: 'b', style: { fontFamily: 'Arial' } },
		];
		const result = computeUniformSegmentOverrides({ fontFamily: 'Helvetica' }, segments);
		expect(result.fontFamily).toBe('Helvetica');
	});

	it('should not return override when segments differ', () => {
		const segments: TextSegment[] = [
			{ text: 'a', style: { bold: true } },
			{ text: 'b', style: { bold: false } },
		];
		const result = computeUniformSegmentOverrides({ bold: true }, segments);
		expect(result.bold).toBeUndefined();
	});

	it('should handle fontSize override', () => {
		const segments: TextSegment[] = [
			{ text: 'a', style: { fontSize: 12 } },
			{ text: 'b', style: { fontSize: 12 } },
		];
		const result = computeUniformSegmentOverrides({ fontSize: 16 }, segments);
		expect(result.fontSize).toBe(16);
	});

	it('should handle color override', () => {
		const segments: TextSegment[] = [
			{ text: 'a', style: { color: '#000' } },
			{ text: 'b', style: { color: '#000' } },
		];
		const result = computeUniformSegmentOverrides({ color: '#FF0000' }, segments);
		expect(result.color).toBe('#FF0000');
	});

	it('should handle align override', () => {
		const segments: TextSegment[] = [
			{ text: 'a', style: { align: 'left' } },
			{ text: 'b', style: { align: 'left' } },
		];
		const result = computeUniformSegmentOverrides({ align: 'center' }, segments);
		expect(result.align).toBe('center');
	});

	it('should handle multiple uniform keys', () => {
		const segments: TextSegment[] = [
			{ text: 'a', style: { bold: true, italic: false } },
			{ text: 'b', style: { bold: true, italic: false } },
		];
		const result = computeUniformSegmentOverrides({ bold: false, italic: true }, segments);
		expect(result.bold).toBeFalsy();
		expect(result.italic).toBeTruthy();
	});

	it('should handle empty segments array', () => {
		const result = computeUniformSegmentOverrides({ bold: true }, []);
		// With empty segments, every(segment => ...) returns true vacuously
		expect(result.bold).toBeTruthy();
	});
});
