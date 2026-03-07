import { XmlObject, PptxElement } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimePictureParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Known element tag names that appear as direct children of `p:spTree`
   * (or `p:grpSp`) and represent renderable shapes/objects.
   */
  private static readonly ELEMENT_TAGS = new Set([
    "p:sp",
    "p:pic",
    "p:graphicFrame",
    "p:grpSp",
    "p:cxnSp",
    "p:contentPart",
  ]);

  /**
   * Extract the document-order sequence of child element types from a raw
   * XML string.  Returns an array of `{ tag, indexInType }` entries where
   * `indexInType` is the 0-based occurrence index within that tag's array.
   *
   * Falls back to the default type-grouped order when `xmlStr` is unavailable.
   */
  protected extractSpTreeChildOrder(
    xmlStr: string | undefined,
    spTree: Record<string, unknown>,
    containerTag: string,
  ): Array<{ tag: string; indexInType: number }> {
    if (xmlStr) {
      const result = this.scanDirectChildElements(xmlStr, containerTag);
      if (result.length > 0) return result;
    }
    return this.buildTypeGroupedOrder(spTree);
  }

  /**
   * Scan the raw XML to find direct child element tags of the first
   * occurrence of `containerTag`.
   */
  private scanDirectChildElements(
    xmlStr: string,
    containerTag: string,
  ): Array<{ tag: string; indexInType: number }> {
    const openPattern = new RegExp(`<${containerTag}[\\s>/]`);
    const openMatch = openPattern.exec(xmlStr);
    if (!openMatch) return [];

    const matchEndIdx = openMatch.index + openMatch[0].length;
    const tagCloseIdx = openMatch[0].endsWith(">")
      ? matchEndIdx - 1
      : xmlStr.indexOf(">", matchEndIdx);
    if (tagCloseIdx === -1) return [];

    if (xmlStr[tagCloseIdx - 1] === "/") return [];

    let pos = tagCloseIdx + 1;
    let depth = 0;
    const order: Array<{ tag: string; indexInType: number }> = [];
    const counters: Record<string, number> = {};

    while (pos < xmlStr.length) {
      const ltIdx = xmlStr.indexOf("<", pos);
      if (ltIdx === -1) break;

      if (xmlStr[ltIdx + 1] === "/") {
        const closeEnd = xmlStr.indexOf(">", ltIdx + 2);
        if (closeEnd === -1) break;
        const closingTagName = xmlStr.slice(ltIdx + 2, closeEnd).trim();
        if (depth === 0 && closingTagName === containerTag) break;
        if (depth > 0) depth--;
        pos = closeEnd + 1;
        continue;
      }

      if (xmlStr[ltIdx + 1] === "!" || xmlStr[ltIdx + 1] === "?") {
        const skipEnd = xmlStr.indexOf(">", ltIdx + 2);
        pos = skipEnd === -1 ? xmlStr.length : skipEnd + 1;
        continue;
      }

      const gtIdx = xmlStr.indexOf(">", ltIdx + 1);
      if (gtIdx === -1) break;
      const isSelfClosing = xmlStr[gtIdx - 1] === "/";

      const tagFragment = xmlStr.slice(ltIdx + 1, gtIdx);
      const spaceIdx = tagFragment.search(/[\s/]/);
      const tagName =
        spaceIdx === -1 ? tagFragment : tagFragment.slice(0, spaceIdx);

      if (depth === 0 && PptxHandlerRuntime.ELEMENT_TAGS.has(tagName)) {
        const idx = counters[tagName] ?? 0;
        counters[tagName] = idx + 1;
        order.push({ tag: tagName, indexInType: idx });
      }

      if (!isSelfClosing) depth++;
      pos = gtIdx + 1;
    }

    return order;
  }

  /**
   * Build the legacy type-grouped order (all shapes, then all pictures,
   * etc.).  Used as a fallback when raw XML is unavailable.
   */
  private buildTypeGroupedOrder(
    spTree: Record<string, unknown>,
  ): Array<{ tag: string; indexInType: number }> {
    const order: Array<{ tag: string; indexInType: number }> = [];
    const tags = [
      "p:sp",
      "p:pic",
      "p:graphicFrame",
      "p:grpSp",
      "p:cxnSp",
      "p:contentPart",
    ];
    for (const tag of tags) {
      const arr = this.ensureArray(spTree[tag]);
      for (let i = 0; i < arr.length; i++) {
        order.push({ tag, indexInType: i });
      }
    }
    return order;
  }

  /**
   * Parse a single element from its tag and index within the type array.
   */
  protected async parseSpTreeChild(
    tag: string,
    indexInType: number,
    spTree: Record<string, unknown>,
    slidePath: string,
    idPrefix: string,
    rawXmlStr?: string,
  ): Promise<PptxElement | null> {
    const arr = this.ensureArray(spTree[tag]);
    const node = arr[indexInType];
    if (!node) return null;

    switch (tag) {
      case "p:sp": {
        const spPr = node["p:spPr"];
        if (spPr?.["a:blipFill"]) {
          return this.parseShapeWithImageFill(
            node,
            `${idPrefix}shape-img-${indexInType}`,
            slidePath,
          );
        }
        return this.parseShape(
          node,
          `${idPrefix}shape-${indexInType}`,
          slidePath,
        );
      }
      case "p:pic":
        return this.parsePicture(
          node,
          `${idPrefix}pic-${indexInType}`,
          slidePath,
        );
      case "p:graphicFrame":
        return this.parseGraphicFrame(
          node,
          `${idPrefix}frame-${indexInType}`,
          slidePath,
        );
      case "p:grpSp":
        return this.parseGroupShapeAsGroup(
          node,
          `${idPrefix}group-${indexInType}`,
          slidePath,
          rawXmlStr,
        );
      case "p:cxnSp":
        return this.parseConnector(
          node,
          `${idPrefix}conn-${indexInType}`,
          slidePath,
        );
      case "p:contentPart":
        return this.parseContentPart(
          node,
          `${idPrefix}contentPart-${indexInType}`,
          slidePath,
        );
      default:
        return null;
    }
  }

  /**
   * Parse all element children from an spTree (or similar container) in
   * document order.
   */
  protected async parseSpTreeChildren(
    spTree: Record<string, unknown>,
    slidePath: string,
    xmlStr: string | undefined,
    containerTag: string,
    idPrefix: string = "",
  ): Promise<PptxElement[]> {
    const order = this.extractSpTreeChildOrder(xmlStr, spTree, containerTag);
    const elements: PptxElement[] = [];

    for (const entry of order) {
      const element = await this.parseSpTreeChild(
        entry.tag,
        entry.indexInType,
        spTree,
        slidePath,
        idPrefix,
        xmlStr,
      );
      if (element) elements.push(element);
    }

    return elements;
  }

  /**
   * Unwrap mc:AlternateContent elements within a shape tree (or group),
   * merging selected branch children into the parent element arrays.
   */
  protected unwrapAlternateContent(container: Record<string, unknown>): void {
    const altContents = this.ensureArray(container["mc:AlternateContent"]);
    if (altContents.length === 0) return;

    const elementTypes = [
      "p:sp",
      "p:pic",
      "p:graphicFrame",
      "p:grpSp",
      "p:cxnSp",
      "p:contentPart",
    ] as const;

    for (const ac of altContents) {
      const branch = this.selectAlternateContentBranch(ac as XmlObject);
      if (!branch) continue;
      for (const tag of elementTypes) {
        const children = this.ensureArray(branch[tag]);
        if (children.length > 0) {
          container[tag] = [...this.ensureArray(container[tag]), ...children];
        }
      }
    }
  }

  /**
   * Forward declaration – implemented in PptxHandlerRuntimeGroupParsing.
   */
  protected parseGroupShapeAsGroup(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _group: any,
    _baseId: string,
    _slidePath: string,
    _rawXmlStr?: string,
  ): Promise<PptxElement | null> {
    throw new Error("parseGroupShapeAsGroup not yet initialised");
  }
}
