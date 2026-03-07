import {
  XmlObject,
  type PptxShapeLocks,
  TextStyle,
  type PptxTextWarpPreset,
  type Text3DStyle,
  type BevelPresetType,
  type MaterialPresetType,
} from "../../types";

import type { BodyPropertiesResult } from "./PptxHandlerRuntimeTypes";
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeBulletParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse `a:spLocks` attributes into a structured {@link PptxShapeLocks} object.
   * Returns `undefined` when the node is absent or contains no lock attributes.
   */
  protected parseShapeLocks(
    spLocks: XmlObject | undefined,
  ): PptxShapeLocks | undefined {
    if (!spLocks) return undefined;

    const locks: PptxShapeLocks = {};
    let hasAny = false;

    const boolAttr = (attr: string): boolean | undefined => {
      const raw = spLocks[attr];
      if (raw === undefined) return undefined;
      const val = String(raw).trim().toLowerCase();
      return val === "1" || val === "true";
    };

    const set = (attr: string, fn: (v: boolean) => void) => {
      const val = boolAttr(attr);
      if (val !== undefined) {
        fn(val);
        hasAny = true;
      }
    };

    set("@_noGrp", (v) => {
      locks.noGrouping = v;
    });
    set("@_noRot", (v) => {
      locks.noRotation = v;
    });
    set("@_noMove", (v) => {
      locks.noMove = v;
    });
    set("@_noResize", (v) => {
      locks.noResize = v;
    });
    set("@_noTextEdit", (v) => {
      locks.noTextEdit = v;
    });
    set("@_noSelect", (v) => {
      locks.noSelect = v;
    });
    set("@_noChangeAspect", (v) => {
      locks.noChangeAspect = v;
    });
    set("@_noEditPoints", (v) => {
      locks.noEditPoints = v;
    });
    set("@_noAdjustHandles", (v) => {
      locks.noAdjustHandles = v;
    });
    set("@_noChangeArrowheads", (v) => {
      locks.noChangeArrowheads = v;
    });
    set("@_noChangeShapeType", (v) => {
      locks.noChangeShapeType = v;
    });

    return hasAny ? locks : undefined;
  }

  /**
   * Extract body-level text properties from `a:bodyPr` and apply them to the
   * provided {@link TextStyle}.  Returns linked-textbox info when present.
   */
  protected applyBodyProperties(
    bodyPr: XmlObject | undefined,
    txBody: XmlObject | undefined,
    textStyle: TextStyle,
  ): BodyPropertiesResult {
    const result: BodyPropertiesResult = {};

    // Linked text box chain (a:bodyPr > a:linkedTxbx or direct a:linkedTxbx sibling)
    const linkedTxbx = (bodyPr?.["a:linkedTxbx"] ??
      txBody?.["a:linkedTxbx"]) as XmlObject | undefined;
    if (linkedTxbx) {
      const ltxId = Number.parseInt(String(linkedTxbx["@_id"] || ""), 10);
      const ltxSeq = Number.parseInt(String(linkedTxbx["@_seq"] || "0"), 10);
      if (Number.isFinite(ltxId)) {
        result.linkedTxbxId = ltxId;
        result.linkedTxbxSeq = Number.isFinite(ltxSeq) ? ltxSeq : 0;
      }
    }

    if (!bodyPr) return result;

    const verticalAlign = this.textVerticalAlignFromDrawingValue(
      bodyPr["@_anchor"],
    );
    if (verticalAlign) textStyle.vAlign = verticalAlign;

    const textDirection = this.textDirectionFromDrawingValue(bodyPr["@_vert"]);
    if (textDirection) textStyle.textDirection = textDirection;

    const bodyColumnCount = this.normalizeTextColumnCount(bodyPr["@_numCol"]);
    if (bodyColumnCount && bodyColumnCount > 1)
      textStyle.columnCount = bodyColumnCount;

    const spcColRaw = parseInt(String(bodyPr["@_spcCol"] || ""), 10);
    if (Number.isFinite(spcColRaw) && spcColRaw > 0) {
      textStyle.columnSpacing = spcColRaw / PptxHandlerRuntime.EMU_PER_PX;
    }

    const hOverflow = String(bodyPr["@_hOverflow"] || "").trim();
    if (hOverflow === "overflow" || hOverflow === "clip") {
      textStyle.hOverflow = hOverflow;
    }
    const vertOverflow = String(bodyPr["@_vertOverflow"] || "").trim();
    if (
      vertOverflow === "overflow" ||
      vertOverflow === "clip" ||
      vertOverflow === "ellipsis"
    ) {
      textStyle.vertOverflow = vertOverflow;
    }

    // Text warp preset from a:prstTxWarp
    const prstTxWarp = bodyPr["a:prstTxWarp"] as XmlObject | undefined;
    if (prstTxWarp) {
      const warpPreset = String(prstTxWarp["@_prst"] || "").trim();
      if (warpPreset.length > 0 && warpPreset !== "textNoShape") {
        textStyle.textWarpPreset = warpPreset as PptxTextWarpPreset;
      }
    }

    // 3D text body properties (a:bodyPr/a:sp3d)
    const bodySp3d = bodyPr["a:sp3d"] as XmlObject | undefined;
    if (bodySp3d) {
      const bevelT = bodySp3d["a:bevelT"] as XmlObject | undefined;
      const bevelB = bodySp3d["a:bevelB"] as XmlObject | undefined;
      const t3d: Text3DStyle = {};
      if (bodySp3d["@_extrusionH"] != null) {
        t3d.extrusionHeight = parseInt(String(bodySp3d["@_extrusionH"]), 10);
      }
      const extClr = this.parseColor(
        bodySp3d["a:extrusionClr"] as XmlObject | undefined,
      );
      if (extClr) t3d.extrusionColor = extClr;
      const mat = String(bodySp3d["@_prstMaterial"] || "").trim();
      if (mat) t3d.presetMaterial = mat as MaterialPresetType;
      if (bevelT) {
        t3d.bevelTopType = String(
          bevelT["@_prst"] || "circle",
        ).trim() as BevelPresetType;
        if (bevelT["@_w"] != null)
          t3d.bevelTopWidth = parseInt(String(bevelT["@_w"]), 10);
        if (bevelT["@_h"] != null)
          t3d.bevelTopHeight = parseInt(String(bevelT["@_h"]), 10);
      }
      if (bevelB) {
        t3d.bevelBottomType = String(
          bevelB["@_prst"] || "circle",
        ).trim() as BevelPresetType;
        if (bevelB["@_w"] != null)
          t3d.bevelBottomWidth = parseInt(String(bevelB["@_w"]), 10);
        if (bevelB["@_h"] != null)
          t3d.bevelBottomHeight = parseInt(String(bevelB["@_h"]), 10);
      }
      if (Object.keys(t3d).length > 0) textStyle.text3d = t3d;
    }

    // Auto-fit
    if (bodyPr["a:spAutoFit"] !== undefined) {
      textStyle.autoFit = true;
      textStyle.autoFitMode = "shrink";
    } else if (bodyPr["a:normAutofit"] !== undefined) {
      textStyle.autoFit = true;
      textStyle.autoFitMode = "normal";
      const fontScaleRaw = parseInt(
        String(
          (bodyPr["a:normAutofit"] as Record<string, unknown>)?.[
            "@_fontScale"
          ] || "",
        ),
        10,
      );
      if (Number.isFinite(fontScaleRaw) && fontScaleRaw > 0) {
        textStyle.autoFitFontScale = fontScaleRaw / 100000;
      }
      const lnSpcReductionRaw = parseInt(
        String(
          (bodyPr["a:normAutofit"] as Record<string, unknown>)?.[
            "@_lnSpcReduction"
          ] || "",
        ),
        10,
      );
      if (Number.isFinite(lnSpcReductionRaw) && lnSpcReductionRaw > 0) {
        textStyle.autoFitLineSpacingReduction = lnSpcReductionRaw / 100000;
      }
    } else if (bodyPr["a:noAutofit"] !== undefined) {
      textStyle.autoFit = false;
      textStyle.autoFitMode = "none";
    }

    // Text wrapping mode from a:bodyPr/@wrap
    const wrapAttr = String(bodyPr["@_wrap"] || "")
      .trim()
      .toLowerCase();
    if (wrapAttr === "none") textStyle.textWrap = "none";
    else if (wrapAttr === "square") textStyle.textWrap = "square";

    // Body text insets (lIns, tIns, rIns, bIns — EMU values)
    const parseInset = (attr: string): number | undefined => {
      const raw = bodyPr[attr];
      if (raw === undefined) return undefined;
      const val = Number.parseInt(String(raw), 10);
      return Number.isFinite(val)
        ? val / PptxHandlerRuntime.EMU_PER_PX
        : undefined;
    };
    const lIns = parseInset("@_lIns");
    if (lIns !== undefined) textStyle.bodyInsetLeft = lIns;
    const tIns = parseInset("@_tIns");
    if (tIns !== undefined) textStyle.bodyInsetTop = tIns;
    const rIns = parseInset("@_rIns");
    if (rIns !== undefined) textStyle.bodyInsetRight = rIns;
    const bIns = parseInset("@_bIns");
    if (bIns !== undefined) textStyle.bodyInsetBottom = bIns;

    return result;
  }

  /**
   * Set of OOXML namespace prefixes that this editor supports for
   * mc:AlternateContent/@_Requires selection.
   */
  private static readonly SUPPORTED_MC_NAMESPACES = new Set([
    "p14", // PowerPoint 2010 extensions
    "p15", // PowerPoint 2013 extensions
    "a14", // Drawing 2010 extensions
    "a16", // Drawing 2016 extensions
    "asvg", // SVG blip extension
  ]);

  /**
   * Select the appropriate branch from an mc:AlternateContent element.
   * Checks mc:Choice/@_Requires against supported namespaces; falls
   * back to mc:Fallback when the required namespace is not supported.
   */
  protected selectAlternateContentBranch(ac: XmlObject): XmlObject | undefined {
    const choices = this.ensureArray(ac["mc:Choice"]);
    for (const choice of choices) {
      const requires = String(choice?.["@_Requires"] ?? "").trim();
      if (requires.length === 0) {
        return choice as XmlObject;
      }
      const requiredNamespaces = requires.split(/\s+/);
      const allSupported = requiredNamespaces.every((ns: string) =>
        PptxHandlerRuntime.SUPPORTED_MC_NAMESPACES.has(ns),
      );
      if (allSupported) {
        return choice as XmlObject;
      }
    }
    return ac["mc:Fallback"] as XmlObject | undefined;
  }
}
