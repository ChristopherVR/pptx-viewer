import { XmlObject, TextStyle } from '../../types';
import { serializeColorChoiceWithRef } from '../../utils/color-xml-preservation';
import { createRunStyleGate } from './authored-run-style';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSlideUtils';
import { buildTextRunEffectListXml } from './text-run-effect-xml-builder';

/**
 * Augment a CT_TextFont node (`a:latin` / `a:ea` / `a:cs` / `a:sym`) with
 * optional `@panose`, `@pitchFamily`, `@charset` attributes when the parsed
 * model captured them. Mutates and returns the same node so the caller can
 * use it inline at the OOXML-prescribed insertion point.
 */
function applyFontMetadata(
	fontNode: XmlObject,
	panose: string | undefined,
	pitchFamily: number | undefined,
	charset: number | undefined,
): XmlObject {
	if (panose && panose.length > 0) {
		fontNode['@_panose'] = panose;
	}
	if (typeof pitchFamily === 'number' && Number.isFinite(pitchFamily)) {
		fontNode['@_pitchFamily'] = String(pitchFamily);
	}
	if (typeof charset === 'number' && Number.isFinite(charset)) {
		fontNode['@_charset'] = String(charset);
	}
	return fontNode;
}

/**
 * Build the `a:uLn` (underline line) XML node from the parsed
 * {@link TextStyle.underlineLine}. Follows CT_LineProperties child order
 * (`prstDash`, then `headEnd`, `tailEnd`). The line colour is emitted
 * separately via `a:uFill`, so no fill child is written here.
 */
function buildUnderlineLineXml(line: NonNullable<TextStyle['underlineLine']>): XmlObject {
	const uln: XmlObject = {};
	if (typeof line.widthEmu === 'number' && Number.isFinite(line.widthEmu)) {
		uln['@_w'] = String(Math.round(line.widthEmu));
	}
	if (line.compound) {
		uln['@_cmpd'] = line.compound;
	}
	if (line.cap) {
		uln['@_cap'] = line.cap;
	}
	if (line.algn) {
		uln['@_algn'] = line.algn;
	}
	if (line.prstDash) {
		uln['a:prstDash'] = { '@_val': line.prstDash };
	}
	if (line.headEndXml) {
		uln['a:headEnd'] = line.headEndXml;
	}
	if (line.tailEndXml) {
		uln['a:tailEnd'] = line.tailEndXml;
	}
	return uln;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected createRunPropertiesFromTextStyle(
		style: TextStyle | undefined,
		resolveHyperlinkRelationshipId?: (target: string) => string | undefined,
	): XmlObject {
		const runProps: XmlObject = {
			'@_lang': style?.language || 'en-US',
			'@_dirty': '0',
		};
		if (!style) {
			return runProps;
		}

		// `a:rPr` is a sparse override of the layout/master/theme cascade, not a
		// description of the run. `owns(...)` is what keeps it sparse: it passes
		// a property the run itself authored or that has since been EDITED, and
		// blocks one the flat style merely inherited. Styles with no recorded
		// baseline (SDK-built text, synthetic test styles) pass everything, so
		// nothing that never came from a deck changes shape. See
		// `authored-run-style.ts`.
		const owns = createRunStyleGate(style);

		if (typeof style.fontSize === 'number' && Number.isFinite(style.fontSize) && owns('fontSize')) {
			runProps['@_sz'] = String(Math.round(style.fontSize * (72 / 96) * 100));
		}
		if (style.bold !== undefined && owns('bold')) {
			runProps['@_b'] = style.bold ? '1' : '0';
		}
		if (style.italic !== undefined && owns('italic')) {
			runProps['@_i'] = style.italic ? '1' : '0';
		}
		const ownsUnderline = owns('underline', 'underlineStyle', 'underlineExplicitNone');
		if (style.underline && ownsUnderline) {
			runProps['@_u'] = style.underlineStyle || 'sng';
		} else if (style.underlineExplicitNone && ownsUnderline) {
			// Re-emit an explicitly authored `u="none"` suppression rather than
			// collapsing it to inherit (which would let an inherited underline
			// bleed through).
			runProps['@_u'] = 'none';
		}
		if (style.strikethrough !== undefined && owns('strikethrough', 'strikeType')) {
			runProps['@_strike'] = style.strikethrough ? style.strikeType || 'sngStrike' : 'noStrike';
		}
		// Superscript / subscript baseline
		if (typeof style.baseline === 'number' && style.baseline !== 0 && owns('baseline')) {
			runProps['@_baseline'] = String(style.baseline);
		}
		// Character spacing
		if (
			typeof style.characterSpacing === 'number' &&
			style.characterSpacing !== 0 &&
			owns('characterSpacing')
		) {
			runProps['@_spc'] = String(style.characterSpacing);
		}
		// Kerning
		if (typeof style.kerning === 'number' && style.kerning !== 0 && owns('kerning')) {
			runProps['@_kern'] = String(style.kerning);
		}
		// Text caps
		const ownsCaps = owns('textCaps', 'textCapsExplicitNone');
		if (style.textCaps && style.textCaps !== 'none' && ownsCaps) {
			runProps['@_cap'] = style.textCaps;
		} else if (style.textCapsExplicitNone && ownsCaps) {
			// Re-emit an explicitly authored `cap="none"` rather than dropping it
			// to inherit (which would let an inherited caps style bleed through).
			runProps['@_cap'] = 'none';
		}
		// NOTE (corrected): run-level `rtl` IS valid on
		// CT_TextCharacterProperties, but as a child ELEMENT of type CT_Boolean
		// (`<a:rtl val="1"/>`) sequenced between `hlinkMouseOver` and `extLst`,
		// so it is emitted down in the child-element section below rather than
		// here among the attributes. What is NOT valid on `a:rPr` is the
		// ATTRIBUTE spelling `@rtl`: that one belongs to
		// CT_TextParagraphProperties, where `buildParagraphPropertiesXml`
		// writes it. The note that used to sit here claimed the whole property
		// was paragraph-only, which is why run-level RTL was never written at
		// all; a comment asserting a false schema fact is a much better way of
		// keeping a bug alive than the bug itself, so it is corrected rather
		// than deleted.
		// Run metadata
		if (style.kumimoji !== undefined && owns('kumimoji')) {
			runProps['@_kumimoji'] = style.kumimoji ? '1' : '0';
		}
		if (style.normalizeHeight !== undefined && owns('normalizeHeight')) {
			runProps['@_normalizeH'] = style.normalizeHeight ? '1' : '0';
		}
		if (style.noProof !== undefined && owns('noProof')) {
			runProps['@_noProof'] = style.noProof ? '1' : '0';
		}
		if (style.dirty !== undefined) {
			runProps['@_dirty'] = style.dirty ? '1' : '0';
		}
		if (style.spellingError !== undefined && owns('spellingError')) {
			runProps['@_err'] = style.spellingError ? '1' : '0';
		}
		if (style.smartTagClean !== undefined && owns('smartTagClean')) {
			runProps['@_smtClean'] = style.smartTagClean ? '1' : '0';
		}
		if (style.bookmark && owns('bookmark')) {
			runProps['@_bmk'] = style.bookmark;
		}
		// Alternative language and SmartTag id (CT_TextCharacterProperties).
		if (style.altLanguage && owns('altLanguage')) {
			runProps['@_altLang'] = style.altLanguage;
		}
		if (
			typeof style.smartTagId === 'number' &&
			Number.isFinite(style.smartTagId) &&
			owns('smartTagId')
		) {
			runProps['@_smtId'] = String(style.smartTagId);
		}
		// OOXML CT_TextCharacterProperties child element order (fast-xml-parser
		// serialises keys in insertion order, so every child must be assigned
		// in this exact sequence — any reversal triggers
		// Sch_UnexpectedElementContentExpectingComplex and PowerPoint's
		// file-corruption/repair dialog):
		//   ln, (noFill | solidFill | gradFill | pattFill), effectLst, highlight,
		//   (uLnTx | uLn), (uFillTx | uFill), latin, ea, cs, sym,
		//   hlinkClick, hlinkMouseOver, rtl, extLst.

		// 1. a:ln (text outline)
		if (
			(style.textOutlineWidth || style.textOutlineColor) &&
			owns('textOutlineWidth', 'textOutlineColor')
		) {
			const lnObj: XmlObject = {};
			if (typeof style.textOutlineWidth === 'number' && style.textOutlineWidth > 0) {
				lnObj['@_w'] = String(Math.round(style.textOutlineWidth * PptxHandlerRuntime.EMU_PER_PX));
			}
			if (style.textOutlineColor) {
				lnObj['a:solidFill'] = {
					'a:srgbClr': {
						'@_val': style.textOutlineColor.replace('#', ''),
					},
				};
			}
			runProps['a:ln'] = lnObj;
		}

		// 2. fill: EG_FillProperties is a CHOICE, so at most one of
		// noFill / solidFill / gradFill / pattFill may be emitted.
		//
		// `a:noFill` (hollow, outline-only WordArt) MUST be tested FIRST, and the
		// ordering is the entire fix: a hollow run still arrives here carrying a
		// `color`, because run styles are assembled as
		// `{...mergedDefaultRunStyle, ...extractTextRunStyle(rPr)}` and the
		// inherited theme / placeholder / master colour fills the very slot the
		// authored `<a:noFill/>` deliberately left empty. Testing `style.color`
		// first therefore rewrote EVERY hollow run as `<a:solidFill>` of the
		// inherited colour, so the effect was lost permanently on the first
		// round-trip and could never be recovered from the saved file.
		//
		// The whole choice is gated as ONE unit because it is one XML slot: a run
		// that authored no fill at all takes the theme/master colour through
		// inheritance, and re-emitting that as a literal `<a:srgbClr/>` is what
		// stopped re-themed decks from restyling their text. `colorXml` alone
		// could not save it: an inherited colour has no preserved node, so
		// `serializeColorChoice` had nothing to fall back on and wrote the hex.
		const ownsFill = owns(
			'textFillNone',
			'color',
			'textFillGradientStops',
			'textFillGradientType',
			'textFillPattern',
		);
		if (ownsFill && style.textFillNone) {
			runProps['a:noFill'] = {};
		} else if (ownsFill && style.color) {
			const resolvedOriginalColor = style.colorXml ? this.parseColor(style.colorXml) : undefined;
			runProps['a:solidFill'] = serializeColorChoiceWithRef(
				style.colorRef,
				style.colorXml,
				resolvedOriginalColor,
				style.color,
			);
		} else if (ownsFill && style.textFillGradientStops && style.textFillGradientStops.length > 0) {
			const gradStops = style.textFillGradientStops
				.filter((stop) => Boolean(stop?.color))
				.map((stop) => {
					const rawPos = (stop.position ?? 0) / 100;
					const posVal = Math.round(Math.max(0, Math.min(1, rawPos)) * 100000);
					const stopXml: XmlObject = {
						'@_pos': String(posVal),
						'a:srgbClr': {
							'@_val': String(stop.color || '').replace('#', ''),
						},
					};
					if (
						typeof stop.opacity === 'number' &&
						Number.isFinite(stop.opacity) &&
						stop.opacity < 1
					) {
						(stopXml['a:srgbClr'] as XmlObject)['a:alpha'] = {
							'@_val': String(Math.round(stop.opacity * 100000)),
						};
					}
					return stopXml;
				});
			if (gradStops.length > 0) {
				const gradFillXml: XmlObject = {
					'a:gsLst': { 'a:gs': gradStops },
				};
				const gradType = style.textFillGradientType || 'linear';
				if (gradType === 'linear') {
					const angle =
						typeof style.textFillGradientAngle === 'number' &&
						Number.isFinite(style.textFillGradientAngle)
							? style.textFillGradientAngle
							: 0;
					gradFillXml['a:lin'] = {
						'@_ang': String(Math.round(angle * 60000)),
						'@_scaled': '1',
					};
				} else {
					gradFillXml['a:path'] = { '@_path': 'circle' };
				}
				runProps['a:gradFill'] = gradFillXml;
			}
		} else if (ownsFill && style.textFillPattern) {
			const pattFill: XmlObject = { '@_prst': style.textFillPattern };
			if (style.textFillPatternForeground) {
				pattFill['a:fgClr'] = {
					'a:srgbClr': {
						'@_val': style.textFillPatternForeground.replace('#', ''),
					},
				};
			}
			if (style.textFillPatternBackground) {
				pattFill['a:bgClr'] = {
					'a:srgbClr': {
						'@_val': style.textFillPatternBackground.replace('#', ''),
					},
				};
			}
			runProps['a:pattFill'] = pattFill;
		}

		// 3. a:effectLst (text run effects)
		const textEffectLst = buildTextRunEffectListXml(style);
		if (textEffectLst) {
			runProps['a:effectLst'] = textEffectLst;
		}

		// 3b. a:effectDag (run-level effect graph). Per ECMA-376 §21.1.2.3.6
		// `effectDag` is the choice-alternative to `effectLst` on
		// CT_TextCharacterProperties. We round-trip it from the raw XML
		// captured at parse time. The typed tree is held in parallel for
		// downstream consumers; the raw blob is authoritative on save.
		if (style.textEffectDagXml) {
			runProps['a:effectDag'] = style.textEffectDagXml;
		}

		// 4. a:highlight — re-emit the preserved colour-choice verbatim (keeping
		// a themed `a:schemeClr` highlight themed) when the resolved hex still
		// matches; otherwise fall back to a canonical srgbClr.
		if (style.highlightColor && owns('highlightColor')) {
			const resolvedHighlight = style.highlightColorXml
				? this.parseColor(style.highlightColorXml)
				: undefined;
			runProps['a:highlight'] = serializeColorChoiceWithRef(
				undefined,
				style.highlightColorXml,
				resolvedHighlight,
				style.highlightColor,
			);
		}

		// 5a. a:uLnTx / a:uLn (underline line — follows-text marker or explicit
		// line styling). #85: previously the parsed uLn line props were dropped
		// and never re-emitted.
		if (style.underlineLineFollowsText && owns('underlineLineFollowsText')) {
			runProps['a:uLnTx'] = {};
		} else if (style.underlineLine && owns('underlineLine')) {
			runProps['a:uLn'] = buildUnderlineLineXml(style.underlineLine);
		}

		// 5b. a:uFillTx / a:uFill (underline fill — follows-text marker or colour)
		if (style.underlineFillFollowsText && owns('underlineFillFollowsText')) {
			runProps['a:uFillTx'] = {};
		} else if (style.underline && style.underlineColor && owns('underlineColor')) {
			runProps['a:uFill'] = {
				'a:solidFill': {
					'a:srgbClr': {
						'@_val': style.underlineColor.replace('#', ''),
					},
				},
			};
		}

		// 6. typefaces: latin, ea, cs, sym (CT_TextFont — typeface plus
		// optional @panose, @pitchFamily, @charset metadata).
		// #84 closed the SYNTHESIS half of this: the writer no longer copies the
		// Latin face into `a:ea` / `a:cs`, and it prefers a preserved theme token
		// (`+mn-lt`) over the concrete face. That fix is intact, but it was only
		// half the defect: `style.eastAsiaFont` is populated by INHERITANCE as
		// well as by authoring, so a CJK deck whose runs carried no `a:ea` still
		// round-tripped 0 -> 19 of them, resolved off the theme's `a:ea` and
		// therefore no longer following it. `owns(...)` closes that half.
		const latinFace = style.latinFontThemeToken ?? style.fontFamily;
		if (latinFace && owns('fontFamily', 'latinFontThemeToken')) {
			runProps['a:latin'] = applyFontMetadata(
				{ '@_typeface': latinFace },
				style.latinFontPanose,
				style.latinFontPitchFamily,
				style.latinFontCharset,
			);
		}
		const eastAsiaFace = style.eastAsiaFontThemeToken ?? style.eastAsiaFont;
		if (eastAsiaFace && owns('eastAsiaFont', 'eastAsiaFontThemeToken')) {
			runProps['a:ea'] = applyFontMetadata(
				{ '@_typeface': eastAsiaFace },
				style.eastAsiaFontPanose,
				style.eastAsiaFontPitchFamily,
				style.eastAsiaFontCharset,
			);
		}
		const complexScriptFace = style.complexScriptFontThemeToken ?? style.complexScriptFont;
		if (complexScriptFace && owns('complexScriptFont', 'complexScriptFontThemeToken')) {
			runProps['a:cs'] = applyFontMetadata(
				{ '@_typeface': complexScriptFace },
				style.complexScriptFontPanose,
				style.complexScriptFontPitchFamily,
				style.complexScriptFontCharset,
			);
		}
		if (style.symbolFont && owns('symbolFont')) {
			runProps['a:sym'] = applyFontMetadata(
				{ '@_typeface': style.symbolFont },
				style.symbolFontPanose,
				style.symbolFontPitchFamily,
				style.symbolFontCharset,
			);
		}

		// 7. hlinkClick / hlinkMouseOver
		if (style.hyperlink && resolveHyperlinkRelationshipId) {
			const hyperlinkTarget = String(style.hyperlink).trim();
			// Action hyperlinks (ppaction:// verbs) don't need relationship IDs
			if (hyperlinkTarget.startsWith('ppaction://')) {
				const hlinkNode: XmlObject = {
					'@_action': hyperlinkTarget,
				};
				if (style.hyperlinkTooltip) {
					hlinkNode['@_tooltip'] = style.hyperlinkTooltip;
				}
				// Some action links (e.g. hlinksldjump) still need an rId
				if (style.hyperlinkRId) {
					hlinkNode['@_r:id'] = style.hyperlinkRId;
				}
				this.applyHyperlinkExtraAttrs(hlinkNode, style);
				runProps['a:hlinkClick'] = hlinkNode;
			} else if (hyperlinkTarget.length > 0) {
				const hyperlinkRelationshipId = resolveHyperlinkRelationshipId(hyperlinkTarget);
				if (hyperlinkRelationshipId) {
					const hlinkNode: XmlObject = {
						'@_r:id': hyperlinkRelationshipId,
					};
					if (style.hyperlinkTooltip) {
						hlinkNode['@_tooltip'] = style.hyperlinkTooltip;
					}
					if (style.hyperlinkAction) {
						hlinkNode['@_action'] = style.hyperlinkAction;
					}
					this.applyHyperlinkExtraAttrs(hlinkNode, style);
					runProps['a:hlinkClick'] = hlinkNode;
				}
			}
		}
		if (style.hyperlinkMouseOver && resolveHyperlinkRelationshipId) {
			const mouseOverTarget = String(style.hyperlinkMouseOver).trim();
			if (mouseOverTarget.length > 0) {
				const mouseOverRelId = resolveHyperlinkRelationshipId(mouseOverTarget);
				if (mouseOverRelId) {
					const mouseOverNode: XmlObject = { '@_r:id': mouseOverRelId };
					// Round-trip the preserved mouse-over sound (`a:snd`) instead of
					// dropping it (the previous save emitted only `@r:id`).
					if (
						style.hyperlinkMouseOverSoundXml &&
						typeof style.hyperlinkMouseOverSoundXml === 'object'
					) {
						mouseOverNode['a:snd'] = style.hyperlinkMouseOverSoundXml;
					}
					runProps['a:hlinkMouseOver'] = mouseOverNode;
				}
			}
		}

		// 8. a:rtl — the run-level right-to-left flag, and the LAST child before
		// `a:extLst` in the CT_TextCharacterProperties sequence (see the
		// corrected note above: on a run it is a CT_Boolean child element, not
		// the `@rtl` attribute that CT_TextParagraphProperties declares). It has
		// to be assigned after `a:hlinkMouseOver` because fast-xml-parser
		// serialises keys in insertion order.
		if (style.rtl !== undefined && owns('rtl')) {
			runProps['a:rtl'] = { '@_val': style.rtl ? '1' : '0' };
		}

		// `a:extLst` is the final child of CT_TextCharacterProperties. Re-emit the
		// captured opaque run-level extension subtree verbatim when present so
		// authored extensions survive a round-trip.
		if (style.runPropertiesExtLstXml && typeof style.runPropertiesExtLstXml === 'object') {
			runProps['a:extLst'] = style.runPropertiesExtLstXml;
		}

		return runProps;
	}

	private applyHyperlinkExtraAttrs(hlinkNode: XmlObject, style: TextStyle): void {
		if (style.hyperlinkInvalidUrl) {
			hlinkNode['@_invalidUrl'] = style.hyperlinkInvalidUrl;
		}
		if (style.hyperlinkTargetFrame) {
			hlinkNode['@_tgtFrame'] = style.hyperlinkTargetFrame;
		}
		if (style.hyperlinkHistory !== undefined) {
			hlinkNode['@_history'] = style.hyperlinkHistory ? '1' : '0';
		}
		if (style.hyperlinkHighlightClick !== undefined) {
			hlinkNode['@_highlightClick'] = style.hyperlinkHighlightClick ? '1' : '0';
		}
		if (style.hyperlinkEndSound !== undefined) {
			hlinkNode['@_endSnd'] = style.hyperlinkEndSound ? '1' : '0';
		}
		// CT_Hyperlink sequences `a:snd` before `a:extLst`; here it is the only
		// child, so re-emit the preserved embedded-WAV subtree verbatim.
		if (style.hyperlinkSoundXml && typeof style.hyperlinkSoundXml === 'object') {
			hlinkNode['a:snd'] = style.hyperlinkSoundXml;
		}
	}
}
