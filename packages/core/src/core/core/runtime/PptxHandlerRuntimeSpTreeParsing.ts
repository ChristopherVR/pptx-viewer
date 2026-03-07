import { XmlObject, PptxElement } from "../../types";
import {
  unwrapAlternateContent as unwrapAC,
  areNamespacesSupported,
} from "../../utils/alternate-content";
import { VML_SHAPE_TAGS, parseVmlElement } from "../../utils/vml-parser";

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
    "p16:model3D",
    ...VML_SHAPE_TAGS,
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
   *
   * Also handles `mc:AlternateContent` blocks: when one is found at
   * depth 0, the scanner resolves the selected branch (Choice or
   * Fallback) and includes element tags from that branch in the
   * document-order sequence.
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

      // When we encounter mc:AlternateContent at depth 0, resolve its
      // branch and extract element tags in document order.
      if (depth === 0 && tagName === "mc:AlternateContent" && !isSelfClosing) {
        const acEnd = PptxHandlerRuntime.findClosingTag(
          xmlStr,
          "mc:AlternateContent",
          gtIdx + 1,
        );
        if (acEnd !== -1) {
          const acInner = xmlStr.slice(gtIdx + 1, acEnd);
          const branchElements =
            PptxHandlerRuntime.scanAlternateContentBranch(acInner);
          for (const tag of branchElements) {
            const idx = counters[tag] ?? 0;
            counters[tag] = idx + 1;
            order.push({ tag, indexInType: idx });
          }
          const acCloseEnd = xmlStr.indexOf(">", acEnd);
          pos = acCloseEnd === -1 ? acEnd : acCloseEnd + 1;
          continue;
        }
      }

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
   * Find the position of a closing tag `</tagName>` in `xmlStr` starting
   * from `startPos`, properly handling nesting of the same tag.
   * Returns the index of the `<` of the closing tag, or -1 if not found.
   */
  private static findClosingTag(
    xmlStr: string,
    tagName: string,
    startPos: number,
  ): number {
    let pos = startPos;
    let nesting = 1;

    while (pos < xmlStr.length && nesting > 0) {
      const ltIdx = xmlStr.indexOf("<", pos);
      if (ltIdx === -1) break;

      if (xmlStr[ltIdx + 1] === "/") {
        const closeEnd = xmlStr.indexOf(">", ltIdx + 2);
        if (closeEnd === -1) break;
        const closeName = xmlStr.slice(ltIdx + 2, closeEnd).trim();
        if (closeName === tagName) {
          nesting--;
          if (nesting === 0) return ltIdx;
        }
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

      const fragment = xmlStr.slice(ltIdx + 1, gtIdx);
      const spIdx = fragment.search(/[\s/]/);
      const name = spIdx === -1 ? fragment : fragment.slice(0, spIdx);

      if (name === tagName && !isSelfClosing) {
        nesting++;
      }

      pos = gtIdx + 1;
    }

    return -1;
  }

  /**
   * Given the inner content of an mc:AlternateContent block, determine
   * which branch (Choice or Fallback) to use and return the element
   * tags found in that branch.
   */
  private static scanAlternateContentBranch(acInner: string): string[] {
    const choiceRegex = /<mc:Choice\b([^>]*)>/g;
    let choiceMatch: RegExpExecArray | null;

    while ((choiceMatch = choiceRegex.exec(acInner)) !== null) {
      const attrs = choiceMatch[1];
      const requiresMatch = /Requires\s*=\s*"([^"]*)"/.exec(attrs);
      const requires = requiresMatch ? requiresMatch[1] : "";

      const choiceBodyStart = choiceMatch.index + choiceMatch[0].length;
      const choiceEnd = PptxHandlerRuntime.findClosingTag(
        acInner,
        "mc:Choice",
        choiceBodyStart,
      );
      if (choiceEnd === -1) continue;

      if (areNamespacesSupported(requires)) {
        const branchContent = acInner.slice(choiceBodyStart, choiceEnd);
        return PptxHandlerRuntime.extractElementTagsFromBranch(branchContent);
      }
    }

    // Fall back to mc:Fallback
    const fallbackMatch = /<mc:Fallback\b[^>]*>/.exec(acInner);
    if (fallbackMatch) {
      const fallbackBodyStart =
        fallbackMatch.index + fallbackMatch[0].length;
      const fallbackEnd = PptxHandlerRuntime.findClosingTag(
        acInner,
        "mc:Fallback",
        fallbackBodyStart,
      );
      if (fallbackEnd !== -1) {
        const branchContent = acInner.slice(fallbackBodyStart, fallbackEnd);
        return PptxHandlerRuntime.extractElementTagsFromBranch(branchContent);
      }
    }

    return [];
  }

  /**
   * Extract direct child element tag names from a branch content string.
   * Only looks at depth-0 children that match known element tags.
   */
  private static extractElementTagsFromBranch(
    branchContent: string,
  ): string[] {
    const tags: string[] = [];
    let pos = 0;
    let depth = 0;

    while (pos < branchContent.length) {
      const ltIdx = branchContent.indexOf("<", pos);
      if (ltIdx === -1) break;

      if (branchContent[ltIdx + 1] === "/") {
        const closeEnd = branchContent.indexOf(">", ltIdx + 2);
        if (closeEnd === -1) break;
        if (depth > 0) depth--;
        pos = closeEnd + 1;
        continue;
      }

      if (
        branchContent[ltIdx + 1] === "!" ||
        branchContent[ltIdx + 1] === "?"
      ) {
        const skipEnd = branchContent.indexOf(">", ltIdx + 2);
        pos = skipEnd === -1 ? branchContent.length : skipEnd + 1;
        continue;
      }

      const gtIdx = branchContent.indexOf(">", ltIdx + 1);
      if (gtIdx === -1) break;
      const isSelfClosing = branchContent[gtIdx - 1] === "/";

      const fragment = branchContent.slice(ltIdx + 1, gtIdx);
      const spIdx = fragment.search(/[\s/]/);
      const tag = spIdx === -1 ? fragment : fragment.slice(0, spIdx);

      if (depth === 0 && PptxHandlerRuntime.ELEMENT_TAGS.has(tag)) {
        tags.push(tag);
      }

      if (!isSelfClosing) depth++;
      pos = gtIdx + 1;
    }

    return tags;
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
      "p16:model3D",
      ...VML_SHAPE_TAGS,
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
      case "p16:model3D":
        return this.parseModel3DElement(
          node,
          `${idPrefix}model3d-${indexInType}`,
          slidePath,
        );
      default:
        // Handle VML legacy shape tags
        if (VML_SHAPE_TAGS.has(tag)) {
          return parseVmlElement(
            tag,
            node as XmlObject,
            idPrefix,
            indexInType,
          );
        }
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
   * Delegates to the standalone alternate-content utility.
   */
  protected unwrapAlternateContent(container: Record<string, unknown>): void {
    unwrapAC(container);
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
