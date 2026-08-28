import { parseOoxmlPercent } from '../../color';
import { XmlObject, TextStyle, PlaceholderDefaults, PlaceholderTextLevelStyle } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeShapeImageFill';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Apply {@link PlaceholderDefaults} body-level properties to a
	 * {@link TextStyle} as fallback values (only sets fields that are
	 * still `undefined`).
	 */
	protected applyPlaceholderBodyDefaults(
		textStyle: TextStyle,
		defaults: PlaceholderDefaults,
	): void {
		if (textStyle.bodyInsetLeft === undefined && defaults.bodyInsetLeft !== undefined) {
			textStyle.bodyInsetLeft = defaults.bodyInsetLeft;
		}
		if (textStyle.bodyInsetTop === undefined && defaults.bodyInsetTop !== undefined) {
			textStyle.bodyInsetTop = defaults.bodyInsetTop;
		}
		if (textStyle.bodyInsetRight === undefined && defaults.bodyInsetRight !== undefined) {
			textStyle.bodyInsetRight = defaults.bodyInsetRight;
		}
		if (textStyle.bodyInsetBottom === undefined && defaults.bodyInsetBottom !== undefined) {
			textStyle.bodyInsetBottom = defaults.bodyInsetBottom;
		}
		if (textStyle.vAlign === undefined && defaults.textAnchor) {
			const vAlign = this.textVerticalAlignFromDrawingValue(defaults.textAnchor);
			if (vAlign) {
				textStyle.vAlign = vAlign;
			}
		}
		if (textStyle.autoFit === undefined && defaults.autoFit !== undefined) {
			textStyle.autoFit = defaults.autoFit;
		}
		if (textStyle.textWrap === undefined && defaults.textWrap) {
			textStyle.textWrap = defaults.textWrap as TextStyle['textWrap'];
		}
	}

	protected pointsToPixels(points: number): number {
		return points * (96 / 72);
	}

	protected parseParagraphSpacingPx(
		spacingNode: XmlObject | undefined,
		basisFontSizePx?: number,
	): number | undefined {
		if (!spacingNode) {
			return undefined;
		}
		const spacingPointsRaw = Number.parseInt(
			String((spacingNode['a:spcPts'] as XmlObject | undefined)?.['@_val'] || ''),
			10,
		);
		if (Number.isFinite(spacingPointsRaw)) {
			return this.pointsToPixels(spacingPointsRaw / 100);
		}
		// Percentage spacing (`a:spcPct`) is relative to the line's font size. It
		// needs a size basis to resolve to pixels; without one we can't produce a
		// meaningful value, so fall through to undefined.
		const spacingFraction = parseOoxmlPercent(
			(spacingNode['a:spcPct'] as XmlObject | undefined)?.['@_val'],
		);
		if (
			spacingFraction !== undefined &&
			typeof basisFontSizePx === 'number' &&
			basisFontSizePx > 0
		) {
			return spacingFraction * basisFontSizePx;
		}
		return undefined;
	}

	protected parseLineSpacingMultiplier(lineSpacingNode: XmlObject | undefined): number | undefined {
		if (!lineSpacingNode) {
			return undefined;
		}
		const spacingFraction = parseOoxmlPercent(
			(lineSpacingNode['a:spcPct'] as XmlObject | undefined)?.['@_val'],
		);
		if (spacingFraction !== undefined) {
			return Math.max(0.1, Math.min(5, spacingFraction));
		}
		return undefined;
	}

	/**
	 * Parse exact line spacing in points from `a:lnSpc > a:spcPts`.
	 * Returns the value in points (hundredths-of-pt divided by 100).
	 */
	protected parseLineSpacingExactPt(lineSpacingNode: XmlObject | undefined): number | undefined {
		if (!lineSpacingNode) {
			return undefined;
		}
		const spcPtsRaw = Number.parseInt(
			String((lineSpacingNode['a:spcPts'] as XmlObject | undefined)?.['@_val'] || ''),
			10,
		);
		if (Number.isFinite(spcPtsRaw) && spcPtsRaw > 0) {
			return spcPtsRaw / 100;
		}
		return undefined;
	}

	/**
	 * Resolve an inherited level colour against the colour map that is active
	 * now, rather than the one that was active when the level was cached.
	 *
	 * Layout and master text styles are cached once per part; slides are parsed
	 * afterwards, each with its own `p:clrMapOvr`. Re-reading the authored
	 * choice is what makes `tx1` come out white on a slide that maps it to the
	 * light slot and black on one that does not.
	 *
	 * @param levelStyle - The inherited level style.
	 * @returns The colour to inherit, or `undefined` when the level sets none.
	 */
	protected resolveLevelStyleColor(levelStyle: PlaceholderTextLevelStyle): string | undefined {
		if (levelStyle.colorChoiceXml) {
			const remapped = this.parseColor(levelStyle.colorChoiceXml);
			if (remapped) {
				return remapped;
			}
		}
		return levelStyle.color;
	}

	/**
	 * Apply level-specific {@link PlaceholderTextLevelStyle} properties to a
	 * {@link TextStyle} as fallback values for paragraph-level fields.
	 */
	protected applyPlaceholderLevelDefaults(
		textStyle: TextStyle,
		levelStyle: PlaceholderTextLevelStyle,
	): void {
		if (textStyle.fontFamily === undefined && levelStyle.fontFamily !== undefined) {
			textStyle.fontFamily = levelStyle.fontFamily;
		}
		if (textStyle.fontSize === undefined && levelStyle.fontSize !== undefined) {
			textStyle.fontSize = levelStyle.fontSize;
		}
		if (textStyle.bold === undefined && levelStyle.bold !== undefined) {
			textStyle.bold = levelStyle.bold;
		}
		if (textStyle.italic === undefined && levelStyle.italic !== undefined) {
			textStyle.italic = levelStyle.italic;
		}
		if (textStyle.color === undefined) {
			const inheritedColor = this.resolveLevelStyleColor(levelStyle);
			if (inheritedColor !== undefined) {
				textStyle.color = inheritedColor;
			}
		}
		if (textStyle.paragraphMarginLeft === undefined && levelStyle.marginLeft !== undefined) {
			textStyle.paragraphMarginLeft = levelStyle.marginLeft;
		}
		if (textStyle.paragraphIndent === undefined && levelStyle.indent !== undefined) {
			textStyle.paragraphIndent = levelStyle.indent;
		}
		if (textStyle.lineSpacing === undefined && textStyle.lineSpacingExactPt === undefined) {
			if (levelStyle.lineSpacing !== undefined) {
				textStyle.lineSpacing = levelStyle.lineSpacing;
			} else if (levelStyle.lineSpacingExactPt !== undefined) {
				textStyle.lineSpacingExactPt = levelStyle.lineSpacingExactPt;
			}
		}
		if (textStyle.paragraphSpacingBefore === undefined && levelStyle.spaceBefore !== undefined) {
			textStyle.paragraphSpacingBefore = levelStyle.spaceBefore;
		}
		if (textStyle.paragraphSpacingAfter === undefined && levelStyle.spaceAfter !== undefined) {
			textStyle.paragraphSpacingAfter = levelStyle.spaceAfter;
		}
		if (textStyle.align === undefined && levelStyle.alignment !== undefined) {
			textStyle.align = levelStyle.alignment as TextStyle['align'];
		}
		if (textStyle.defaultTabSize === undefined && levelStyle.defaultTabSize !== undefined) {
			textStyle.defaultTabSize = levelStyle.defaultTabSize;
		}
		if (textStyle.eaLineBreak === undefined && levelStyle.eaLineBreak !== undefined) {
			textStyle.eaLineBreak = levelStyle.eaLineBreak;
		}
		if (textStyle.latinLineBreak === undefined && levelStyle.latinLineBreak !== undefined) {
			textStyle.latinLineBreak = levelStyle.latinLineBreak;
		}
		if (textStyle.fontAlignment === undefined && levelStyle.fontAlignment !== undefined) {
			textStyle.fontAlignment = levelStyle.fontAlignment;
		}
		if (textStyle.hangingPunctuation === undefined && levelStyle.hangingPunctuation !== undefined) {
			textStyle.hangingPunctuation = levelStyle.hangingPunctuation;
		}
	}
}
