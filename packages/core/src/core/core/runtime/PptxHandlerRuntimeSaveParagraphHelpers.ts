import { XmlObject, TextStyle, TextSegment } from '../../types';
import type { BulletInfo } from '../../types';

/** EMU-per-pixel conversion constant (matches PptxHandlerRuntime.EMU_PER_PX). */
export const EMU_PER_PX = 9525;

/** Pre-computed spacing XML objects for the paragraph builder. */
export interface ParagraphSpacingConfig {
	spacingBefore: XmlObject | undefined;
	spacingAfter: XmlObject | undefined;
	lineSpacing: XmlObject | undefined;
	lineSpacingExactPt: number | undefined;
}

/** Build the `a:pPr` (paragraph properties) XML object. */
export function buildParagraphPropertiesXml(
	textStyle: TextStyle | undefined,
	paragraphAlign: string | undefined,
	bulletInfo: BulletInfo | undefined,
	spacing: ParagraphSpacingConfig,
	level?: number,
): XmlObject {
	const paragraphProps: XmlObject = {};

	// CT_TextParagraphProperties: `lvl` is an attribute on `a:pPr`. Only emit
	// when non-zero — PowerPoint omits the attribute for top-level paragraphs.
	if (typeof level === 'number' && Number.isFinite(level) && level > 0) {
		paragraphProps['@_lvl'] = String(Math.min(Math.max(Math.round(level), 0), 8));
	}

	if (paragraphAlign) {
		paragraphProps['@_algn'] = paragraphAlign;
	}
	if (textStyle?.rtl !== undefined) {
		paragraphProps['@_rtl'] = textStyle.rtl ? '1' : '0';
	}

	// Spacing: CT_TextParagraphProperties child order is lnSpc, spcBef, spcAft.
	// fast-xml-parser serialises keys in insertion order, so assign in this
	// exact sequence — otherwise PowerPoint flags the file as corrupted.
	if (spacing.lineSpacing) {
		paragraphProps['a:lnSpc'] = spacing.lineSpacing;
	} else if (
		typeof spacing.lineSpacingExactPt === 'number' &&
		Number.isFinite(spacing.lineSpacingExactPt)
	) {
		paragraphProps['a:lnSpc'] = {
			'a:spcPts': {
				'@_val': String(Math.round(spacing.lineSpacingExactPt * 100)),
			},
		};
	}
	if (spacing.spacingBefore) {
		paragraphProps['a:spcBef'] = spacing.spacingBefore;
	}
	if (spacing.spacingAfter) {
		paragraphProps['a:spcAft'] = spacing.spacingAfter;
	}

	// Paragraph indentation (marL, marR, indent — stored in px, written as EMU)
	if (
		typeof textStyle?.paragraphMarginLeft === 'number' &&
		Number.isFinite(textStyle.paragraphMarginLeft)
	) {
		paragraphProps['@_marL'] = String(Math.round(textStyle.paragraphMarginLeft * EMU_PER_PX));
	}
	if (
		typeof textStyle?.paragraphMarginRight === 'number' &&
		Number.isFinite(textStyle.paragraphMarginRight)
	) {
		paragraphProps['@_marR'] = String(Math.round(textStyle.paragraphMarginRight * EMU_PER_PX));
	}
	if (
		typeof textStyle?.paragraphIndent === 'number' &&
		Number.isFinite(textStyle.paragraphIndent)
	) {
		paragraphProps['@_indent'] = String(Math.round(textStyle.paragraphIndent * EMU_PER_PX));
	}

	// Tab stops
	if (textStyle?.tabStops && textStyle.tabStops.length > 0) {
		paragraphProps['a:tabLst'] = {
			'a:tab': textStyle.tabStops.map((tab) => {
				const tabObj: XmlObject = {
					'@_pos': String(Math.round(tab.position * EMU_PER_PX)),
				};
				if (tab.align && tab.align !== 'l') {
					tabObj['@_algn'] = tab.align;
				}
				if (tab.leader && tab.leader !== 'none') {
					tabObj['@_leader'] = tab.leader;
				}
				return tabObj;
			}),
		};
	}

	// Additional paragraph properties
	if (typeof textStyle?.defaultTabSize === 'number' && Number.isFinite(textStyle.defaultTabSize)) {
		paragraphProps['@_defTabSz'] = String(Math.round(textStyle.defaultTabSize * EMU_PER_PX));
	}
	if (textStyle?.eaLineBreak !== undefined) {
		paragraphProps['@_eaLnBrk'] = textStyle.eaLineBreak ? '1' : '0';
	}
	if (textStyle?.latinLineBreak !== undefined) {
		paragraphProps['@_latinLnBrk'] = textStyle.latinLineBreak ? '1' : '0';
	}
	if (textStyle?.fontAlignment) {
		paragraphProps['@_fontAlgn'] = textStyle.fontAlignment;
	}
	if (textStyle?.hangingPunctuation !== undefined) {
		paragraphProps['@_hangingPunct'] = textStyle.hangingPunctuation ? '1' : '0';
	}

	// `a:defRPr` — paragraph default run properties. CT_TextParagraphProperties
	// places `defRPr` *before* the bullet group in document order. fast-xml-parser
	// emits keys in insertion order, so assign here ahead of the bullet block.
	if (textStyle?.paragraphDefaultRunPropertiesXml) {
		paragraphProps['a:defRPr'] = textStyle.paragraphDefaultRunPropertiesXml;
	}

	// Bullet properties
	if (bulletInfo) {
		applyBulletProperties(paragraphProps, bulletInfo);
	}

	// `a:extLst` is the very last child of CT_TextParagraphProperties. Re-emit
	// the captured opaque subtree verbatim when present so authored extensions
	// survive a round-trip.
	if (textStyle?.paragraphPropertiesExtLstXml) {
		paragraphProps['a:extLst'] = textStyle.paragraphPropertiesExtLstXml;
	}

	return paragraphProps;
}

/** Apply bullet-related XML attributes from {@link BulletInfo} into `paragraphProps`. */
export function applyBulletProperties(paragraphProps: XmlObject, bulletInfo: BulletInfo): void {
	// CT_TextParagraphProperties bullet-group schema order:
	//   buClr (color), buSzPct/buSzPts (size), buFont (typeface),
	//   buNone/buAutoNum/buChar/buBlip (type). fast-xml-parser serialises
	//   keys in insertion order, so assign in this exact sequence or
	//   PowerPoint's validator rejects the run.
	if (bulletInfo.none) {
		paragraphProps['a:buNone'] = {};
		return;
	}
	// Inherit-from-text variants take precedence over the explicit
	// `buClr` / `buSzPct|Pts` / `buFont` declarations: when both forms are
	// present the schema only allows one. Emit `<a:buClrTx/>` etc. when the
	// parsed model captured the marker.
	if (bulletInfo.colorInherit) {
		paragraphProps['a:buClrTx'] = {};
	} else if (bulletInfo.colorXml) {
		// Re-emit the original colour-choice node (a:schemeClr / a:sysClr /
		// a:prstClr / a:srgbClr plus any colour transforms) verbatim so themed
		// bullet colours survive a round-trip.
		paragraphProps['a:buClr'] = bulletInfo.colorXml;
	} else if (bulletInfo.color) {
		const colorHex = bulletInfo.color.replace('#', '');
		paragraphProps['a:buClr'] = {
			'a:srgbClr': { '@_val': colorHex },
		};
	}
	if (bulletInfo.sizeInherit) {
		paragraphProps['a:buSzTx'] = {};
	} else if (bulletInfo.sizePercent !== undefined) {
		paragraphProps['a:buSzPct'] = {
			'@_val': String(Math.round(bulletInfo.sizePercent * 1000)),
		};
	} else if (bulletInfo.sizePts !== undefined) {
		paragraphProps['a:buSzPts'] = {
			'@_val': String(Math.round(bulletInfo.sizePts * 100)),
		};
	}
	if (bulletInfo.fontInherit) {
		paragraphProps['a:buFontTx'] = {};
	} else if (bulletInfo.fontFamily) {
		paragraphProps['a:buFont'] = {
			'@_typeface': bulletInfo.fontFamily,
		};
	}
	if (bulletInfo.char) {
		paragraphProps['a:buChar'] = { '@_char': bulletInfo.char };
	}
	if (bulletInfo.autoNumType) {
		const buAutoNum: XmlObject = {
			'@_type': bulletInfo.autoNumType,
		};
		if (bulletInfo.autoNumStartAt !== undefined && bulletInfo.autoNumStartAt !== 1) {
			buAutoNum['@_startAt'] = String(bulletInfo.autoNumStartAt);
		}
		paragraphProps['a:buAutoNum'] = buAutoNum;
	}
	if (bulletInfo.imageRelId) {
		paragraphProps['a:buBlip'] = {
			'a:blip': { '@_r:embed': bulletInfo.imageRelId },
		};
	}
}

/** Assemble a paragraph XML object from runs and pre-built paragraph properties. */
export function assembleParagraphXml(
	runs: XmlObject[],
	paragraphProps: XmlObject,
	endParaRunProperties?: Record<string, unknown>,
): XmlObject {
	// OOXML CT_TextParagraph requires child order: pPr?, (r|br|fld)*, endParaRPr?.
	// Since fast-xml-parser serialises keys in insertion order, build the
	// object in that exact sequence. Soft line breaks (`a:br`), equation
	// nodes (`m:oMath` / `m:oMathPara` / `mc:AlternateContent`), and runs
	// are routed under their respective keys.
	const paragraph: XmlObject = {
		'a:pPr': paragraphProps,
	};

	const stripMarker = (run: XmlObject, marker: string): XmlObject => {
		const { [marker]: _drop, ...rest } = run as Record<string, unknown>;
		return rest as XmlObject;
	};

	// Partition runs by type, preserving insertion order.
	const regularRuns: XmlObject[] = [];
	const fieldRuns: XmlObject[] = [];
	const breakRuns: XmlObject[] = [];
	const mathOMathPara: XmlObject[] = [];
	const mathOMath: XmlObject[] = [];
	const mathAlternate: XmlObject[] = [];
	for (const run of runs) {
		if ((run as Record<string, unknown>).__isField) {
			fieldRuns.push(stripMarker(run, '__isField'));
		} else if ((run as Record<string, unknown>).__isLineBreak) {
			breakRuns.push(stripMarker(run, '__isLineBreak'));
		} else if ((run as Record<string, unknown>).__isEquation) {
			const eqXml = (run as Record<string, unknown>).__equationXml as
				| Record<string, unknown>
				| undefined;
			if (eqXml) {
				if (eqXml['m:oMathPara']) {
					mathOMathPara.push(eqXml['m:oMathPara'] as XmlObject);
				} else if (eqXml['m:oMath']) {
					mathOMath.push(eqXml['m:oMath'] as XmlObject);
				} else if (eqXml['mc:AlternateContent']) {
					mathAlternate.push(eqXml['mc:AlternateContent'] as XmlObject);
				} else if (eqXml['a14:m']) {
					// a14:m wraps an inline math element; re-emit verbatim.
					mathAlternate.push({ ...(eqXml as XmlObject) });
				} else {
					// Fallback: assume the captured object is itself the math node.
					mathOMath.push(eqXml as XmlObject);
				}
			}
		} else {
			regularRuns.push(stripMarker(run, '__isField'));
		}
	}

	if (regularRuns.length > 0) {
		paragraph['a:r'] = regularRuns.length > 1 ? regularRuns : regularRuns[0];
	}
	if (breakRuns.length > 0) {
		paragraph['a:br'] = breakRuns.length > 1 ? breakRuns : breakRuns[0];
	}
	if (fieldRuns.length > 0) {
		paragraph['a:fld'] = fieldRuns.length > 1 ? fieldRuns : fieldRuns[0];
	}
	if (mathOMathPara.length > 0) {
		paragraph['m:oMathPara'] = mathOMathPara.length > 1 ? mathOMathPara : mathOMathPara[0];
	}
	if (mathOMath.length > 0) {
		paragraph['m:oMath'] = mathOMath.length > 1 ? mathOMath : mathOMath[0];
	}
	if (mathAlternate.length > 0) {
		paragraph['mc:AlternateContent'] = mathAlternate.length > 1 ? mathAlternate : mathAlternate[0];
	}
	if (
		regularRuns.length === 0 &&
		fieldRuns.length === 0 &&
		breakRuns.length === 0 &&
		mathOMathPara.length === 0 &&
		mathOMath.length === 0 &&
		mathAlternate.length === 0
	) {
		paragraph['a:r'] = runs.length > 1 ? runs : runs[0];
	}

	// Re-emit parsed end-paragraph run properties verbatim. When none were
	// captured (e.g. SDK-built paragraphs) fall back to the minimal
	// `lang="en-US"` stub PowerPoint itself emits for new paragraphs.
	if (endParaRunProperties && typeof endParaRunProperties === 'object') {
		paragraph['a:endParaRPr'] = endParaRunProperties as XmlObject;
	} else {
		paragraph['a:endParaRPr'] = { '@_lang': 'en-US' };
	}

	return paragraph;
}

/** Determine which style keys are uniform across all segments and apply parent overrides. */
export function computeUniformSegmentOverrides(
	textStyle: TextStyle | undefined,
	textSegments: TextSegment[],
): Partial<TextStyle> {
	const uniformSegmentOverrides: Partial<TextStyle> = {};
	const styleKeys: Array<keyof TextStyle> = [
		'fontFamily',
		'fontSize',
		'bold',
		'italic',
		'underline',
		'strikethrough',
		'rtl',
		'hyperlink',
		'color',
		'align',
	];
	styleKeys.forEach((styleKey) => {
		const nextValue = textStyle?.[styleKey];
		if (nextValue === undefined) {
			return;
		}
		const firstValue = textSegments[0]?.style?.[styleKey];
		const isUniform = textSegments.every((segment) => segment.style?.[styleKey] === firstValue);
		if (isUniform) {
			if (styleKey === 'fontFamily' && typeof nextValue === 'string') {
				uniformSegmentOverrides.fontFamily = nextValue;
			} else if (styleKey === 'fontSize' && typeof nextValue === 'number') {
				uniformSegmentOverrides.fontSize = nextValue;
			} else if (styleKey === 'bold' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.bold = nextValue;
			} else if (styleKey === 'italic' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.italic = nextValue;
			} else if (styleKey === 'underline' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.underline = nextValue;
			} else if (styleKey === 'strikethrough' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.strikethrough = nextValue;
			} else if (styleKey === 'rtl' && typeof nextValue === 'boolean') {
				uniformSegmentOverrides.rtl = nextValue;
			} else if (styleKey === 'hyperlink' && typeof nextValue === 'string') {
				uniformSegmentOverrides.hyperlink = nextValue;
			} else if (styleKey === 'color' && typeof nextValue === 'string') {
				uniformSegmentOverrides.color = nextValue;
			} else if (
				styleKey === 'align' &&
				(nextValue === 'left' ||
					nextValue === 'center' ||
					nextValue === 'right' ||
					nextValue === 'justify')
			) {
				uniformSegmentOverrides.align = nextValue;
			}
		}
	});

	return uniformSegmentOverrides;
}
