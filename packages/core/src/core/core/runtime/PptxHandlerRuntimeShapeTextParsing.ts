import { XmlObject, TextStyle } from '../../types';
import {
	parseAlignmentAttr,
	parseParagraphExtraAttributes,
	parseParagraphMargins,
	parseParagraphRtl,
	parseTabStops,
	resolveParagraphAlignment,
} from '../../utils/paragraph-properties-parser';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeShapeBodyParsing';
import type { ShapeTextParsingContext, ParagraphStyleResult } from './PptxHandlerRuntimeTypes';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * A copy of an `a:lstStyle` level entry without its `a:defRPr`: run
	 * defaults follow their own precedence chain, so only the paragraph-level
	 * keys (algn, lnSpc, spacing, margins, tabs) may join the pPr merge.
	 */
	private withoutDefaultRunProperties(node: XmlObject | undefined): XmlObject | undefined {
		if (!node || typeof node !== 'object') {
			return undefined;
		}
		const copy: XmlObject = { ...node };
		delete copy['a:defRPr'];
		return copy;
	}

	/**
	 * Extract a paragraph's OWN `a:pPr` geometry (align, spacing, margins,
	 * indent, tabs, rtl, line-breaking and justification flags) as a partial
	 * {@link TextStyle} so per-paragraph formatting round-trips rather than
	 * collapsing to one shape-level pPr (#69). Inherited layout/master values
	 * are not re-stamped.
	 *
	 * Every attribute of `CT_TextParagraphProperties` is accounted for here
	 * except `lvl`, which travels separately as `TextSegment.paragraphLevel`.
	 * `marL`/`marR`/`indent` come from `parseParagraphMargins`; `algn` and
	 * `rtl` are read below; and `defTabSz`, `eaLnBrk`, `latinLnBrk`,
	 * `fontAlgn` and `hangingPunct` come from `parseParagraphExtraAttributes`.
	 * Those last five used to be omitted, so a paragraph whose values differed
	 * from the shape-level style (`resolveShapeParagraphStyle` keeps only the
	 * FIRST paragraph's) lost them at LOAD and no save-side preservation could
	 * bring them back. Three of the five govern East-Asian line breaking and
	 * justification, so the loss fell hardest on CJK decks.
	 *
	 * The `a:pPr` child elements likewise round-trip: `lnSpc`/`spcBef`/`spcAft`
	 * and `tabLst` below, `defRPr` and `extLst` verbatim, and the bullet group
	 * separately as `TextSegment.bulletInfo`.
	 */
	protected extractParagraphOwnProperties(
		p: XmlObject,
		basisFontSize: number | undefined,
	): TextStyle | undefined {
		const pPr = p['a:pPr'] as XmlObject | undefined;
		if (!pPr) {
			return undefined;
		}
		const pp: TextStyle = {
			...parseParagraphMargins(pPr),
			...parseParagraphExtraAttributes(pPr),
		};
		const align =
			pPr['@_algn'] !== undefined ? parseAlignmentAttr(String(pPr['@_algn'])) : undefined;
		if (align) {
			pp.align = align;
		}
		const rtl = parseParagraphRtl(pPr);
		if (rtl !== undefined) {
			pp.rtl = rtl;
		}
		const spcBef = this.parseParagraphSpacingPx(
			pPr['a:spcBef'] as XmlObject | undefined,
			basisFontSize,
		);
		if (spcBef !== undefined) {
			pp.paragraphSpacingBefore = spcBef;
		}
		const spcAft = this.parseParagraphSpacingPx(
			pPr['a:spcAft'] as XmlObject | undefined,
			basisFontSize,
		);
		if (spcAft !== undefined) {
			pp.paragraphSpacingAfter = spcAft;
		}
		const lnSpcNode = pPr['a:lnSpc'] as XmlObject | undefined;
		const lineSpacing = this.parseLineSpacingMultiplier(lnSpcNode);
		const exactPt = lineSpacing === undefined ? this.parseLineSpacingExactPt(lnSpcNode) : undefined;
		if (lineSpacing !== undefined) {
			pp.lineSpacing = lineSpacing;
		} else if (exactPt !== undefined) {
			pp.lineSpacingExactPt = exactPt;
		}
		const tabStops = parseTabStops(pPr);
		if (tabStops && tabStops.length > 0) {
			pp.tabStops = tabStops;
		}
		// Preserve `a:pPr/a:defRPr` (paragraph default run properties) and
		// `a:pPr/a:extLst` verbatim so the save helper re-emits them instead of
		// dropping the end-paragraph run formatting / authored extensions.
		const defRPr = pPr['a:defRPr'];
		if (defRPr && typeof defRPr === 'object') {
			pp.paragraphDefaultRunPropertiesXml = defRPr as XmlObject;
		}
		const pPrExtLst = pPr['a:extLst'];
		if (pPrExtLst && typeof pPrExtLst === 'object') {
			pp.paragraphPropertiesExtLstXml = pPrExtLst as XmlObject;
		}
		return Object.keys(pp).length > 0 ? pp : undefined;
	}

	/**
	 * Resolve paragraph-level styles (alignment, spacing, margins, tabs,
	 * level styles) for a single paragraph.  Modifies `textStyle` in place
	 * for "first-wins" shape-level properties.
	 */
	protected resolveShapeParagraphStyle(
		p: XmlObject,
		textStyle: TextStyle,
		ctx: ShapeTextParsingContext,
	): ParagraphStyleResult {
		// Slide placeholders often contain only text. Their paragraph properties
		// (notably alignment and RTL direction) remain on the matching layout or
		// master placeholder, so merge them before resolving the paragraph style.
		const inheritedParagraph = this.ensureArray(ctx.inheritedTxBody?.['a:p'])[0] as
			| XmlObject
			| undefined;
		const directPPr = this.mergeXmlObjects(
			inheritedParagraph?.['a:pPr'] as XmlObject | undefined,
			p['a:pPr'] as XmlObject | undefined,
		);
		// A paragraph whose `lvl` attribute is omitted IS a level-0 paragraph
		// (ECMA-376 21.1.2.2.7 defaults `lvl` to 0): it takes `a:lvl1pPr`, with
		// `a:defPPr` applying beneath EVERY level as the all-levels base, not as
		// a substitute consulted only when `lvl` is absent.
		const parsedLevel = Number.parseInt(String(directPPr?.['@_lvl'] ?? '0'), 10);
		const level = Number.isFinite(parsedLevel) ? Math.min(Math.max(parsedLevel, 0), 8) : 0;
		const levelKey = `a:lvl${level + 1}pPr`;
		// The text body's own `a:lstStyle` level entry carries paragraph-level
		// properties too (alignment, `a:lnSpc`, spacing, margins). Merge it under
		// the paragraph's direct `a:pPr` so a text box that keeps its formatting
		// in `lvl1pPr` (sz/lnSpc with attribute-less runs) resolves like
		// PowerPoint instead of falling back to presentation defaults. Run
		// properties (`a:defRPr`) are resolved separately below with their own
		// precedence, so they are stripped from the paragraph merge.
		const ownLstStyle = ctx.txBody?.['a:lstStyle'] as XmlObject | undefined;
		const inheritedLstStyle = ctx.inheritedTxBody?.['a:lstStyle'] as XmlObject | undefined;
		const lstStyleParagraphDefaults = this.mergeXmlObjects(
			this.mergeXmlObjects(
				this.withoutDefaultRunProperties(inheritedLstStyle?.['a:defPPr'] as XmlObject | undefined),
				this.withoutDefaultRunProperties(inheritedLstStyle?.[levelKey] as XmlObject | undefined),
			),
			this.mergeXmlObjects(
				this.withoutDefaultRunProperties(ownLstStyle?.['a:defPPr'] as XmlObject | undefined),
				this.withoutDefaultRunProperties(ownLstStyle?.[levelKey] as XmlObject | undefined),
			),
		);
		const pPr = this.mergeXmlObjects(lstStyleParagraphDefaults, directPPr);
		const paragraphRtl = this.parseOptionalBooleanAttr(pPr?.['@_rtl']);
		if (paragraphRtl !== undefined && textStyle.rtl === undefined) {
			textStyle.rtl = paragraphRtl;
		}

		// This paragraph's OWN placeholder-level alignment (not a snapshot from a
		// sibling paragraph, which `textStyle.align` below can hold once an
		// earlier paragraph in the same shape declared an explicit `algn`).
		const ownPlaceholderAlignment = (ctx.effectiveLevelStyles?.[level]?.alignment ??
			ctx.effectiveLevelStyles?.[-1]?.alignment) as TextStyle['align'] | undefined;
		const paraAlign: TextStyle['align'] = resolveParagraphAlignment(
			pPr?.['@_algn'],
			ownPlaceholderAlignment,
			paragraphRtl,
		);
		if (pPr?.['@_algn'] && !textStyle.align) {
			textStyle.align = paraAlign;
		}

		// Percentage spacing (`a:spcPct`) resolves against the paragraph's font size.
		const spacingBasisPx = typeof textStyle.fontSize === 'number' ? textStyle.fontSize : undefined;
		if (textStyle.paragraphSpacingBefore === undefined) {
			const spacingBefore = this.parseParagraphSpacingPx(
				pPr?.['a:spcBef'] as XmlObject | undefined,
				spacingBasisPx,
			);
			if (spacingBefore !== undefined) {
				textStyle.paragraphSpacingBefore = spacingBefore;
			}
		}
		if (textStyle.paragraphSpacingAfter === undefined) {
			const spacingAfter = this.parseParagraphSpacingPx(
				pPr?.['a:spcAft'] as XmlObject | undefined,
				spacingBasisPx,
			);
			if (spacingAfter !== undefined) {
				textStyle.paragraphSpacingAfter = spacingAfter;
			}
		}
		if (textStyle.lineSpacing === undefined && textStyle.lineSpacingExactPt === undefined) {
			const lnSpcNode = pPr?.['a:lnSpc'] as XmlObject | undefined;
			const lineSpacing = this.parseLineSpacingMultiplier(lnSpcNode);
			if (lineSpacing !== undefined) {
				textStyle.lineSpacing = lineSpacing;
			} else {
				const exactPt = this.parseLineSpacingExactPt(lnSpcNode);
				if (exactPt !== undefined) {
					textStyle.lineSpacingExactPt = exactPt;
				}
			}
		}

		// Paragraph indentation (marL, marR, indent)
		if (textStyle.paragraphMarginLeft === undefined && pPr?.['@_marL'] !== undefined) {
			const marL = Number.parseInt(String(pPr['@_marL']), 10);
			if (Number.isFinite(marL)) {
				textStyle.paragraphMarginLeft = marL / PptxHandlerRuntime.EMU_PER_PX;
			}
		}
		if (textStyle.paragraphMarginRight === undefined && pPr?.['@_marR'] !== undefined) {
			const marR = Number.parseInt(String(pPr['@_marR']), 10);
			if (Number.isFinite(marR)) {
				textStyle.paragraphMarginRight = marR / PptxHandlerRuntime.EMU_PER_PX;
			}
		}
		if (textStyle.paragraphIndent === undefined && pPr?.['@_indent'] !== undefined) {
			const indent = Number.parseInt(String(pPr['@_indent']), 10);
			if (Number.isFinite(indent)) {
				textStyle.paragraphIndent = indent / PptxHandlerRuntime.EMU_PER_PX;
			}
		}

		// Tab stops (a:tabLst > a:tab)
		if (!textStyle.tabStops) {
			const tabLst = pPr?.['a:tabLst'] as XmlObject | undefined;
			if (tabLst) {
				const tabNodes = this.ensureArray(tabLst['a:tab']) as XmlObject[];
				if (tabNodes.length > 0) {
					textStyle.tabStops = tabNodes
						.filter((t) => t?.['@_pos'] !== undefined)
						.map((t) => {
							const posRaw = Number.parseInt(String(t['@_pos']), 10);
							const position = Number.isFinite(posRaw) ? posRaw / PptxHandlerRuntime.EMU_PER_PX : 0;
							const algn = String(t['@_algn'] || 'l').trim();
							const align =
								algn === 'ctr' || algn === 'r' || algn === 'dec' ? algn : ('l' as const);
							const leaderVal = String(t['@_leader'] || '').trim();
							const leader =
								leaderVal === 'dot' || leaderVal === 'hyphen' || leaderVal === 'underscore'
									? leaderVal
									: undefined;
							return { position, align, ...(leader ? { leader } : {}) };
						});
				}
			}
		}

		// Additional paragraph properties
		if (pPr?.['@_defTabSz'] !== undefined && textStyle.defaultTabSize === undefined) {
			const defTabSz = Number.parseInt(String(pPr['@_defTabSz']), 10);
			if (Number.isFinite(defTabSz)) {
				textStyle.defaultTabSize = defTabSz / PptxHandlerRuntime.EMU_PER_PX;
			}
		}
		if (pPr?.['@_eaLnBrk'] !== undefined && textStyle.eaLineBreak === undefined) {
			const eaVal = this.parseOptionalBooleanAttr(pPr['@_eaLnBrk']);
			if (eaVal !== undefined) {
				textStyle.eaLineBreak = eaVal;
			}
		}
		if (pPr?.['@_latinLnBrk'] !== undefined && textStyle.latinLineBreak === undefined) {
			const latVal = this.parseOptionalBooleanAttr(pPr['@_latinLnBrk']);
			if (latVal !== undefined) {
				textStyle.latinLineBreak = latVal;
			}
		}
		if (pPr?.['@_fontAlgn'] !== undefined && textStyle.fontAlignment === undefined) {
			const fontAlgn = String(pPr['@_fontAlgn']).trim();
			if (fontAlgn) {
				textStyle.fontAlignment = fontAlgn;
			}
		}
		if (pPr?.['@_hangingPunct'] !== undefined && textStyle.hangingPunctuation === undefined) {
			const hpVal = this.parseOptionalBooleanAttr(pPr['@_hangingPunct']);
			if (hpVal !== undefined) {
				textStyle.hangingPunctuation = hpVal;
			}
		}

		// Resolve run-level default styles
		const defaultRunStyle = this.extractTextRunStyle(
			pPr?.['a:defRPr'] as XmlObject | undefined,
			paraAlign,
			ctx.slideRelationshipMap,
			false,
		);
		// `level`/`levelKey` are computed above from the paragraph's direct
		// properties; `a:defPPr` run defaults already sit beneath this merge via
		// `ctx.bodyDefaultRunStyle`, so only the level entry is looked up here.
		const inheritedLevelStyle = this.extractTextRunStyle(
			(
				(ctx.inheritedTxBody?.['a:lstStyle'] as XmlObject | undefined)?.[levelKey] as
					| XmlObject
					| undefined
			)?.['a:defRPr'] as XmlObject | undefined,
			paraAlign,
			ctx.slideRelationshipMap,
			false,
		);
		const bodyLevelStyle = this.extractTextRunStyle(
			(
				(ctx.txBody?.['a:lstStyle'] as XmlObject | undefined)?.[levelKey] as XmlObject | undefined
			)?.['a:defRPr'] as XmlObject | undefined,
			paraAlign,
			ctx.slideRelationshipMap,
			false,
		);
		const endParagraphStyle = this.extractTextRunStyle(
			p?.['a:endParaRPr'] as XmlObject | undefined,
			paraAlign,
			ctx.slideRelationshipMap,
			false,
		);
		const mergedDefaultRunStyle = {
			...ctx.bodyDefaultRunStyle,
			...inheritedLevelStyle,
			...bodyLevelStyle,
			...endParagraphStyle,
			...defaultRunStyle,
		} as TextStyle;

		// The shape's `<p:style><a:fontRef>` reference is the shape-level run
		// default. It sits BELOW anything the text body itself declares (handled
		// by the merge above) but ABOVE the placeholder / presentation-wide
		// `p:defaultTextStyle` levels applied next, which only fill undefined
		// slots. Seeding it here is what stops a themed accent button
		// (`<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>`, runs
		// with no `a:solidFill`) from inheriting `tx1` black and rendering
		// black-on-orange instead of white.
		if (mergedDefaultRunStyle.color === undefined && ctx.styleFontRefColor !== undefined) {
			mergedDefaultRunStyle.color = ctx.styleFontRefColor;
		}
		if (mergedDefaultRunStyle.fontFamily === undefined && ctx.styleFontRefTypeface !== undefined) {
			mergedDefaultRunStyle.fontFamily = ctx.styleFontRefTypeface;
		}

		// Apply placeholder level-specific defaults as fallback: the paragraph's
		// level entry first, then `a:defPPr` (stored at key -1) beneath it as the
		// all-levels base. Both applications only fill still-undefined slots.
		if (ctx.effectiveLevelStyles) {
			const phLevel = ctx.effectiveLevelStyles[level];
			const phBase = ctx.effectiveLevelStyles[-1];
			if (phLevel) {
				this.applyPlaceholderLevelDefaults(mergedDefaultRunStyle, phLevel);
				this.applyPlaceholderLevelDefaults(textStyle, phLevel);
			}
			if (phBase) {
				this.applyPlaceholderLevelDefaults(mergedDefaultRunStyle, phBase);
				this.applyPlaceholderLevelDefaults(textStyle, phBase);
			}
		}

		// Per-paragraph indentation (also checking placeholder level defaults)
		const parMarginLeft =
			pPr?.['@_marL'] !== undefined
				? Number.parseInt(String(pPr['@_marL']), 10) / PptxHandlerRuntime.EMU_PER_PX
				: undefined;
		const parIndent =
			pPr?.['@_indent'] !== undefined
				? Number.parseInt(String(pPr['@_indent']), 10) / PptxHandlerRuntime.EMU_PER_PX
				: undefined;
		let effectiveMarginLeft = parMarginLeft;
		let effectiveIndent = parIndent;
		if (ctx.effectiveLevelStyles) {
			const phLevel = ctx.effectiveLevelStyles[level];
			const phBase = ctx.effectiveLevelStyles[-1];
			if (effectiveMarginLeft === undefined) {
				effectiveMarginLeft = phLevel?.marginLeft ?? phBase?.marginLeft;
			}
			if (effectiveIndent === undefined) {
				effectiveIndent = phLevel?.indent ?? phBase?.indent;
			}
		}

		return {
			paraAlign,
			mergedDefaultRunStyle,
			indent: { marginLeft: effectiveMarginLeft, indent: effectiveIndent },
		};
	}
}
