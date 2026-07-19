import { TextStyle, XmlObject } from '../../types';
import { extractColorChoiceXml } from '../../utils/color-xml-preservation';
import { xmlAttr, xmlChild } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeTextRunEffects';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected extractTextRunStyle(
		runProperties: XmlObject | undefined,
		align: TextStyle['align'],
		relationshipMap?: Map<string, string>,
		includeDefaultAlignment: boolean = true,
	): TextStyle {
		const style: TextStyle = includeDefaultAlignment ? { align } : {};
		if (!runProperties) {
			return style;
		}

		if (runProperties['@_sz']) {
			const points = parseInt(runProperties['@_sz']) / 100;
			style.fontSize = points * (96 / 72);
		}

		if (runProperties['@_b'] !== undefined) {
			style.bold = runProperties['@_b'] === '1';
		}
		if (runProperties['@_i'] !== undefined) {
			style.italic = runProperties['@_i'] === '1';
		}
		if (runProperties['@_u'] !== undefined) {
			const underlineToken = String(runProperties['@_u'] || '')
				.trim()
				.toLowerCase();
			style.underline =
				underlineToken.length > 0 &&
				underlineToken !== 'none' &&
				underlineToken !== '0' &&
				underlineToken !== 'false';
			// Preserve the specific underline style variant
			if (style.underline) {
				const rawU = String(runProperties['@_u'] || '').trim();
				if (rawU.length > 0 && rawU !== 'none') {
					style.underlineStyle = rawU as TextStyle['underlineStyle'];
				}
			} else if (underlineToken === 'none') {
				// Explicit `<a:rPr u="none"/>` suppression. Record it so the writer
				// re-emits the explicit token instead of collapsing to inherit.
				style.underlineExplicitNone = true;
			}
		}
		// Underline colour (a:uFill > a:solidFill or a:uLn > a:solidFill)
		const uFill = runProperties['a:uFill'] as XmlObject | undefined;
		const uLn = runProperties['a:uLn'] as XmlObject | undefined;
		const underlineColorSource = uFill?.['a:solidFill'] || uLn?.['a:solidFill'];
		if (underlineColorSource) {
			const underlineColor = this.parseColor(underlineColorSource as XmlObject);
			if (underlineColor) {
				style.underlineColor = underlineColor;
			}
		}
		// #85: Underline line styling (a:uLn width/dash/cap/ends) and the
		// follow-text markers (a:uLnTx / a:uFillTx). Previously only the uLn
		// solidFill colour above was read; the line properties were dropped.
		if (uLn) {
			const line: NonNullable<TextStyle['underlineLine']> = {};
			const widthEmu = Number.parseInt(String(uLn['@_w'] ?? ''), 10);
			if (Number.isFinite(widthEmu)) {
				line.widthEmu = widthEmu;
			}
			const compound = String(uLn['@_cmpd'] ?? '').trim();
			if (compound) {
				line.compound = compound;
			}
			const cap = String(uLn['@_cap'] ?? '').trim();
			if (cap) {
				line.cap = cap;
			}
			const algn = String(uLn['@_algn'] ?? '').trim();
			if (algn) {
				line.algn = algn;
			}
			const prstDash = String((uLn['a:prstDash'] as XmlObject | undefined)?.['@_val'] ?? '').trim();
			if (prstDash) {
				line.prstDash = prstDash;
			}
			const headEnd = uLn['a:headEnd'];
			if (headEnd && typeof headEnd === 'object') {
				line.headEndXml = headEnd as XmlObject;
			}
			const tailEnd = uLn['a:tailEnd'];
			if (tailEnd && typeof tailEnd === 'object') {
				line.tailEndXml = tailEnd as XmlObject;
			}
			if (Object.keys(line).length > 0) {
				style.underlineLine = line;
			}
		}
		if (runProperties['a:uLnTx'] !== undefined) {
			style.underlineLineFollowsText = true;
		}
		if (runProperties['a:uFillTx'] !== undefined) {
			style.underlineFillFollowsText = true;
		}
		if (runProperties['@_strike'] !== undefined) {
			const strikeToken = String(runProperties['@_strike'] || '')
				.trim()
				.toLowerCase();
			style.strikethrough =
				strikeToken.length > 0 &&
				strikeToken !== 'nostrike' &&
				strikeToken !== 'none' &&
				strikeToken !== '0' &&
				strikeToken !== 'false';
			if (style.strikethrough) {
				style.strikeType = strikeToken === 'dblstrike' ? 'dblStrike' : 'sngStrike';
			}
		}
		// Text outline (a:rPr > a:ln)
		const textLn = runProperties['a:ln'] as XmlObject | undefined;
		if (textLn) {
			const textOutlineW = Number.parseInt(String(textLn['@_w'] || ''), 10);
			if (Number.isFinite(textOutlineW) && textOutlineW > 0) {
				style.textOutlineWidth = textOutlineW / PptxHandlerRuntime.EMU_PER_PX;
			}
			const textOutlineFill = textLn['a:solidFill'] as XmlObject | undefined;
			if (textOutlineFill) {
				const outlineColor = this.parseColor(textOutlineFill);
				if (outlineColor) {
					style.textOutlineColor = outlineColor;
				}
			}
		}
		// No fill on text run (a:rPr > a:noFill) — hollow/outline-only text
		if (runProperties['a:noFill'] !== undefined) {
			style.textFillNone = true;
		}
		// Superscript / subscript baseline shift (percentage)
		if (runProperties['@_baseline'] !== undefined) {
			const baselineVal = Number.parseInt(String(runProperties['@_baseline']), 10);
			if (Number.isFinite(baselineVal) && baselineVal !== 0) {
				style.baseline = baselineVal;
			}
		}
		// Character spacing (hundredths of a point)
		if (runProperties['@_spc'] !== undefined) {
			const spcVal = Number.parseInt(String(runProperties['@_spc']), 10);
			if (Number.isFinite(spcVal)) {
				style.characterSpacing = spcVal;
			}
		}
		// Kerning threshold
		if (runProperties['@_kern'] !== undefined) {
			const kernVal = Number.parseInt(String(runProperties['@_kern']), 10);
			if (Number.isFinite(kernVal)) {
				style.kerning = kernVal;
			}
		}
		// Text highlight colour
		if (runProperties['a:highlight']) {
			const highlightNode = xmlChild(runProperties, 'a:highlight');
			const highlightHex = this.parseColor(highlightNode);
			if (highlightHex) {
				style.highlightColor = highlightHex;
			}
			// Preserve the original colour-choice so a themed (`a:schemeClr`)
			// highlight re-emits as itself rather than flattening to srgbClr.
			const highlightXml = extractColorChoiceXml(highlightNode);
			if (highlightXml) {
				style.highlightColorXml = highlightXml;
			}
		}
		// Text fill variants (gradient/pattern on a:rPr)
		const textFillVariants = this.extractTextFillVariants(runProperties);
		if (textFillVariants.textFillGradient) {
			style.textFillGradient = textFillVariants.textFillGradient;
			style.textFillGradientStops = textFillVariants.textFillGradientStops;
			style.textFillGradientAngle = textFillVariants.textFillGradientAngle;
			style.textFillGradientType = textFillVariants.textFillGradientType;
		}
		if (textFillVariants.textFillPattern) {
			style.textFillPattern = textFillVariants.textFillPattern;
			style.textFillPatternForeground = textFillVariants.textFillPatternForeground;
			style.textFillPatternBackground = textFillVariants.textFillPatternBackground;
		}
		const runRtl = this.parseOptionalBooleanAttr(runProperties['@_rtl']);
		if (runRtl !== undefined) {
			style.rtl = runRtl;
		}

		const latin = xmlChild(runProperties, 'a:latin');
		const eastAsian = xmlChild(runProperties, 'a:ea');
		const complexScript = xmlChild(runProperties, 'a:cs');
		const latinTypefaceToken = xmlAttr(latin, 'typeface');
		const eaTypefaceToken = xmlAttr(eastAsian, 'typeface');
		const csTypefaceToken = xmlAttr(complexScript, 'typeface');
		const chosenTypeface = latinTypefaceToken || eaTypefaceToken || csTypefaceToken;
		const resolvedTypeface = this.resolveThemeTypeface(chosenTypeface);
		if (resolvedTypeface) {
			style.fontFamily = resolvedTypeface;
		}

		// #84: Preserve the theme-font token (`+mj-lt` / `+mn-ea` / ...) on the
		// typeface it was authored on, so the writer can re-emit the token rather
		// than the flattened concrete face. `fontFamily` above still holds the
		// resolved concrete face for rendering.
		if (latinTypefaceToken && latinTypefaceToken.startsWith('+')) {
			style.latinFontThemeToken = latinTypefaceToken;
		}
		if (eaTypefaceToken && eaTypefaceToken.startsWith('+')) {
			style.eastAsiaFontThemeToken = eaTypefaceToken;
		}
		if (csTypefaceToken && csTypefaceToken.startsWith('+')) {
			style.complexScriptFontThemeToken = csTypefaceToken;
		}

		// Store per-script font families for Unicode font fallback. Only set when
		// the source actually authored an `a:ea` / `a:cs` typeface — otherwise the
		// writer must not synthesize one (see #84).
		const eaTypeface = this.resolveThemeTypeface(eaTypefaceToken);
		if (eaTypeface) {
			style.eastAsiaFont = eaTypeface;
		}
		const csTypeface = this.resolveThemeTypeface(csTypefaceToken);
		if (csTypeface) {
			style.complexScriptFont = csTypeface;
		}

		const solidFill = xmlChild(runProperties, 'a:solidFill');
		if (solidFill) {
			style.color = this.parseColor(solidFill);
			const colorXml = extractColorChoiceXml(solidFill);
			if (colorXml) {
				style.colorXml = colorXml;
			}
		}

		// Hyperlinks (a:hlinkClick, a:hlinkMouseOver)
		this.applyHyperlinkStyle(style, runProperties, relationshipMap);

		// Text caps (@cap)
		const capAttr = String(runProperties['@_cap'] || '')
			.trim()
			.toLowerCase();
		if (capAttr === 'all' || capAttr === 'small') {
			style.textCaps = capAttr;
		} else if (capAttr === 'none') {
			// Explicit `<a:rPr cap="none"/>` suppression. Record it so the writer
			// re-emits the explicit token instead of dropping it to inherit.
			style.textCaps = 'none';
			style.textCapsExplicitNone = true;
		}

		// Symbol font (a:sym)
		const symNode = xmlChild(runProperties, 'a:sym');
		if (symNode) {
			const symTypeface = this.normalizeTypefaceToken(xmlAttr(symNode, 'typeface') || '');
			if (symTypeface) {
				style.symbolFont = symTypeface;
			}
		}

		// Language (@lang)
		const langAttr = String(runProperties['@_lang'] || '').trim();
		if (langAttr) {
			style.language = langAttr;
		}

		// Run metadata attributes
		const kumimoji = this.parseOptionalBooleanAttr(runProperties['@_kumimoji']);
		if (kumimoji !== undefined) {
			style.kumimoji = kumimoji;
		}
		const normalizeH = this.parseOptionalBooleanAttr(runProperties['@_normalizeH']);
		if (normalizeH !== undefined) {
			style.normalizeHeight = normalizeH;
		}
		const noProof = this.parseOptionalBooleanAttr(runProperties['@_noProof']);
		if (noProof !== undefined) {
			style.noProof = noProof;
		}
		const dirty = this.parseOptionalBooleanAttr(runProperties['@_dirty']);
		if (dirty !== undefined) {
			style.dirty = dirty;
		}
		const err = this.parseOptionalBooleanAttr(runProperties['@_err']);
		if (err !== undefined) {
			style.spellingError = err;
		}
		const smtClean = this.parseOptionalBooleanAttr(runProperties['@_smtClean']);
		if (smtClean !== undefined) {
			style.smartTagClean = smtClean;
		}
		const bmk = String(runProperties['@_bmk'] || '').trim();
		if (bmk) {
			style.bookmark = bmk;
		}

		// Alternative language and SmartTag id (CT_TextCharacterProperties).
		const altLang = String(runProperties['@_altLang'] || '').trim();
		if (altLang) {
			style.altLanguage = altLang;
		}
		if (runProperties['@_smtId'] !== undefined) {
			const smtIdRaw = Number.parseInt(String(runProperties['@_smtId']), 10);
			if (Number.isFinite(smtIdRaw)) {
				style.smartTagId = smtIdRaw;
			}
		}

		// Per-script font metadata (CT_TextFont @panose, @pitchFamily, @charset).
		this.applyTextFontMetadata(style, latin, 'latin');
		this.applyTextFontMetadata(style, eastAsian, 'eastAsia');
		this.applyTextFontMetadata(style, complexScript, 'complexScript');
		this.applyTextFontMetadata(style, symNode, 'symbol');

		// Text run effects (a:effectLst on a:rPr)
		const runEffectList = runProperties['a:effectLst'] as XmlObject | undefined;
		if (runEffectList) {
			this.applyTextRunEffects(style, runEffectList);
		}

		// Text run effect graph (a:effectDag on a:rPr) — ECMA-376
		// §21.1.2.3.6 allows `effectDag` as an alternative to `effectLst`.
		this.applyTextRunEffectDag(style, runProperties);

		// Run-level `a:extLst` preserved verbatim so authored extensions survive
		// a round-trip. Captured only for real runs (`includeDefaultAlignment` is
		// true only on run/field/direct-text extraction, false for the
		// defRPr / level / endParaRPr default-style passes) so a default style's
		// extLst does not propagate onto every run of the paragraph.
		if (includeDefaultAlignment) {
			const runExtLst = runProperties['a:extLst'];
			if (runExtLst && typeof runExtLst === 'object') {
				style.runPropertiesExtLstXml = runExtLst as XmlObject;
			}
		}

		return style;
	}

	/**
	 * Copy `@panose` / `@pitchFamily` / `@charset` from a font child node
	 * (`a:latin`, `a:ea`, `a:cs`, `a:sym`) onto the matching `*Font*`
	 * fields of `style`.
	 */
	private applyTextFontMetadata(
		style: TextStyle,
		fontNode: XmlObject | undefined,
		kind: 'latin' | 'eastAsia' | 'complexScript' | 'symbol',
	): void {
		if (!fontNode) {
			return;
		}
		const panose = String(fontNode['@_panose'] || '').trim();
		const pitchRaw = fontNode['@_pitchFamily'];
		const charsetRaw = fontNode['@_charset'];

		const pitch =
			pitchRaw !== undefined && pitchRaw !== null
				? Number.parseInt(String(pitchRaw), 10)
				: undefined;
		const charset =
			charsetRaw !== undefined && charsetRaw !== null
				? Number.parseInt(String(charsetRaw), 10)
				: undefined;

		if (kind === 'latin') {
			if (panose) {
				style.latinFontPanose = panose;
			}
			if (typeof pitch === 'number' && Number.isFinite(pitch)) {
				style.latinFontPitchFamily = pitch;
			}
			if (typeof charset === 'number' && Number.isFinite(charset)) {
				style.latinFontCharset = charset;
			}
			return;
		}
		if (kind === 'eastAsia') {
			if (panose) {
				style.eastAsiaFontPanose = panose;
			}
			if (typeof pitch === 'number' && Number.isFinite(pitch)) {
				style.eastAsiaFontPitchFamily = pitch;
			}
			if (typeof charset === 'number' && Number.isFinite(charset)) {
				style.eastAsiaFontCharset = charset;
			}
			return;
		}
		if (kind === 'complexScript') {
			if (panose) {
				style.complexScriptFontPanose = panose;
			}
			if (typeof pitch === 'number' && Number.isFinite(pitch)) {
				style.complexScriptFontPitchFamily = pitch;
			}
			if (typeof charset === 'number' && Number.isFinite(charset)) {
				style.complexScriptFontCharset = charset;
			}
			return;
		}
		// symbol
		if (panose) {
			style.symbolFontPanose = panose;
		}
		if (typeof pitch === 'number' && Number.isFinite(pitch)) {
			style.symbolFontPitchFamily = pitch;
		}
		if (typeof charset === 'number' && Number.isFinite(charset)) {
			style.symbolFontCharset = charset;
		}
	}
}
