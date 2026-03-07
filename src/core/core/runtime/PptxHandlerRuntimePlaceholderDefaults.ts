import {
  XmlObject,
  PlaceholderTextLevelStyle,
  PlaceholderDefaults,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimePlaceholderStyles";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Extract structured {@link PlaceholderDefaults} from a layout or master
   * shape that carries a `p:ph` element.
   */
  protected extractPlaceholderDefaultsFromShape(
    shape: XmlObject,
  ): PlaceholderDefaults | null {
    const nvSpPr = shape["p:nvSpPr"] as XmlObject | undefined;
    const phNode = nvSpPr?.["p:nvPr"]?.["p:ph"] as XmlObject | undefined;
    if (!phNode) return null;

    const typeRaw = phNode["@_type"];
    const idxRaw = phNode["@_idx"];
    const type = typeRaw !== undefined ? String(typeRaw).toLowerCase() : "body"; // OOXML default placeholder type is "body"

    const defaults: PlaceholderDefaults = { type };
    if (idxRaw !== undefined) {
      const parsed = Number.parseInt(String(idxRaw), 10);
      if (Number.isFinite(parsed)) {
        defaults.idx = parsed;
      }
    }

    // Body properties (a:bodyPr)
    const txBody = shape["p:txBody"] as XmlObject | undefined;
    const bodyPr = txBody?.["a:bodyPr"] as XmlObject | undefined;
    if (bodyPr) {
      const lIns = bodyPr["@_lIns"];
      if (lIns !== undefined) {
        const val = Number.parseInt(String(lIns), 10);
        if (Number.isFinite(val))
          defaults.bodyInsetLeft = val / PptxHandlerRuntime.EMU_PER_PX;
      }
      const tIns = bodyPr["@_tIns"];
      if (tIns !== undefined) {
        const val = Number.parseInt(String(tIns), 10);
        if (Number.isFinite(val))
          defaults.bodyInsetTop = val / PptxHandlerRuntime.EMU_PER_PX;
      }
      const rIns = bodyPr["@_rIns"];
      if (rIns !== undefined) {
        const val = Number.parseInt(String(rIns), 10);
        if (Number.isFinite(val))
          defaults.bodyInsetRight = val / PptxHandlerRuntime.EMU_PER_PX;
      }
      const bIns = bodyPr["@_bIns"];
      if (bIns !== undefined) {
        const val = Number.parseInt(String(bIns), 10);
        if (Number.isFinite(val))
          defaults.bodyInsetBottom = val / PptxHandlerRuntime.EMU_PER_PX;
      }
      const anchor = String(bodyPr["@_anchor"] || "").trim();
      if (anchor.length > 0) defaults.textAnchor = anchor;

      if (bodyPr["a:spAutoFit"] !== undefined) {
        defaults.autoFit = true;
        defaults.autoFitMode = "shrink";
      } else if (bodyPr["a:normAutofit"] !== undefined) {
        defaults.autoFit = true;
        defaults.autoFitMode = "normal";
        const fontScaleRaw = parseInt(
          String(
            (bodyPr["a:normAutofit"] as Record<string, unknown>)?.[
              "@_fontScale"
            ] || "",
          ),
          10,
        );
        if (Number.isFinite(fontScaleRaw) && fontScaleRaw > 0) {
          // OOXML fontScale is in thousandths of a percent (90000 = 90%)
          defaults.autoFitFontScale = fontScaleRaw / 100000;
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
          // OOXML lnSpcReduction is in thousandths of a percent (20000 = 20%)
          defaults.autoFitLineSpacingReduction = lnSpcReductionRaw / 100000;
        }
      } else if (bodyPr["a:noAutofit"] !== undefined) {
        defaults.autoFit = false;
        defaults.autoFitMode = "none";
      }

      const wrapAttr = String(bodyPr["@_wrap"] || "")
        .trim()
        .toLowerCase();
      if (wrapAttr === "none" || wrapAttr === "square") {
        defaults.textWrap = wrapAttr;
      }
    }

    // List style levels (a:lstStyle > a:lvl1pPr … a:lvl9pPr)
    const lstStyle = txBody?.["a:lstStyle"] as XmlObject | undefined;
    if (lstStyle) {
      const levelStyles: Record<number, PlaceholderTextLevelStyle> = {};
      for (let lvl = 1; lvl <= 9; lvl++) {
        const key = `a:lvl${lvl}pPr`;
        const parsed = this.parsePlaceholderLevelStyle(
          lstStyle[key] as XmlObject | undefined,
        );
        if (parsed) levelStyles[lvl - 1] = parsed;
      }
      // Also parse the default level (a:defPPr)
      const defParsed = this.parsePlaceholderLevelStyle(
        lstStyle["a:defPPr"] as XmlObject | undefined,
      );
      if (defParsed) {
        // Store default at level -1 to distinguish from level 0
        levelStyles[-1] = defParsed;
      }
      if (Object.keys(levelStyles).length > 0) {
        defaults.levelStyles = levelStyles;
      }
    }

    // Extract prompt text from paragraphs in the layout/master placeholder
    if (txBody) {
      const paras = this.ensureArray(txBody["a:p"]) as XmlObject[];
      const promptParts: string[] = [];
      for (const p of paras) {
        const runs = this.ensureArray(p?.["a:r"]) as XmlObject[];
        for (const r of runs) {
          if (!r) continue;
          const t = r["a:t"];
          if (t !== undefined) {
            promptParts.push(String(t));
          }
        }
        // Also check direct text
        if (p?.["a:t"] !== undefined) {
          promptParts.push(String(p["a:t"]));
        }
        // Check field elements
        const fields = this.ensureArray(p?.["a:fld"]) as XmlObject[];
        for (const field of fields) {
          if (!field) continue;
          const t = field["a:t"];
          if (t !== undefined) {
            promptParts.push(String(t));
          }
        }
      }
      const promptText = promptParts.join("").trim();
      if (promptText.length > 0) {
        defaults.promptText = promptText;
      }
    }

    return defaults;
  }
}
