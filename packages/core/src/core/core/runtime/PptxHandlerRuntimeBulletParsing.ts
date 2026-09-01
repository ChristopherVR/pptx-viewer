import { BulletInfo, XmlObject } from '../../types';
import type { PlaceholderTextLevelStyle } from '../../types';
import { formatAutoNumberMarker } from '../../utils/auto-number-format';
import { extractColorChoiceXml } from '../../utils/color-xml-preservation';
import { parseBulletSizePercent } from '../../utils/paragraph-properties-parser';
import { xmlChild, xmlHasChild, xmlPath } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeTextDefaults';

type LevelStyleMap = Record<number, PlaceholderTextLevelStyle>;

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected resolveParagraphBulletInfo(
		paragraph: XmlObject | undefined,
		paragraphIndex: number,
		txBody: XmlObject | undefined,
		inheritedTxBody: XmlObject | undefined,
		isBodyPlaceholder: boolean = false,
		slidePath?: string,
		effectiveLevelStyles?: LevelStyleMap,
	): BulletInfo | null {
		if (!paragraph) {
			return null;
		}
		const paragraphProps = paragraph['a:pPr'] as XmlObject | undefined;
		if (xmlHasChild(paragraphProps, 'a:buNone')) {
			return { none: true };
		}

		const level = Number.parseInt(String(paragraphProps?.['@_lvl'] || '0'), 10);
		const normalizedLevel = Number.isFinite(level) ? Math.min(Math.max(level + 1, 1), 9) : 1;
		const levelKey = `a:lvl${normalizedLevel}pPr`;

		const inheritedLevelProps = xmlChild(xmlChild(inheritedTxBody, 'a:lstStyle'), levelKey);
		const bodyLevelProps = xmlChild(xmlChild(txBody, 'a:lstStyle'), levelKey);
		const defaultBodyProps = xmlPath(txBody, 'a:lstStyle', 'a:defPPr');
		const inheritedDefaultBodyProps = xmlPath(inheritedTxBody, 'a:lstStyle', 'a:defPPr');

		const bulletPropsCandidates = [
			paragraphProps,
			bodyLevelProps,
			inheritedLevelProps,
			defaultBodyProps,
			inheritedDefaultBodyProps,
		];

		let resolvedBulletProps: XmlObject | undefined;
		for (const candidate of bulletPropsCandidates) {
			if (!candidate) {
				continue;
			}
			if (xmlHasChild(candidate, 'a:buNone')) {
				return { none: true };
			}
			// Accept inherit-from-text bullet markers as a valid resolution
			// even when no `buChar` / `buAutoNum` / `buBlip` is present.
			if (
				candidate['a:buChar'] ||
				candidate['a:buAutoNum'] ||
				candidate['a:buBlip'] ||
				candidate['a:buFontTx'] !== undefined ||
				candidate['a:buClrTx'] !== undefined ||
				candidate['a:buSzTx'] !== undefined
			) {
				resolvedBulletProps = candidate;
				break;
			}
		}
		if (!resolvedBulletProps) {
			// No explicit bullet on the slide paragraph or the placeholder's own
			// list styles. Fall back to the resolved placeholder cascade
			// (`effectiveLevelStyles` already merges the layout/master placeholder
			// list styles with the master `<p:txStyles>/<p:bodyStyle>`, which is
			// where the default body bullet char lives), then finally the
			// presentation-level default text style. Without this, an inherited
			// body bullet (e.g. `buChar="•"` declared only in the master bodyStyle)
			// is silently dropped even though its indent still resolves.
			const fallbackLevelStyle =
				effectiveLevelStyles?.[normalizedLevel - 1] ??
				effectiveLevelStyles?.[-1] ??
				(isBodyPlaceholder
					? (this.presentationDefaultTextStyle?.levelStyles?.[normalizedLevel - 1] ??
						this.presentationDefaultTextStyle?.levelStyles?.[-1])
					: undefined);
			return this.createBulletInfoFromLevelStyle(fallbackLevelStyle, paragraphIndex);
		}

		// Extract shared bullet styling properties.
		//
		// CT_TextParagraphProperties also defines three "inherit-from-text"
		// markers — `<a:buFontTx/>`, `<a:buClrTx/>`, `<a:buSzTx/>` — that
		// instruct PowerPoint to take the bullet's font / colour / size
		// from the run text rather than from a `buFont` / `buClr` /
		// `buSzPct|Pts` declaration. Capture those so save can re-emit the
		// same Tx form (otherwise the bullet visually shifts on round-trip).
		const buFont = resolvedBulletProps['a:buFont'] as XmlObject | undefined;
		const fontFamily = buFont?.['@_typeface'] ? String(buFont['@_typeface']) : undefined;
		const fontInherit = resolvedBulletProps['a:buFontTx'] !== undefined;

		const sizePercent = parseBulletSizePercent(
			resolvedBulletProps['a:buSzPct'] as XmlObject | undefined,
		);

		const buSzPts = resolvedBulletProps['a:buSzPts'] as XmlObject | undefined;
		let sizePts: number | undefined;
		if (buSzPts?.['@_val'] !== undefined) {
			const ptsRaw = Number.parseInt(String(buSzPts['@_val']), 10);
			if (Number.isFinite(ptsRaw)) {
				sizePts = ptsRaw / 100;
			}
		}
		const sizeInherit = resolvedBulletProps['a:buSzTx'] !== undefined;

		const buClr = resolvedBulletProps['a:buClr'] as XmlObject | undefined;
		let color: string | undefined;
		let colorXml: XmlObject | undefined;
		if (buClr) {
			// Preserve scheme/sys/prst/srgb identity (themed bullet colours)
			// instead of extracting only `a:srgbClr/@_val`.
			color = this.parseColor(buClr);
			colorXml = extractColorChoiceXml(buClr);
		}
		const colorInherit = resolvedBulletProps['a:buClrTx'] !== undefined;

		// Character bullet
		const bulletChar = String(
			(resolvedBulletProps['a:buChar'] as XmlObject | undefined)?.['@_char'] || '',
		);
		if (bulletChar.length > 0) {
			return {
				char: bulletChar,
				fontFamily,
				sizePercent,
				sizePts,
				color,
				...(colorXml ? { colorXml } : {}),
				...(fontInherit ? { fontInherit: true } : {}),
				...(colorInherit ? { colorInherit: true } : {}),
				...(sizeInherit ? { sizeInherit: true } : {}),
			};
		}

		// Auto-numbered bullet
		const autoNum = resolvedBulletProps['a:buAutoNum'] as XmlObject | undefined;
		if (autoNum) {
			const autoNumType = autoNum['@_type'] ? String(autoNum['@_type']) : undefined;
			const startAtRaw = Number.parseInt(String(autoNum['@_startAt'] || '1'), 10);
			const autoNumStartAt = Number.isFinite(startAtRaw) ? startAtRaw : 1;
			return {
				autoNumType,
				autoNumStartAt,
				paragraphIndex,
				fontFamily,
				sizePercent,
				sizePts,
				color,
				...(colorXml ? { colorXml } : {}),
				...(fontInherit ? { fontInherit: true } : {}),
				...(colorInherit ? { colorInherit: true } : {}),
				...(sizeInherit ? { sizeInherit: true } : {}),
			};
		}

		// Picture bullet
		const buBlip = resolvedBulletProps['a:buBlip'] as XmlObject | undefined;
		if (buBlip) {
			const blip = buBlip['a:blip'] as XmlObject | undefined;
			const imageRelId = blip?.['@_r:embed'] ? String(blip['@_r:embed']) : undefined;
			// Preserve the full a:buBlip subtree (a:blip + extLst, a:tile, a:stretch,
			// a:srcRect) verbatim so the writer can round-trip blipFill modifiers.
			const imageBlipFillXml: XmlObject = { ...buBlip };
			if (imageRelId && slidePath) {
				// Resolve image data URL from relationship ID
				const slideRels = this.slideRelsMap.get(slidePath);
				const target = slideRels?.get(imageRelId);
				let imageDataUrl: string | undefined;
				if (target) {
					if (
						target.startsWith('http://') ||
						target.startsWith('https://') ||
						target.startsWith('data:')
					) {
						imageDataUrl = target;
					} else {
						const imagePath = this.resolveImagePath(slidePath, target);
						if (imagePath) {
							// Synchronously get from cache if available
							const cached = (
								this as unknown as { imageDataCache?: Map<string, string> }
							).imageDataCache?.get(imagePath);
							imageDataUrl = cached;
						}
					}
				}
				return {
					imageRelId,
					imageDataUrl,
					imageBlipFillXml,
					fontFamily,
					sizePercent,
					sizePts,
					color,
					...(colorXml ? { colorXml } : {}),
				};
			}
			// buBlip without a resolvable rel/path — still preserve the subtree.
			return {
				imageBlipFillXml,
				fontFamily,
				sizePercent,
				sizePts,
				color,
				...(colorXml ? { colorXml } : {}),
			};
		}

		// No explicit bullet element found in the resolved props
		return null;
	}

	protected createBulletInfoFromLevelStyle(
		levelStyle: PlaceholderTextLevelStyle | undefined,
		paragraphIndex: number,
	): BulletInfo | null {
		if (!levelStyle) {
			return null;
		}
		if (levelStyle.bulletNone) {
			return { none: true };
		}

		if (levelStyle.bulletChar && levelStyle.bulletChar.length > 0) {
			return {
				char: levelStyle.bulletChar,
				fontFamily: levelStyle.bulletFontFamily,
				sizePercent: levelStyle.bulletSizePercent,
				sizePts: levelStyle.bulletSizePts,
				color: levelStyle.bulletColor,
				colorXml: levelStyle.bulletColorXml,
			};
		}

		if (levelStyle.bulletAutoNumType && levelStyle.bulletAutoNumType.length > 0) {
			return {
				autoNumType: levelStyle.bulletAutoNumType,
				autoNumStartAt: 1,
				paragraphIndex,
				fontFamily: levelStyle.bulletFontFamily,
				sizePercent: levelStyle.bulletSizePercent,
				sizePts: levelStyle.bulletSizePts,
				color: levelStyle.bulletColor,
				colorXml: levelStyle.bulletColorXml,
			};
		}

		return null;
	}

	/**
	 * Format an auto-numbered bullet sequence number according to the OOXML
	 * numbering type (e.g. "arabicPeriod", "romanUcPeriod", "ea1ChsPeriod").
	 *
	 * Delegates to {@link formatAutoNumberMarker}, the single implementation
	 * that `pptx-viewer-shared` also renders from. It previously carried its own
	 * table covering only the Latin/circled half of `ST_TextAutonumberScheme`
	 * and falling back to `"<n>. "` for every East-Asian / Thai / Hindi /
	 * Hebrew scheme, which disagreed with the renderer's marker and painted a
	 * DOUBLE marker (`一.1. Item`).
	 *
	 * The trailing space is this method's own contract: the marker is stamped
	 * into a text segment, so it needs the gap before the run text. The
	 * renderer's copy has no trailing space and the de-duplication compares
	 * trimmed strings.
	 */
	protected formatAutoNumber(autoNumType: string, seqNum: number): string {
		return `${formatAutoNumberMarker(autoNumType, seqNum)} `;
	}
}
