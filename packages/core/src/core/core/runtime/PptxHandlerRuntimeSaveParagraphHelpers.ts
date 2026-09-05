import { themeColorRefToSolidFillWithOpacity } from '../../color/theme-color-ref';
import { XmlObject, TextStyle } from '../../types';
import type { BulletInfo } from '../../types';
import type { ParagraphChild } from './paragraph-child-assembly';
import { classifyParagraphChild, writeParagraphChildren } from './paragraph-child-assembly';

export { computeUniformSegmentOverrides } from './uniform-segment-overrides';

/** EMU-per-pixel conversion constant (matches PptxHandlerRuntime.EMU_PER_PX). */
export const EMU_PER_PX = 9525;

/** Pre-computed spacing XML objects for the paragraph builder. */
export interface ParagraphSpacingConfig {
	spacingBefore: XmlObject | undefined;
	spacingAfter: XmlObject | undefined;
	lineSpacing: XmlObject | undefined;
	lineSpacingExactPt: number | undefined;
}

/**
 * Decide whether this paragraph may carry a given paragraph-scope property.
 *
 * `textStyle` reaching the builder is the SHAPE-level style merged with the
 * paragraph's own `a:pPr`, and the shape-level half is a *resolved* value: the
 * loader fills it, first-paragraph-wins, from the text body's `a:lstStyle`, the
 * inherited layout/master placeholder `a:pPr` and only then the paragraph's own
 * attributes. Writing all of it back onto every paragraph turned inherited
 * values into explicitly authored ones, which (a) churns every file on save and
 * (b) OVERRIDES the inheritance that would otherwise resolve per paragraph - so
 * a level-3 bullet was silently re-indented to the level-1 `marL` its shape
 * happened to resolve.
 *
 * Rule: emit a property the paragraph itself authored; otherwise emit the
 * shape-level value only when the paragraph authored NO properties of its own
 * AND sits at outline level 0, where the shape-level style is both the sole
 * description of it and was resolved through its own inheritance chain
 * (SDK-built decks, newly typed text, and any top-level `a:p` that carried no
 * `a:pPr`). A paragraph that authored an `a:pPr` keeps exactly the keys it
 * authored; everything else is left to inherit.
 *
 * The level test matters because the shape-level style is filled
 * first-paragraph-wins, so it describes level 0. Broadcasting it to a nested
 * bullet replaced that bullet's `a:lvl3pPr` indent with the level-1 one.
 */
function authoredPropertyGate(
	authoredProperties: TextStyle | undefined,
	level: number | undefined,
): (key: keyof TextStyle) => boolean {
	if (authoredProperties) {
		return (key) => authoredProperties[key] !== undefined;
	}
	const isNested = typeof level === 'number' && Number.isFinite(level) && level > 0;
	return () => !isNested;
}

/** Build the `a:pPr` (paragraph properties) XML object. */
export function buildParagraphPropertiesXml(
	textStyle: TextStyle | undefined,
	paragraphAlign: string | undefined,
	bulletInfo: BulletInfo | undefined,
	spacing: ParagraphSpacingConfig,
	level?: number,
	authoredProperties?: TextStyle,
): XmlObject {
	const paragraphProps: XmlObject = {};
	const owns = authoredPropertyGate(authoredProperties, level);

	// CT_TextParagraphProperties: `lvl` is an attribute on `a:pPr`. Only emit
	// when non-zero — PowerPoint omits the attribute for top-level paragraphs.
	if (typeof level === 'number' && Number.isFinite(level) && level > 0) {
		paragraphProps['@_lvl'] = String(Math.min(Math.max(Math.round(level), 0), 8));
	}

	if (paragraphAlign && owns('align')) {
		paragraphProps['@_algn'] = paragraphAlign;
	}
	if (textStyle?.rtl !== undefined && owns('rtl')) {
		paragraphProps['@_rtl'] = textStyle.rtl ? '1' : '0';
	}

	// Paragraph indentation (marL, marR, indent: stored in px, written as EMU)
	if (
		typeof textStyle?.paragraphMarginLeft === 'number' &&
		Number.isFinite(textStyle.paragraphMarginLeft) &&
		owns('paragraphMarginLeft')
	) {
		paragraphProps['@_marL'] = String(Math.round(textStyle.paragraphMarginLeft * EMU_PER_PX));
	}
	if (
		typeof textStyle?.paragraphMarginRight === 'number' &&
		Number.isFinite(textStyle.paragraphMarginRight) &&
		owns('paragraphMarginRight')
	) {
		paragraphProps['@_marR'] = String(Math.round(textStyle.paragraphMarginRight * EMU_PER_PX));
	}
	if (
		typeof textStyle?.paragraphIndent === 'number' &&
		Number.isFinite(textStyle.paragraphIndent) &&
		owns('paragraphIndent')
	) {
		paragraphProps['@_indent'] = String(Math.round(textStyle.paragraphIndent * EMU_PER_PX));
	}

	// Additional paragraph properties
	if (
		typeof textStyle?.defaultTabSize === 'number' &&
		Number.isFinite(textStyle.defaultTabSize) &&
		owns('defaultTabSize')
	) {
		paragraphProps['@_defTabSz'] = String(Math.round(textStyle.defaultTabSize * EMU_PER_PX));
	}
	if (textStyle?.eaLineBreak !== undefined && owns('eaLineBreak')) {
		paragraphProps['@_eaLnBrk'] = textStyle.eaLineBreak ? '1' : '0';
	}
	if (textStyle?.latinLineBreak !== undefined && owns('latinLineBreak')) {
		paragraphProps['@_latinLnBrk'] = textStyle.latinLineBreak ? '1' : '0';
	}
	if (textStyle?.fontAlignment && owns('fontAlignment')) {
		paragraphProps['@_fontAlgn'] = textStyle.fontAlignment;
	}
	if (textStyle?.hangingPunctuation !== undefined && owns('hangingPunctuation')) {
		paragraphProps['@_hangingPunct'] = textStyle.hangingPunctuation ? '1' : '0';
	}

	// CT_TextParagraphProperties child order (ECMA-376 21.1.2.2.7):
	//   lnSpc, spcBef, spcAft, <bullet group>, tabLst, defRPr, extLst.
	// The bullet group is itself ordered: buClr*, buSz*, buFont*, bu<type>.
	// fast-xml-parser serialises keys in insertion order, so assign in this
	// exact sequence — otherwise PowerPoint flags the file as corrupted.
	if (spacing.lineSpacing && owns('lineSpacing')) {
		paragraphProps['a:lnSpc'] = spacing.lineSpacing;
	} else if (
		typeof spacing.lineSpacingExactPt === 'number' &&
		Number.isFinite(spacing.lineSpacingExactPt) &&
		owns('lineSpacingExactPt')
	) {
		paragraphProps['a:lnSpc'] = {
			'a:spcPts': {
				'@_val': String(Math.round(spacing.lineSpacingExactPt * 100)),
			},
		};
	}
	if (spacing.spacingBefore && owns('paragraphSpacingBefore')) {
		paragraphProps['a:spcBef'] = spacing.spacingBefore;
	}
	if (spacing.spacingAfter && owns('paragraphSpacingAfter')) {
		paragraphProps['a:spcAft'] = spacing.spacingAfter;
	}

	// Bullet properties
	if (bulletInfo) {
		applyBulletProperties(paragraphProps, bulletInfo);
	}

	// Tab stops
	if (textStyle?.tabStops && textStyle.tabStops.length > 0 && owns('tabStops')) {
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

	// `a:defRPr` is the paragraph default run properties. It follows the bullet group
	// and `a:tabLst`, and precedes `a:extLst`.
	if (textStyle?.paragraphDefaultRunPropertiesXml && owns('paragraphDefaultRunPropertiesXml')) {
		paragraphProps['a:defRPr'] = textStyle.paragraphDefaultRunPropertiesXml;
	}

	// `a:extLst` is the very last child of CT_TextParagraphProperties. Re-emit
	// the captured opaque subtree verbatim when present so authored extensions
	// survive a round-trip.
	if (textStyle?.paragraphPropertiesExtLstXml && owns('paragraphPropertiesExtLstXml')) {
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
	} else if (bulletInfo.colorRef) {
		// A typed theme ref wins: keeps the bullet following the theme palette
		// after a later theme change instead of freezing today's sRGB/schemeClr.
		paragraphProps['a:buClr'] = themeColorRefToSolidFillWithOpacity(bulletInfo.colorRef);
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
	if (bulletInfo.imageBlipFillXml) {
		// Re-emit the captured `a:buBlip` subtree verbatim (a:blip + a:extLst,
		// a:tile, a:stretch, a:srcRect) so picture-bullet modifiers such as a
		// crop or tile setting survive a round-trip, rather than reconstructing
		// a bare `a:blip[@r:embed]` that drops every modifier.
		paragraphProps['a:buBlip'] = bulletInfo.imageBlipFillXml;
	} else if (bulletInfo.imageRelId) {
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
	// object in that exact sequence.
	const paragraph: XmlObject = {
		'a:pPr': paragraphProps,
	};

	// `runs` already arrives in segment order, so the authored sequence of
	// runs / fields / breaks / inline math is simply its order.
	const children = runs
		.map((run) => classifyParagraphChild(run))
		.filter((child): child is ParagraphChild => child !== undefined);

	if (children.length > 0) {
		writeParagraphChildren(paragraph, children);
	} else {
		// Every run was an equation marker with no captured XML (or there were
		// no runs at all): fall back to emitting whatever was handed in.
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
