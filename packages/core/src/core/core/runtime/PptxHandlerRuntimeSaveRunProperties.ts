import { XmlObject, TextStyle } from '../../types';
import { serializeColorChoice } from '../../utils/color-xml-preservation';
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

		if (typeof style.fontSize === 'number' && Number.isFinite(style.fontSize)) {
			runProps['@_sz'] = String(Math.round(style.fontSize * (72 / 96) * 100));
		}
		if (style.bold !== undefined) {
			runProps['@_b'] = style.bold ? '1' : '0';
		}
		if (style.italic !== undefined) {
			runProps['@_i'] = style.italic ? '1' : '0';
		}
		if (style.underline) {
			runProps['@_u'] = style.underlineStyle || 'sng';
		} else if (style.underlineExplicitNone) {
			// Re-emit an explicitly authored `u="none"` suppression rather than
			// collapsing it to inherit (which would let an inherited underline
			// bleed through).
			runProps['@_u'] = 'none';
		}
		if (style.strikethrough !== undefined) {
			runProps['@_strike'] = style.strikethrough ? style.strikeType || 'sngStrike' : 'noStrike';
		}
		// Superscript / subscript baseline
		if (typeof style.baseline === 'number' && style.baseline !== 0) {
			runProps['@_baseline'] = String(style.baseline);
		}
		// Character spacing
		if (typeof style.characterSpacing === 'number' && style.characterSpacing !== 0) {
			runProps['@_spc'] = String(style.characterSpacing);
		}
		// Kerning
		if (typeof style.kerning === 'number' && style.kerning !== 0) {
			runProps['@_kern'] = String(style.kerning);
		}
		// Text caps
		if (style.textCaps && style.textCaps !== 'none') {
			runProps['@_cap'] = style.textCaps;
		} else if (style.textCapsExplicitNone) {
			// Re-emit an explicitly authored `cap="none"` rather than dropping it
			// to inherit (which would let an inherited caps style bleed through).
			runProps['@_cap'] = 'none';
		}
		// NOTE: `rtl` is only valid on CT_TextParagraphProperties (a:pPr), not
		// CT_TextCharacterProperties (a:rPr). Emitting it here produces a
		// Sch_UndeclaredAttribute violation and triggers PowerPoint's file-
		// corruption/repair dialog. Paragraph-level rtl is emitted by
		// buildParagraphPropertiesXml.
		// Run metadata
		if (style.kumimoji !== undefined) {
			runProps['@_kumimoji'] = style.kumimoji ? '1' : '0';
		}
		if (style.normalizeHeight !== undefined) {
			runProps['@_normalizeH'] = style.normalizeHeight ? '1' : '0';
		}
		if (style.noProof !== undefined) {
			runProps['@_noProof'] = style.noProof ? '1' : '0';
		}
		if (style.dirty !== undefined) {
			runProps['@_dirty'] = style.dirty ? '1' : '0';
		}
		if (style.spellingError !== undefined) {
			runProps['@_err'] = style.spellingError ? '1' : '0';
		}
		if (style.smartTagClean !== undefined) {
			runProps['@_smtClean'] = style.smartTagClean ? '1' : '0';
		}
		if (style.bookmark) {
			runProps['@_bmk'] = style.bookmark;
		}
		// Alternative language and SmartTag id (CT_TextCharacterProperties).
		if (style.altLanguage) {
			runProps['@_altLang'] = style.altLanguage;
		}
		if (typeof style.smartTagId === 'number' && Number.isFinite(style.smartTagId)) {
			runProps['@_smtId'] = String(style.smartTagId);
		}
		// OOXML CT_TextCharacterProperties child element order (fast-xml-parser
		// serialises keys in insertion order, so every child must be assigned
		// in this exact sequence — any reversal triggers
		// Sch_UnexpectedElementContentExpectingComplex and PowerPoint's
		// file-corruption/repair dialog):
		//   ln, (solidFill | gradFill | pattFill), effectLst, highlight,
		//   (uLnTx | uLn), (uFillTx | uFill), latin, ea, cs, sym,
		//   hlinkClick, hlinkMouseOver.

		// 1. a:ln (text outline)
		if (style.textOutlineWidth || style.textOutlineColor) {
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

		// 2. fill (solidFill | gradFill | pattFill — schema allows at most one)
		if (style.color) {
			const resolvedOriginalColor = style.colorXml ? this.parseColor(style.colorXml) : undefined;
			runProps['a:solidFill'] = serializeColorChoice(
				style.colorXml,
				resolvedOriginalColor,
				style.color,
			);
		} else if (style.textFillGradientStops && style.textFillGradientStops.length > 0) {
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
		} else if (style.textFillPattern) {
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
		if (style.highlightColor) {
			const resolvedHighlight = style.highlightColorXml
				? this.parseColor(style.highlightColorXml)
				: undefined;
			runProps['a:highlight'] = serializeColorChoice(
				style.highlightColorXml,
				resolvedHighlight,
				style.highlightColor,
			);
		}

		// 5a. a:uLnTx / a:uLn (underline line — follows-text marker or explicit
		// line styling). #85: previously the parsed uLn line props were dropped
		// and never re-emitted.
		if (style.underlineLineFollowsText) {
			runProps['a:uLnTx'] = {};
		} else if (style.underlineLine) {
			runProps['a:uLn'] = buildUnderlineLineXml(style.underlineLine);
		}

		// 5b. a:uFillTx / a:uFill (underline fill — follows-text marker or colour)
		if (style.underlineFillFollowsText) {
			runProps['a:uFillTx'] = {};
		} else if (style.underline && style.underlineColor) {
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
		// #84: Prefer the preserved theme token (`+mn-lt`) over the flattened
		// concrete face, and only emit `a:ea` / `a:cs` when the source actually
		// carried them. Synthesizing `a:ea = a:cs = latinFont` (the old
		// behaviour) forces CJK / complex-script glyphs onto the Latin face.
		const latinFace = style.latinFontThemeToken ?? style.fontFamily;
		if (latinFace) {
			runProps['a:latin'] = applyFontMetadata(
				{ '@_typeface': latinFace },
				style.latinFontPanose,
				style.latinFontPitchFamily,
				style.latinFontCharset,
			);
		}
		const eastAsiaFace = style.eastAsiaFontThemeToken ?? style.eastAsiaFont;
		if (eastAsiaFace) {
			runProps['a:ea'] = applyFontMetadata(
				{ '@_typeface': eastAsiaFace },
				style.eastAsiaFontPanose,
				style.eastAsiaFontPitchFamily,
				style.eastAsiaFontCharset,
			);
		}
		const complexScriptFace = style.complexScriptFontThemeToken ?? style.complexScriptFont;
		if (complexScriptFace) {
			runProps['a:cs'] = applyFontMetadata(
				{ '@_typeface': complexScriptFace },
				style.complexScriptFontPanose,
				style.complexScriptFontPitchFamily,
				style.complexScriptFontCharset,
			);
		}
		if (style.symbolFont) {
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
