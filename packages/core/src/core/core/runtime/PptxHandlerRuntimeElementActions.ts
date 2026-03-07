import {
  XmlObject,
  type PptxAction,
  type PptxShapeLocks,
  PptxElement,
} from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeTableStyles";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Write or remove a single `a:hlinkClick` / `a:hlinkHover` node on
   * a `p:cNvPr` parent.
   */
  protected serializeSingleAction(
    cNvPr: XmlObject,
    nodeName: string,
    action: PptxAction | undefined,
    resolveHyperlinkRelationshipId: (target: string) => string | undefined,
  ): void {
    if (!action) {
      delete cNvPr[nodeName];
      return;
    }
    const node: XmlObject = {};
    let rId = action.rId;
    if (!rId && action.url) {
      rId = resolveHyperlinkRelationshipId(action.url) ?? undefined;
    }
    if (rId) {
      node["@_r:id"] = rId;
    }
    if (action.action) {
      node["@_action"] = action.action;
    }
    if (action.tooltip) {
      node["@_tooltip"] = action.tooltip;
    }
    if (action.highlightClick) {
      node["@_highlightClick"] = "1";
    }
    const soundRId = action.soundRId;
    if (soundRId) {
      node["a:snd"] = {
        "@_r:embed": soundRId,
      };
    }
    cNvPr[nodeName] = node;
  }

  protected getTreeBucketKeyForElementType(type: PptxElement["type"]): string {
    if (type === "picture" || type === "image") return "p:pic";
    if (type === "connector") return "p:cxnSp";
    if (
      type === "table" ||
      type === "chart" ||
      type === "smartArt" ||
      type === "ole" ||
      type === "media"
    ) {
      return "p:graphicFrame";
    }
    return "p:sp";
  }

  protected getCnvPrNode(shape: XmlObject, key: string): XmlObject | undefined {
    if (key === "p:pic") {
      return shape?.["p:nvPicPr"]?.["p:cNvPr"] as XmlObject | undefined;
    }
    if (key === "p:cxnSp") {
      return shape?.["p:nvCxnSpPr"]?.["p:cNvPr"] as XmlObject | undefined;
    }
    if (key === "p:graphicFrame") {
      return shape?.["p:nvGraphicFramePr"]?.["p:cNvPr"] as
        | XmlObject
        | undefined;
    }
    return shape?.["p:nvSpPr"]?.["p:cNvPr"] as XmlObject | undefined;
  }

  /**
   * Serialize shape-level actions back onto the `p:cNvPr` node, updating
   * the `a:hlinkClick` and `a:hlinkHover` nodes on the element's
   * non-visual properties.
   */
  protected serializeElementActions(
    shape: XmlObject,
    el: PptxElement,
    resolveHyperlinkRelationshipId: (target: string) => string | undefined,
  ): void {
    const key = this.getTreeBucketKeyForElementType(el.type);
    const cNvPr = this.getCnvPrNode(shape, key);
    if (!cNvPr) return;

    const actionClick =
      "actionClick" in el
        ? (el.actionClick as PptxAction | undefined)
        : undefined;
    const actionHover =
      "actionHover" in el
        ? (el.actionHover as PptxAction | undefined)
        : undefined;

    this.serializeSingleAction(
      cNvPr,
      "a:hlinkClick",
      actionClick,
      resolveHyperlinkRelationshipId,
    );
    this.serializeSingleAction(
      cNvPr,
      "a:hlinkHover",
      actionHover,
      resolveHyperlinkRelationshipId,
    );
  }

  /**
   * Serialize shape lock attributes from an element back into the XML.
   *
   * Writes `a:spLocks` (shapes), `a:picLocks` (pictures), or `a:cxnSpLocks`
   * (connectors) onto the appropriate `p:cNvXxxPr` container.
   */
  protected serializeShapeLocks(shape: XmlObject, el: PptxElement): void {
    const locks: PptxShapeLocks | undefined =
      "locks" in el ? (el.locks as PptxShapeLocks | undefined) : undefined;

    const key = this.getTreeBucketKeyForElementType(el.type);

    // Resolve the cNv*Pr container and the lock tag name.
    let container: XmlObject | undefined;
    let lockTag: string;
    if (key === "p:pic") {
      container = shape?.["p:nvPicPr"]?.["p:cNvPicPr"] as XmlObject | undefined;
      lockTag = "a:picLocks";
    } else if (key === "p:cxnSp") {
      container = shape?.["p:nvCxnSpPr"]?.["p:cNvCxnSpPr"] as
        | XmlObject
        | undefined;
      lockTag = "a:cxnSpLocks";
    } else if (key === "p:sp") {
      container = shape?.["p:nvSpPr"]?.["p:cNvSpPr"] as XmlObject | undefined;
      lockTag = "a:spLocks";
    } else {
      // graphic frames / other — no lock serialization
      return;
    }

    if (!container) return;

    if (!locks) {
      // No locks on the element — remove any existing lock node
      delete container[lockTag];
      return;
    }

    const lockAttrs: XmlObject = {};
    const mapping: Array<[keyof PptxShapeLocks, string]> = [
      ["noGrouping", "@_noGrp"],
      ["noRotation", "@_noRot"],
      ["noMove", "@_noMove"],
      ["noResize", "@_noResize"],
      ["noTextEdit", "@_noTextEdit"],
      ["noSelect", "@_noSelect"],
      ["noChangeAspect", "@_noChangeAspect"],
      ["noEditPoints", "@_noEditPoints"],
      ["noAdjustHandles", "@_noAdjustHandles"],
      ["noChangeArrowheads", "@_noChangeArrowheads"],
      ["noChangeShapeType", "@_noChangeShapeType"],
    ];
    let hasAny = false;
    for (const [prop, attr] of mapping) {
      if (locks[prop] !== undefined) {
        lockAttrs[attr] = locks[prop] ? "1" : "0";
        hasAny = true;
      }
    }

    if (hasAny) {
      container[lockTag] = lockAttrs;
    } else {
      delete container[lockTag];
    }
  }
}
