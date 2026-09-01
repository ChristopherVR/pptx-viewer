import { XmlObject, PlaceholderTextLevelStyle } from '../../types';
import { extractColorChoiceXml } from '../../utils/color-xml-preservation';
import {
	parseAlignmentAttr,
	parseBulletSizePercent,
	parseParagraphExtraAttributes,
	parseParagraphMargins,
	parseParagraphRtl,
	parseTabStops,
} from '../../utils/paragraph-properties-parser';
import { xmlHasChild } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSlideUtils';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse a single `a:lvlXpPr` node into a structured
	 * {@link PlaceholderTextLevelStyle}.
	 *
	 * The paragraph-level attributes go through the same helpers the
	 * per-paragraph `a:pPr` path uses (`paragraph-properties-parser`), so a
	 * master `p:txStyles` or layout `a:lstStyle` level carries exactly the
	 * field set a directly-authored paragraph does: margins on both sides,
	 * `rtl`, tab stops, and the full `ST_TextAlignType` token set.
	 */
	protected parsePlaceholderLevelStyle(
		levelProps: XmlObject | undefined,
	): PlaceholderTextLevelStyle | null {
		if (!levelProps) {
			return null;
		}

		const style: PlaceholderTextLevelStyle = {};

		// Paragraph-level properties. `parseAlignmentAttr` keeps `justLow` /
		// `dist` / `thaiDist` as the case-sensitive tokens the renderer branches
		// on; an unknown token is dropped rather than passed through raw.
		const alignRaw = String(levelProps['@_algn'] ?? '').trim();
		const alignment = parseAlignmentAttr(alignRaw.length > 0 ? alignRaw : undefined);
		if (alignment !== undefined) {
			style.alignment = alignment;
		}

		const margins = parseParagraphMargins(levelProps);
		if (margins.paragraphMarginLeft !== undefined) {
			style.marginLeft = margins.paragraphMarginLeft;
		}
		if (margins.paragraphMarginRight !== undefined) {
			style.marginRight = margins.paragraphMarginRight;
		}
		if (margins.paragraphIndent !== undefined) {
			style.indent = margins.paragraphIndent;
		}

		const rtl = parseParagraphRtl(levelProps);
		if (rtl !== undefined) {
			style.rtl = rtl;
		}

		const tabStops = parseTabStops(levelProps);
		if (tabStops && tabStops.length > 0) {
			style.tabStops = tabStops;
		}

		Object.assign(style, parseParagraphExtraAttributes(levelProps));

		// Line spacing
		const lnSpc = levelProps['a:lnSpc'] as XmlObject | undefined;
		if (lnSpc) {
			const multiplier = this.parseLineSpacingMultiplier(lnSpc);
			if (multiplier !== undefined) {
				style.lineSpacing = multiplier;
			} else {
				const exactPt = this.parseLineSpacingExactPt(lnSpc);
				if (exactPt !== undefined) {
					style.lineSpacingExactPt = exactPt;
				}
			}
		}

		// Spacing before / after. Percentage spacing (`a:spcPct`) resolves against
		// the level's own default run size (`a:defRPr/@sz`, in hundredths of a
		// point), which is the closest size basis available at parse time.
		const defRPr = levelProps['a:defRPr'] as XmlObject | undefined;
		const defRPrSzRaw = Number.parseInt(String(defRPr?.['@_sz'] ?? ''), 10);
		const basisFontSizePx = Number.isFinite(defRPrSzRaw)
			? this.pointsToPixels(defRPrSzRaw / 100)
			: undefined;
		const spcBef = this.parseParagraphSpacingPx(
			levelProps['a:spcBef'] as XmlObject | undefined,
			basisFontSizePx,
		);
		if (spcBef !== undefined) {
			style.spaceBefore = spcBef;
		}

		const spcAft = this.parseParagraphSpacingPx(
			levelProps['a:spcAft'] as XmlObject | undefined,
			basisFontSizePx,
		);
		if (spcAft !== undefined) {
			style.spaceAfter = spcAft;
		}

		this.parsePlaceholderLevelBullet(levelProps, style);

		if (defRPr) {
			this.parsePlaceholderLevelRunDefaults(defRPr, style);
		}

		// Return null if nothing useful was captured
		const hasValues = Object.keys(style).length > 0;
		return hasValues ? style : null;
	}

	/** Bullet group of an `a:lvlXpPr` node (`a:bu*` children). */
	private parsePlaceholderLevelBullet(
		levelProps: XmlObject,
		style: PlaceholderTextLevelStyle,
	): void {
		const buChar = levelProps['a:buChar'] as XmlObject | undefined;
		if (buChar?.['@_char']) {
			style.bulletChar = String(buChar['@_char']);
		}

		const buAutoNum = levelProps['a:buAutoNum'] as XmlObject | undefined;
		if (buAutoNum?.['@_type']) {
			style.bulletAutoNumType = String(buAutoNum['@_type']);
		}

		const buFont = levelProps['a:buFont'] as XmlObject | undefined;
		if (buFont?.['@_typeface']) {
			style.bulletFontFamily = String(buFont['@_typeface']);
		}

		const bulletSizePercent = parseBulletSizePercent(
			levelProps['a:buSzPct'] as XmlObject | undefined,
		);
		if (bulletSizePercent !== undefined) {
			style.bulletSizePercent = bulletSizePercent;
		}

		// Bullet colour. Route through `parseColor` so themed choices
		// (`a:schemeClr`/`a:sysClr`/`a:prstClr`/`a:hslClr`/`a:scrgbClr`), which are
		// standard in the Office master bodyStyle, resolve correctly rather than
		// being dropped by reading only `a:srgbClr/@_val`. The authored choice is
		// kept alongside so save can re-emit the theme reference, not the hex.
		const buClr = levelProps['a:buClr'] as XmlObject | undefined;
		if (buClr) {
			const bulletColor = this.parseColor(buClr);
			if (bulletColor) {
				style.bulletColor = bulletColor;
			}
			const bulletColorXml = extractColorChoiceXml(buClr);
			if (bulletColorXml) {
				style.bulletColorXml = bulletColorXml;
			}
		}

		// Bullet size in points
		const buSzPts = levelProps['a:buSzPts'] as XmlObject | undefined;
		if (buSzPts?.['@_val'] !== undefined) {
			const ptsRaw = Number.parseInt(String(buSzPts['@_val']), 10);
			if (Number.isFinite(ptsRaw)) {
				style.bulletSizePts = ptsRaw / 100;
			}
		}

		// Bullet suppression
		if (xmlHasChild(levelProps, 'a:buNone')) {
			style.bulletNone = true;
		}
	}

	/** Default run properties of a level (`a:defRPr`: font, size, bold, italic, colour). */
	private parsePlaceholderLevelRunDefaults(
		defRPr: XmlObject,
		style: PlaceholderTextLevelStyle,
	): void {
		if (defRPr['@_sz'] !== undefined) {
			const hundredths = Number.parseInt(String(defRPr['@_sz']), 10);
			if (Number.isFinite(hundredths)) {
				style.fontSize = (hundredths / 100) * (96 / 72);
			}
		}
		if (defRPr['@_b'] !== undefined) {
			style.bold = defRPr['@_b'] === '1';
		}
		if (defRPr['@_i'] !== undefined) {
			style.italic = defRPr['@_i'] === '1';
		}

		const solidFill = defRPr['a:solidFill'] as XmlObject | undefined;
		const color = this.parseColor(solidFill);
		if (color) {
			style.color = color;
		}
		if (solidFill) {
			// Keep the authored choice: this level may be inherited by a slide
			// whose `p:clrMapOvr` routes the alias elsewhere, and only the
			// original node can be resolved against that slide's map.
			style.colorChoiceXml = solidFill;
		}

		const latin = defRPr['a:latin'] as XmlObject | undefined;
		if (latin?.['@_typeface']) {
			const typeface = String(latin['@_typeface']);
			const resolved = this.resolveThemeTypeface(typeface);
			style.fontFamily = resolved ?? typeface;
		}
	}
}
