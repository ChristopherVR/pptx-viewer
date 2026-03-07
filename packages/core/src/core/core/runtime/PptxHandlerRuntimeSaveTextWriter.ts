import { XmlObject, type PptxElementWithText } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveEffectsWriter";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Build and write the text body (`p:txBody`) for shapes, text boxes,
   * and connectors that carry text content.
   *
   * Handles bodyPr attributes (vAlign, textDirection, columns, spacing,
   * overflow, autoFit, body insets, text wrap, warp, 3D text, linked
   * text chains), and delegates paragraph creation to
   * `createParagraphsFromTextContent`.
   */
  protected applyTextBodyContent(
    shape: XmlObject,
    el: PptxElementWithText,
    resolveHyperlinkRelationshipId: (target: string) => string | undefined,
    getSlideRelationshipMap: () => Map<string, string>,
  ): void {
    const hasEditableTextContent =
      typeof el.text === "string" || (el.textSegments?.length ?? 0) > 0;
    if (!hasEditableTextContent) return;

    if (!shape["p:txBody"]) {
      shape["p:txBody"] = {
        "a:bodyPr": {},
        "a:lstStyle": {},
        "a:p": [],
      };
    }
    const txBody = shape["p:txBody"] as XmlObject;
    const bodyPr = (txBody["a:bodyPr"] || {}) as XmlObject;

    // Vertical anchor
    const verticalAnchor = this.textVerticalAlignToDrawingValue(
      el.textStyle?.vAlign,
    );
    if (verticalAnchor) {
      bodyPr["@_anchor"] = verticalAnchor;
    } else {
      delete bodyPr["@_anchor"];
    }

    // Text direction
    const bodyTextDirection = this.textDirectionToDrawingValue(
      el.textStyle?.textDirection,
    );
    if (bodyTextDirection) {
      bodyPr["@_vert"] = bodyTextDirection;
    } else {
      delete bodyPr["@_vert"];
    }

    // Column count
    const bodyColumnCount = this.normalizeTextColumnCount(
      el.textStyle?.columnCount,
    );
    if (bodyColumnCount && bodyColumnCount > 1) {
      bodyPr["@_numCol"] = String(bodyColumnCount);
    } else {
      delete bodyPr["@_numCol"];
    }

    // Column spacing
    if (el.textStyle?.columnSpacing !== undefined) {
      bodyPr["@_spcCol"] = String(
        Math.round(el.textStyle.columnSpacing * PptxHandlerRuntime.EMU_PER_PX),
      );
    }

    // Overflow
    if (el.textStyle?.hOverflow) {
      bodyPr["@_hOverflow"] = el.textStyle.hOverflow;
    }
    if (el.textStyle?.vertOverflow) {
      bodyPr["@_vertOverflow"] = el.textStyle.vertOverflow;
    }

    // Auto-fit / shrink-to-fit
    this.applyAutoFitToBodyPr(bodyPr, el);

    // Body text insets
    this.applyBodyInsets(bodyPr, el);

    // Text wrapping mode
    if (el.textStyle?.textWrap === "none") {
      bodyPr["@_wrap"] = "none";
    } else if (el.textStyle?.textWrap === "square") {
      bodyPr["@_wrap"] = "square";
    }

    // Additional bodyPr boolean attributes
    if (el.textStyle?.compatibleLineSpacing !== undefined)
      bodyPr["@_compatLnSpc"] = el.textStyle.compatibleLineSpacing ? "1" : "0";
    if (el.textStyle?.forceAntiAlias !== undefined)
      bodyPr["@_forceAA"] = el.textStyle.forceAntiAlias ? "1" : "0";
    if (el.textStyle?.upright !== undefined)
      bodyPr["@_upright"] = el.textStyle.upright ? "1" : "0";
    if (el.textStyle?.fromWordArt !== undefined)
      bodyPr["@_fromWordArt"] = el.textStyle.fromWordArt ? "1" : "0";

    // Text warp preset
    if (el.textStyle?.textWarpPreset) {
      bodyPr["a:prstTxWarp"] = {
        "@_prst": el.textStyle.textWarpPreset,
      };
    } else {
      delete bodyPr["a:prstTxWarp"];
    }

    // 3D text body
    this.applyText3d(bodyPr, el);

    // Linked text box chain round-trip
    if (el.linkedTxbxId !== undefined && Number.isFinite(el.linkedTxbxId)) {
      bodyPr["a:linkedTxbx"] = {
        "@_id": String(el.linkedTxbxId),
        "@_seq": String(el.linkedTxbxSeq ?? 0),
      };
    } else {
      delete bodyPr["a:linkedTxbx"];
    }

    // Resolve text value and segments
    const textValueForSave = this.getTextValueForSave(el.text, el.textSegments);
    let textSegmentsForSave = el.textSegments;
    if (
      typeof el.text === "string" &&
      this.areTextSegmentsUniform(el.textSegments)
    ) {
      textSegmentsForSave = undefined;
      const existingTextSegments = this.extractTextSegmentsFromTxBodyForRewrite(
        txBody,
        el.textStyle,
        getSlideRelationshipMap(),
      );
      if (
        existingTextSegments.length > 1 &&
        this.hasMixedTextStyles(existingTextSegments)
      ) {
        textSegmentsForSave = this.remapEditedTextToExistingStyles(
          existingTextSegments,
          textValueForSave,
          el.textStyle,
        );
      }
    }

    txBody["a:bodyPr"] = bodyPr;
    txBody["a:p"] = this.createParagraphsFromTextContent(
      textValueForSave,
      el.textStyle,
      textSegmentsForSave,
      resolveHyperlinkRelationshipId,
    );
  }

  /** Apply auto-fit mode settings to bodyPr. */
  private applyAutoFitToBodyPr(
    bodyPr: XmlObject,
    el: PptxElementWithText,
  ): void {
    if (el.textStyle?.autoFitMode !== undefined) {
      delete bodyPr["a:spAutoFit"];
      delete bodyPr["a:normAutofit"];
      delete bodyPr["a:noAutofit"];

      if (el.textStyle.autoFitMode === "shrink") {
        bodyPr["a:spAutoFit"] = {};
      } else if (el.textStyle.autoFitMode === "normal") {
        const normNode: Record<string, unknown> = {};
        if (
          el.textStyle.autoFitFontScale !== undefined &&
          el.textStyle.autoFitFontScale < 1
        ) {
          normNode["@_fontScale"] = String(
            Math.round(el.textStyle.autoFitFontScale * 100000),
          );
        }
        if (
          el.textStyle.autoFitLineSpacingReduction !== undefined &&
          el.textStyle.autoFitLineSpacingReduction > 0
        ) {
          normNode["@_lnSpcReduction"] = String(
            Math.round(el.textStyle.autoFitLineSpacingReduction * 100000),
          );
        }
        bodyPr["a:normAutofit"] = normNode;
      } else if (el.textStyle.autoFitMode === "none") {
        bodyPr["a:noAutofit"] = {};
      }
    } else if (el.textStyle?.autoFit) {
      // Legacy path — keep backward compat
      if (!bodyPr["a:spAutoFit"] && !bodyPr["a:normAutofit"]) {
        if (
          el.textStyle.autoFitFontScale !== undefined &&
          el.textStyle.autoFitFontScale < 1
        ) {
          const normNode: Record<string, unknown> = {
            "@_fontScale": String(
              Math.round(el.textStyle.autoFitFontScale * 100000),
            ),
          };
          if (
            el.textStyle.autoFitLineSpacingReduction !== undefined &&
            el.textStyle.autoFitLineSpacingReduction > 0
          ) {
            normNode["@_lnSpcReduction"] = String(
              Math.round(el.textStyle.autoFitLineSpacingReduction * 100000),
            );
          }
          bodyPr["a:normAutofit"] = normNode;
        } else {
          bodyPr["a:spAutoFit"] = {};
        }
      }
      if (
        bodyPr["a:normAutofit"] &&
        el.textStyle.autoFitFontScale !== undefined
      ) {
        (bodyPr["a:normAutofit"] as Record<string, unknown>)["@_fontScale"] =
          String(Math.round(el.textStyle.autoFitFontScale * 100000));
      }
    } else if (
      el.textStyle?.autoFit === false &&
      el.textStyle?.autoFitMode === undefined
    ) {
      delete bodyPr["a:spAutoFit"];
      delete bodyPr["a:normAutofit"];
    }
  }

  /** Apply body insets (margin) to bodyPr. */
  private applyBodyInsets(bodyPr: XmlObject, el: PptxElementWithText): void {
    if (
      typeof el.textStyle?.bodyInsetLeft === "number" &&
      Number.isFinite(el.textStyle.bodyInsetLeft)
    ) {
      bodyPr["@_lIns"] = String(
        Math.round(el.textStyle.bodyInsetLeft * PptxHandlerRuntime.EMU_PER_PX),
      );
    }
    if (
      typeof el.textStyle?.bodyInsetTop === "number" &&
      Number.isFinite(el.textStyle.bodyInsetTop)
    ) {
      bodyPr["@_tIns"] = String(
        Math.round(el.textStyle.bodyInsetTop * PptxHandlerRuntime.EMU_PER_PX),
      );
    }
    if (
      typeof el.textStyle?.bodyInsetRight === "number" &&
      Number.isFinite(el.textStyle.bodyInsetRight)
    ) {
      bodyPr["@_rIns"] = String(
        Math.round(el.textStyle.bodyInsetRight * PptxHandlerRuntime.EMU_PER_PX),
      );
    }
    if (
      typeof el.textStyle?.bodyInsetBottom === "number" &&
      Number.isFinite(el.textStyle.bodyInsetBottom)
    ) {
      bodyPr["@_bIns"] = String(
        Math.round(
          el.textStyle.bodyInsetBottom * PptxHandlerRuntime.EMU_PER_PX,
        ),
      );
    }
  }

  /** Apply 3D text properties to bodyPr. */
  private applyText3d(bodyPr: XmlObject, el: PptxElementWithText): void {
    const t3d = el.textStyle?.text3d;
    if (t3d && Object.keys(t3d).length > 0) {
      const sp3dXml: XmlObject = {};
      if (t3d.extrusionHeight) sp3dXml["@_extrusionH"] = t3d.extrusionHeight;
      if (t3d.presetMaterial) sp3dXml["@_prstMaterial"] = t3d.presetMaterial;
      if (t3d.bevelTopType && t3d.bevelTopType !== "none") {
        const bvt: XmlObject = { "@_prst": t3d.bevelTopType };
        if (t3d.bevelTopWidth) bvt["@_w"] = t3d.bevelTopWidth;
        if (t3d.bevelTopHeight) bvt["@_h"] = t3d.bevelTopHeight;
        sp3dXml["a:bevelT"] = bvt;
      }
      if (t3d.bevelBottomType && t3d.bevelBottomType !== "none") {
        const bvb: XmlObject = { "@_prst": t3d.bevelBottomType };
        if (t3d.bevelBottomWidth) bvb["@_w"] = t3d.bevelBottomWidth;
        if (t3d.bevelBottomHeight) bvb["@_h"] = t3d.bevelBottomHeight;
        sp3dXml["a:bevelB"] = bvb;
      }
      if (t3d.extrusionColor) {
        sp3dXml["a:extrusionClr"] = {
          "a:srgbClr": {
            "@_val": t3d.extrusionColor.replace("#", ""),
          },
        };
      }
      bodyPr["a:sp3d"] = sp3dXml;
    } else {
      delete bodyPr["a:sp3d"];
    }
  }
}
