import { describe, it, expect } from 'vitest';

import type { TextStyle, TextSegment, XmlObject } from '../../types';
import { createAutoNumberSequence } from './auto-number-sequence';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';
import {
	EMU_PER_PX,
	buildParagraphPropertiesXml,
	applyBulletProperties,
	assembleParagraphXml,
	computeUniformSegmentOverrides,
} from './PptxHandlerRuntimeSaveParagraphHelpers';
import type { ParagraphSpacingConfig } from './PptxHandlerRuntimeSaveParagraphHelpers';

// Thin wrapper exposing the protected real parser so the round-trip test
// below exercises the actual load path, not a re-implementation of it.
class ParagraphContentRuntime extends PptxHandlerRuntime {
	public collect(p: XmlObject, pIdx: number, paraCount: number) {
		return this.collectShapeParagraphContent(p, pIdx, paraCount, 'left', {}, {
			txBody: undefined,
			inheritedTxBody: undefined,
			bodyDefaultRunStyle: {},
			slideRelationshipMap: undefined,
			placeholderInfo: undefined,
			phDefaults: undefined,
			slidePath: 'ppt/slides/slide1.xml',
			effectiveLevelStyles: undefined,
			autoNumbering: createAutoNumberSequence(),
		} as never);
	}
}

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

	// -------------------------------------------------------------------------
	// CT_TextParagraphProperties child order
	// -------------------------------------------------------------------------
	/**
	 * ECMA-376 21.1.2.2.7 sequences the children of `a:pPr` as
	 *   lnSpc, spcBef, spcAft, <bullet group>, tabLst, defRPr, extLst.
	 * PowerPoint's own output agrees: the notes body of
	 * `e2e/fixtures/solution-explorer.pptx` emits
	 *   ...spcAft, buClrTx, buSzTx, buFontTx, buNone, tabLst, defRPr.
	 * `tabLst` and `defRPr` used to be written BEFORE the bullet group, under a
	 * comment asserting the schema put `defRPr` first, which it does not.
	 *
	 * PowerPoint does not refuse the mis-ordered file, it silently DISCARDS the
	 * whole bullet group: COM on a deck saved with the old order reported
	 * `ParagraphFormat.Bullet.Visible = 0`, no bullet font and `RelativeSize =
	 * 1`, where the same deck in schema order reported a visible Arial bullet at
	 * 0.9. So the bug cost authored bullets, quietly.
	 */
	it('emits the bullet group before a:tabLst and a:defRPr', () => {
		const textStyle: TextStyle = {
			tabStops: [{ position: 100, align: 'l' }],
			paragraphDefaultRunPropertiesXml: { '@_sz': '1800' },
			paragraphPropertiesExtLstXml: { 'a:ext': { '@_uri': '{X}' } },
		};
		const result = buildParagraphPropertiesXml(
			textStyle,
			undefined,
			{ char: '•', fontFamily: 'Arial' },
			{
				spacingBefore: { 'a:spcPts': { '@_val': '600' } },
				spacingAfter: undefined,
				lineSpacing: { 'a:spcPct': { '@_val': '100000' } },
				lineSpacingExactPt: undefined,
			},
		);
		const keys = Object.keys(result).filter((k) => !k.startsWith('@_'));
		expect(keys).toStrictEqual([
			'a:lnSpc',
			'a:spcBef',
			'a:buFont',
			'a:buChar',
			'a:tabLst',
			'a:defRPr',
			'a:extLst',
		]);
	});

	// -------------------------------------------------------------------------
	// Authored-property gate
	// -------------------------------------------------------------------------
	/**
	 * The style reaching the builder is the SHAPE-level style merged with the
	 * paragraph's own `a:pPr`, and the shape-level half is resolved through the
	 * text body's `a:lstStyle` and the inherited layout/master placeholder. Left
	 * ungated it stamped those inherited values onto every paragraph as
	 * explicitly authored ones, which overrides the inheritance that would
	 * otherwise resolve per paragraph.
	 */
	describe('authored-property gate', () => {
		const shapeLevel: TextStyle = {
			paragraphMarginLeft: 36,
			paragraphIndent: -18,
			align: 'center',
			rtl: false,
			defaultTabSize: 96,
			tabStops: [{ position: 100, align: 'l' }],
		};

		it('emits the whole shape-level style when the paragraph authored nothing', () => {
			const result = buildParagraphPropertiesXml(shapeLevel, 'ctr', undefined, emptySpacing);
			expect(result['@_marL']).toBe(String(36 * EMU_PER_PX));
			expect(result['@_algn']).toBe('ctr');
			expect(result['@_defTabSz']).toBe(String(96 * EMU_PER_PX));
			expect(result['a:tabLst']).toBeDefined();
		});

		it('emits only the keys the paragraph authored', () => {
			// The paragraph authored `algn` alone; `marL` / `indent` / `defTabSz`
			// / `tabLst` came from the shape and must be left to inherit.
			const result = buildParagraphPropertiesXml(
				{ ...shapeLevel, align: 'right' },
				'r',
				undefined,
				emptySpacing,
				0,
				{ align: 'right' },
			);
			expect(result['@_algn']).toBe('r');
			expect(result['@_marL']).toBeUndefined();
			expect(result['@_indent']).toBeUndefined();
			expect(result['@_rtl']).toBeUndefined();
			expect(result['@_defTabSz']).toBeUndefined();
			expect(result['a:tabLst']).toBeUndefined();
		});

		it('gates the spacing children on the authored set too', () => {
			const spacing: ParagraphSpacingConfig = {
				spacingBefore: { 'a:spcPts': { '@_val': '600' } },
				spacingAfter: { 'a:spcPts': { '@_val': '300' } },
				lineSpacing: { 'a:spcPct': { '@_val': '150000' } },
				lineSpacingExactPt: undefined,
			};
			const result = buildParagraphPropertiesXml(shapeLevel, undefined, undefined, spacing, 0, {
				paragraphSpacingBefore: 8,
			});
			expect(result['a:spcBef']).toBeDefined();
			expect(result['a:spcAft']).toBeUndefined();
			expect(result['a:lnSpc']).toBeUndefined();
		});

		it('withholds the shape-level style from a NESTED paragraph that authored nothing', () => {
			// The shape-level style is filled first-paragraph-wins, so it
			// describes outline level 0. Broadcasting its `marL` to a level-3
			// bullet replaced that bullet's own `a:lvl4pPr` indent. A bare
			// `<a:pPr lvl="3"/>` authors no properties, so it lands here.
			const result = buildParagraphPropertiesXml(
				shapeLevel,
				'ctr',
				undefined,
				emptySpacing,
				3,
				undefined,
			);
			expect(result['@_lvl']).toBe('3');
			expect(result['@_marL']).toBeUndefined();
			expect(result['@_algn']).toBeUndefined();
		});

		it('still honours a nested paragraph that authored its own properties', () => {
			const result = buildParagraphPropertiesXml(
				{ ...shapeLevel, paragraphMarginLeft: 72 },
				'ctr',
				undefined,
				emptySpacing,
				3,
				{ paragraphMarginLeft: 72 },
			);
			expect(result['@_marL']).toBe(String(72 * EMU_PER_PX));
		});
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

	it('a bullet colorRef wins over color/colorXml', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, {
			color: '#4472C4',
			colorXml: { 'a:srgbClr': { '@_val': '4472C4' } },
			colorRef: { scheme: 'accent1', lumMod: 0.75 },
		});
		expect(props['a:buClr']).toStrictEqual({
			'a:schemeClr': { '@_val': 'accent1', 'a:lumMod': { '@_val': '75000' } },
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

	it('re-emits the captured a:buBlip subtree verbatim, preserving tile/stretch/srcRect', () => {
		// Bug: the writer used to reconstruct a bare `a:blip[@r:embed]`,
		// discarding every other child the parser had preserved on
		// `imageBlipFillXml` (tile, stretch, srcRect, blip extLst).
		const capturedBuBlip: XmlObject = {
			'a:blip': {
				'@_r:embed': 'rId5',
				'a:extLst': { 'a:ext': { '@_uri': '{some-uri}' } },
			},
			'a:srcRect': { '@_l': '1000', '@_t': '2000', '@_r': '3000', '@_b': '4000' },
			'a:stretch': { 'a:fillRect': {} },
		};
		const props: XmlObject = {};
		applyBulletProperties(props, {
			imageRelId: 'rId5',
			imageBlipFillXml: capturedBuBlip,
		});
		expect(props['a:buBlip']).toBe(capturedBuBlip);
		expect(props['a:buBlip']).toStrictEqual(capturedBuBlip);
	});

	it('load -> save round-trip: a picture bullet with a:tile survives verbatim', () => {
		// Full round-trip using the real parser (collectShapeParagraphContent,
		// exercised via ParagraphContentRuntime below) feeding straight into the
		// real writer (applyBulletProperties), proving the modifiers a
		// picture-bullet author set (here `a:tile`) are neither dropped by parse
		// nor reconstructed away by save.
		const sourceBuBlip: XmlObject = {
			'a:blip': { '@_r:embed': 'rId9' },
			'a:tile': { '@_tx': '0', '@_ty': '0', '@_sx': '100000', '@_sy': '100000' },
		};
		const { segments } = new ParagraphContentRuntime().collect(
			{
				'a:pPr': { 'a:buBlip': sourceBuBlip },
				'a:r': { 'a:t': 'Item text' },
			},
			0,
			1,
		);
		const bulletInfo = segments[0].bulletInfo;
		expect(bulletInfo?.imageRelId).toBe('rId9');
		expect(bulletInfo?.imageBlipFillXml).toStrictEqual(sourceBuBlip);

		const props: XmlObject = {};
		applyBulletProperties(props, bulletInfo!);
		expect(props['a:buBlip']).toStrictEqual(sourceBuBlip);
		expect((props['a:buBlip'] as XmlObject)['a:tile']).toStrictEqual({
			'@_tx': '0',
			'@_ty': '0',
			'@_sx': '100000',
			'@_sy': '100000',
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

// ---------------------------------------------------------------------------
// assembleParagraphXml: authored sibling order
// ---------------------------------------------------------------------------
/**
 * A paragraph's runs, fields and breaks interleave freely, but a single object
 * key can only hold one array, so grouping them by tag silently moved every
 * field to the end of its paragraph: `"Slide " #fld " - " titlefld` saved back
 * as `"Slide " " - " #fld titlefld`. Interleaved sequences therefore use core's
 * `#pptx-order-N` key markers, which the XMLBuilder strips on serialisation.
 */
describe('assembleParagraphXml sibling order', () => {
	const literal = (text: string): XmlObject => ({ 'a:t': text });
	const field = (type: string): XmlObject => ({ __isField: true, '@_type': type });

	it('keeps an inline field between the runs it was authored between', () => {
		const result = assembleParagraphXml(
			[literal('Slide '), field('slidenum'), literal(' - '), field('slidetitle')],
			{},
		);
		expect(Object.keys(result)).toStrictEqual([
			'a:pPr',
			'a:r#pptx-order-0',
			'a:fld#pptx-order-1',
			'a:r#pptx-order-2',
			'a:fld#pptx-order-3',
			'a:endParaRPr',
		]);
		expect(result['a:r#pptx-order-0']).toStrictEqual({ 'a:t': 'Slide ' });
		expect(result['a:fld#pptx-order-3']).toStrictEqual({ '@_type': 'slidetitle' });
	});

	it('keeps a soft break in its authored position between runs', () => {
		const result = assembleParagraphXml(
			[literal('one'), { __isLineBreak: true }, literal('two')],
			{},
		);
		expect(Object.keys(result)).toStrictEqual([
			'a:pPr',
			'a:r#pptx-order-0',
			'a:br',
			'a:r#pptx-order-2',
			'a:endParaRPr',
		]);
	});

	it('leaves an already-grouped paragraph on plain keys', () => {
		const result = assembleParagraphXml([literal('a'), literal('b'), field('slidenum')], {});
		expect(Object.keys(result)).toStrictEqual(['a:pPr', 'a:r', 'a:fld', 'a:endParaRPr']);
		expect(result['a:r']).toStrictEqual([{ 'a:t': 'a' }, { 'a:t': 'b' }]);
	});

	it('emits a grouped paragraph in its authored key order, not a fixed one', () => {
		// A field-first footer ("#fld of N") must not be re-ordered to runs-first.
		const result = assembleParagraphXml([field('slidenum'), literal(' of 10')], {});
		expect(Object.keys(result)).toStrictEqual(['a:pPr', 'a:fld', 'a:r', 'a:endParaRPr']);
	});
});
