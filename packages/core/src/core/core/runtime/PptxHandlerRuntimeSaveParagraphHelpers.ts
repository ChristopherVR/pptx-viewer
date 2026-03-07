import {
  XmlObject,
  TextStyle,
  TextSegment,
  type BulletInfo,
} from "../../types";

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
): XmlObject {
  const paragraphProps: XmlObject = {};

  if (paragraphAlign) {
    paragraphProps["@_algn"] = paragraphAlign;
  }
  if (textStyle?.rtl !== undefined) {
    paragraphProps["@_rtl"] = textStyle.rtl ? "1" : "0";
  }

  // Spacing before / after
  if (spacing.spacingBefore) {
    paragraphProps["a:spcBef"] = spacing.spacingBefore;
  }
  if (spacing.spacingAfter) {
    paragraphProps["a:spcAft"] = spacing.spacingAfter;
  }

  // Line spacing
  if (spacing.lineSpacing) {
    paragraphProps["a:lnSpc"] = spacing.lineSpacing;
  } else if (
    typeof spacing.lineSpacingExactPt === "number" &&
    Number.isFinite(spacing.lineSpacingExactPt)
  ) {
    paragraphProps["a:lnSpc"] = {
      "a:spcPts": {
        "@_val": String(Math.round(spacing.lineSpacingExactPt * 100)),
      },
    };
  }

  // Paragraph indentation (marL, marR, indent — stored in px, written as EMU)
  if (
    typeof textStyle?.paragraphMarginLeft === "number" &&
    Number.isFinite(textStyle.paragraphMarginLeft)
  ) {
    paragraphProps["@_marL"] = String(
      Math.round(textStyle.paragraphMarginLeft * EMU_PER_PX),
    );
  }
  if (
    typeof textStyle?.paragraphMarginRight === "number" &&
    Number.isFinite(textStyle.paragraphMarginRight)
  ) {
    paragraphProps["@_marR"] = String(
      Math.round(textStyle.paragraphMarginRight * EMU_PER_PX),
    );
  }
  if (
    typeof textStyle?.paragraphIndent === "number" &&
    Number.isFinite(textStyle.paragraphIndent)
  ) {
    paragraphProps["@_indent"] = String(
      Math.round(textStyle.paragraphIndent * EMU_PER_PX),
    );
  }

  // Tab stops
  if (textStyle?.tabStops && textStyle.tabStops.length > 0) {
    paragraphProps["a:tabLst"] = {
      "a:tab": textStyle.tabStops.map((tab) => {
        const tabObj: XmlObject = {
          "@_pos": String(Math.round(tab.position * EMU_PER_PX)),
        };
        if (tab.align && tab.align !== "l") {
          tabObj["@_algn"] = tab.align;
        }
        if (tab.leader && tab.leader !== "none") {
          tabObj["@_leader"] = tab.leader;
        }
        return tabObj;
      }),
    };
  }

  // Additional paragraph properties
  if (
    typeof textStyle?.defaultTabSize === "number" &&
    Number.isFinite(textStyle.defaultTabSize)
  ) {
    paragraphProps["@_defTabSz"] = String(
      Math.round(textStyle.defaultTabSize * EMU_PER_PX),
    );
  }
  if (textStyle?.eaLineBreak !== undefined) {
    paragraphProps["@_eaLnBrk"] = textStyle.eaLineBreak ? "1" : "0";
  }
  if (textStyle?.latinLineBreak !== undefined) {
    paragraphProps["@_latinLnBrk"] = textStyle.latinLineBreak ? "1" : "0";
  }
  if (textStyle?.fontAlignment) {
    paragraphProps["@_fontAlgn"] = textStyle.fontAlignment;
  }
  if (textStyle?.hangingPunctuation !== undefined) {
    paragraphProps["@_hangingPunct"] = textStyle.hangingPunctuation ? "1" : "0";
  }

  // Bullet properties
  if (bulletInfo) {
    applyBulletProperties(paragraphProps, bulletInfo);
  }

  return paragraphProps;
}

/** Apply bullet-related XML attributes from {@link BulletInfo} into `paragraphProps`. */
export function applyBulletProperties(
  paragraphProps: XmlObject,
  bulletInfo: BulletInfo,
): void {
  if (bulletInfo.none) {
    paragraphProps["a:buNone"] = {};
    return;
  }
  if (bulletInfo.fontFamily) {
    paragraphProps["a:buFont"] = {
      "@_typeface": bulletInfo.fontFamily,
    };
  }
  if (bulletInfo.sizePercent !== undefined) {
    paragraphProps["a:buSzPct"] = {
      "@_val": String(Math.round(bulletInfo.sizePercent * 1000)),
    };
  }
  if (bulletInfo.sizePts !== undefined) {
    paragraphProps["a:buSzPts"] = {
      "@_val": String(Math.round(bulletInfo.sizePts * 100)),
    };
  }
  if (bulletInfo.color) {
    const colorHex = bulletInfo.color.replace("#", "");
    paragraphProps["a:buClr"] = {
      "a:srgbClr": { "@_val": colorHex },
    };
  }
  if (bulletInfo.char) {
    paragraphProps["a:buChar"] = { "@_char": bulletInfo.char };
  }
  if (bulletInfo.autoNumType) {
    const buAutoNum: Record<string, unknown> = {
      "@_type": bulletInfo.autoNumType,
    };
    if (
      bulletInfo.autoNumStartAt !== undefined &&
      bulletInfo.autoNumStartAt !== 1
    ) {
      buAutoNum["@_startAt"] = String(bulletInfo.autoNumStartAt);
    }
    paragraphProps["a:buAutoNum"] = buAutoNum;
  }
  if (bulletInfo.imageRelId) {
    paragraphProps["a:buBlip"] = {
      "a:blip": { "@_r:embed": bulletInfo.imageRelId },
    };
  }
}

/** Assemble a paragraph XML object from runs and pre-built paragraph properties. */
export function assembleParagraphXml(
  runs: XmlObject[],
  paragraphProps: XmlObject,
): XmlObject {
  const paragraph: XmlObject = {
    "a:endParaRPr": { "@_lang": "en-US" },
  };
  paragraph["a:pPr"] = paragraphProps;

  // Separate regular runs from field runs
  const regularRuns = runs.filter((r) => !r.__isField);
  const fieldRuns = runs
    .filter((r) => r.__isField)
    .map((r) => {
      const { __isField, ...rest } = r;
      return rest;
    });

  // Clean regular runs of internal marker
  const cleanRegularRuns = regularRuns.map((r) => {
    const { __isField, ...rest } = r;
    return rest;
  });

  if (cleanRegularRuns.length > 0) {
    paragraph["a:r"] =
      cleanRegularRuns.length > 1 ? cleanRegularRuns : cleanRegularRuns[0];
  }
  if (fieldRuns.length > 0) {
    paragraph["a:fld"] = fieldRuns.length > 1 ? fieldRuns : fieldRuns[0];
  }
  if (cleanRegularRuns.length === 0 && fieldRuns.length === 0) {
    paragraph["a:r"] = runs.length > 1 ? runs : runs[0];
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
    "fontFamily",
    "fontSize",
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "rtl",
    "hyperlink",
    "color",
    "align",
  ];
  styleKeys.forEach((styleKey) => {
    const nextValue = textStyle?.[styleKey];
    if (nextValue === undefined) return;
    const firstValue = textSegments[0]?.style?.[styleKey];
    const isUniform = textSegments.every(
      (segment) => segment.style?.[styleKey] === firstValue,
    );
    if (isUniform) {
      if (styleKey === "fontFamily" && typeof nextValue === "string") {
        uniformSegmentOverrides.fontFamily = nextValue;
      } else if (styleKey === "fontSize" && typeof nextValue === "number") {
        uniformSegmentOverrides.fontSize = nextValue;
      } else if (styleKey === "bold" && typeof nextValue === "boolean") {
        uniformSegmentOverrides.bold = nextValue;
      } else if (styleKey === "italic" && typeof nextValue === "boolean") {
        uniformSegmentOverrides.italic = nextValue;
      } else if (styleKey === "underline" && typeof nextValue === "boolean") {
        uniformSegmentOverrides.underline = nextValue;
      } else if (
        styleKey === "strikethrough" &&
        typeof nextValue === "boolean"
      ) {
        uniformSegmentOverrides.strikethrough = nextValue;
      } else if (styleKey === "rtl" && typeof nextValue === "boolean") {
        uniformSegmentOverrides.rtl = nextValue;
      } else if (styleKey === "hyperlink" && typeof nextValue === "string") {
        uniformSegmentOverrides.hyperlink = nextValue;
      } else if (styleKey === "color" && typeof nextValue === "string") {
        uniformSegmentOverrides.color = nextValue;
      } else if (
        styleKey === "align" &&
        (nextValue === "left" ||
          nextValue === "center" ||
          nextValue === "right" ||
          nextValue === "justify")
      ) {
        uniformSegmentOverrides.align = nextValue;
      }
    }
  });

  return uniformSegmentOverrides;
}
