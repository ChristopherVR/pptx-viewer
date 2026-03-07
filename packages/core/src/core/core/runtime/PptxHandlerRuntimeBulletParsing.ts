import {
  BulletInfo,
  XmlObject,
  type PlaceholderTextLevelStyle,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeTextDefaults";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected resolveParagraphBulletInfo(
    paragraph: XmlObject | undefined,
    paragraphIndex: number,
    txBody: XmlObject | undefined,
    inheritedTxBody: XmlObject | undefined,
    isBodyPlaceholder: boolean = false,
    slidePath?: string,
  ): BulletInfo | null {
    if (!paragraph) return null;
    const paragraphProps = paragraph["a:pPr"] as XmlObject | undefined;
    if (paragraphProps?.["a:buNone"]) return { none: true };

    const level = Number.parseInt(String(paragraphProps?.["@_lvl"] || "0"), 10);
    const normalizedLevel = Number.isFinite(level)
      ? Math.min(Math.max(level + 1, 1), 9)
      : 1;
    const levelKey = `a:lvl${normalizedLevel}pPr`;

    const inheritedLevelProps = inheritedTxBody?.["a:lstStyle"]?.[levelKey] as
      | XmlObject
      | undefined;
    const bodyLevelProps = txBody?.["a:lstStyle"]?.[levelKey] as
      | XmlObject
      | undefined;
    const defaultBodyProps = txBody?.["a:lstStyle"]?.["a:defPPr"] as
      | XmlObject
      | undefined;
    const inheritedDefaultBodyProps = inheritedTxBody?.["a:lstStyle"]?.[
      "a:defPPr"
    ] as XmlObject | undefined;

    const bulletPropsCandidates = [
      paragraphProps,
      bodyLevelProps,
      inheritedLevelProps,
      defaultBodyProps,
      inheritedDefaultBodyProps,
    ];

    let resolvedBulletProps: XmlObject | undefined;
    for (const candidate of bulletPropsCandidates) {
      if (!candidate) continue;
      if (candidate["a:buNone"]) return { none: true };
      if (
        candidate["a:buChar"] ||
        candidate["a:buAutoNum"] ||
        candidate["a:buBlip"]
      ) {
        resolvedBulletProps = candidate;
        break;
      }
    }
    if (!resolvedBulletProps) {
      if (isBodyPlaceholder) {
        const presentationLevelStyle =
          this.presentationDefaultTextStyle?.levelStyles?.[
            normalizedLevel - 1
          ] ?? this.presentationDefaultTextStyle?.levelStyles?.[-1];
        return this.createBulletInfoFromLevelStyle(
          presentationLevelStyle,
          paragraphIndex,
        );
      }
      return null;
    }

    // Extract shared bullet styling properties
    const buFont = resolvedBulletProps["a:buFont"] as XmlObject | undefined;
    const fontFamily = buFont?.["@_typeface"]
      ? String(buFont["@_typeface"])
      : undefined;

    const buSzPct = resolvedBulletProps["a:buSzPct"] as XmlObject | undefined;
    let sizePercent: number | undefined;
    if (buSzPct?.["@_val"] !== undefined) {
      const pctRaw = Number.parseInt(String(buSzPct["@_val"]), 10);
      if (Number.isFinite(pctRaw)) {
        sizePercent = pctRaw / 1000;
      }
    }

    const buSzPts = resolvedBulletProps["a:buSzPts"] as XmlObject | undefined;
    let sizePts: number | undefined;
    if (buSzPts?.["@_val"] !== undefined) {
      const ptsRaw = Number.parseInt(String(buSzPts["@_val"]), 10);
      if (Number.isFinite(ptsRaw)) {
        sizePts = ptsRaw / 100;
      }
    }

    const buClr = resolvedBulletProps["a:buClr"] as XmlObject | undefined;
    let color: string | undefined;
    if (buClr) {
      const srgb = buClr["a:srgbClr"] as XmlObject | undefined;
      if (srgb?.["@_val"]) {
        color = String(srgb["@_val"]);
      }
    }

    // Character bullet
    const bulletChar = String(
      (resolvedBulletProps["a:buChar"] as XmlObject | undefined)?.["@_char"] ||
        "",
    );
    if (bulletChar.length > 0) {
      return {
        char: bulletChar,
        fontFamily,
        sizePercent,
        sizePts,
        color,
      };
    }

    // Auto-numbered bullet
    const autoNum = resolvedBulletProps["a:buAutoNum"] as XmlObject | undefined;
    if (autoNum) {
      const autoNumType = autoNum["@_type"]
        ? String(autoNum["@_type"])
        : undefined;
      const startAtRaw = Number.parseInt(
        String(autoNum["@_startAt"] || "1"),
        10,
      );
      const autoNumStartAt = Number.isFinite(startAtRaw) ? startAtRaw : 1;
      return {
        autoNumType,
        autoNumStartAt,
        paragraphIndex,
        fontFamily,
        sizePercent,
        sizePts,
        color,
      };
    }

    // Picture bullet
    const buBlip = resolvedBulletProps["a:buBlip"] as XmlObject | undefined;
    if (buBlip) {
      const blip = buBlip["a:blip"] as XmlObject | undefined;
      const imageRelId = blip?.["@_r:embed"]
        ? String(blip["@_r:embed"])
        : undefined;
      if (imageRelId && slidePath) {
        // Resolve image data URL from relationship ID
        const slideRels = this.slideRelsMap.get(slidePath);
        const target = slideRels?.get(imageRelId);
        let imageDataUrl: string | undefined;
        if (target) {
          if (
            target.startsWith("http://") ||
            target.startsWith("https://") ||
            target.startsWith("data:")
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
          fontFamily,
          sizePercent,
          sizePts,
          color,
        };
      }
    }

    // No explicit bullet element found in the resolved props
    return null;
  }

  protected createBulletInfoFromLevelStyle(
    levelStyle: PlaceholderTextLevelStyle | undefined,
    paragraphIndex: number,
  ): BulletInfo | null {
    if (!levelStyle) return null;
    if (levelStyle.bulletNone) return { none: true };

    if (levelStyle.bulletChar && levelStyle.bulletChar.length > 0) {
      return {
        char: levelStyle.bulletChar,
        fontFamily: levelStyle.bulletFontFamily,
        sizePercent: levelStyle.bulletSizePercent,
        sizePts: levelStyle.bulletSizePts,
        color: levelStyle.bulletColor,
      };
    }

    if (
      levelStyle.bulletAutoNumType &&
      levelStyle.bulletAutoNumType.length > 0
    ) {
      return {
        autoNumType: levelStyle.bulletAutoNumType,
        autoNumStartAt: 1,
        paragraphIndex,
        fontFamily: levelStyle.bulletFontFamily,
        sizePercent: levelStyle.bulletSizePercent,
        sizePts: levelStyle.bulletSizePts,
        color: levelStyle.bulletColor,
      };
    }

    return null;
  }

  /**
   * Format an auto-numbered bullet sequence number according to the OOXML
   * numbering type (e.g. "arabicPeriod", "romanUcPeriod").
   */
  protected formatAutoNumber(autoNumType: string, seqNum: number): string {
    const toAlpha = (n: number, upper: boolean): string => {
      const code = (n - 1) % 26;
      const ch = String.fromCharCode((upper ? 65 : 97) + code);
      return ch;
    };

    const toRoman = (n: number, upper: boolean): string => {
      const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
      const numerals = [
        "M",
        "CM",
        "D",
        "CD",
        "C",
        "XC",
        "L",
        "XL",
        "X",
        "IX",
        "V",
        "IV",
        "I",
      ];
      let result = "";
      let remaining = Math.max(1, Math.min(n, 3999));
      for (let i = 0; i < values.length; i++) {
        while (remaining >= values[i]) {
          result += numerals[i];
          remaining -= values[i];
        }
      }
      return upper ? result : result.toLowerCase();
    };

    switch (autoNumType) {
      case "arabicPeriod":
        return `${seqNum}. `;
      case "arabicParenR":
        return `${seqNum}) `;
      case "arabicParenBoth":
        return `(${seqNum}) `;
      case "alphaLcPeriod":
        return `${toAlpha(seqNum, false)}. `;
      case "alphaUcPeriod":
        return `${toAlpha(seqNum, true)}. `;
      case "alphaLcParenR":
        return `${toAlpha(seqNum, false)}) `;
      case "alphaUcParenR":
        return `${toAlpha(seqNum, true)}) `;
      case "romanLcPeriod":
        return `${toRoman(seqNum, false)}. `;
      case "romanUcPeriod":
        return `${toRoman(seqNum, true)}. `;
      default:
        return `${seqNum}. `;
    }
  }
}
