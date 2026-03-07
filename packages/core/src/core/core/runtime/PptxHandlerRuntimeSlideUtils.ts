import { XmlObject, TextSegment } from "../../types";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeBackgroundParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Retrieve the background gradient from a layout, falling back to master.
   */
  protected async getLayoutBackgroundGradient(
    slidePath: string,
  ): Promise<string | undefined> {
    const slideRels = this.slideRelsMap.get(slidePath);
    if (!slideRels) return undefined;

    for (const [, target] of slideRels.entries()) {
      if (target.includes("slideLayout")) {
        const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
        const layoutPath = target.startsWith("..")
          ? this.resolvePath(slideDir, target)
          : "ppt/" + target.replace("../", "");

        try {
          const layoutXmlStr = await this.zip.file(layoutPath)?.async("string");
          if (layoutXmlStr) {
            const layoutXmlObj = this.parser.parse(layoutXmlStr);
            const layoutGrad = this.extractBackgroundGradient(
              layoutXmlObj,
              "p:sldLayout",
            );
            if (layoutGrad) return layoutGrad;

            // Fallback to master
            return this.getMasterBackgroundGradient(layoutPath);
          }
        } catch {
          // Ignore
        }
        break;
      }
    }
    return undefined;
  }

  /**
   * Resolve the slide master's background gradient given a layout path.
   */
  protected async getMasterBackgroundGradient(
    layoutPath: string,
  ): Promise<string | undefined> {
    const layoutRels = this.slideRelsMap.get(layoutPath);
    if (!layoutRels) return undefined;

    for (const [, target] of layoutRels.entries()) {
      if (target.includes("slideMaster")) {
        const layoutDir = layoutPath.substring(
          0,
          layoutPath.lastIndexOf("/") + 1,
        );
        const masterPath = target.startsWith("..")
          ? this.resolvePath(layoutDir, target)
          : "ppt/" + target.replace("../", "");

        try {
          const masterXmlStr = await this.zip.file(masterPath)?.async("string");
          if (masterXmlStr) {
            const masterXmlObj = this.parser.parse(masterXmlStr);
            return this.extractBackgroundGradient(masterXmlObj, "p:sldMaster");
          }
        } catch {
          // Ignore
        }
        break;
      }
    }
    return undefined;
  }

  /**
   * Find the layout file path referenced by a slide via its relationships.
   */
  protected findLayoutPathForSlide(slidePath: string): string | undefined {
    const slideRels = this.slideRelsMap.get(slidePath);
    if (!slideRels) return undefined;
    for (const [, target] of slideRels.entries()) {
      if (target.includes("slideLayout")) {
        const slideDir = slidePath.substring(0, slidePath.lastIndexOf("/") + 1);
        return target.startsWith("..")
          ? this.resolvePath(slideDir, target)
          : "ppt/" + target.replace("../", "");
      }
    }
    return undefined;
  }

  /**
   * Extract the `p:bg/@showAnimation` flag from a slide's XML.
   * Returns `true` when the background should animate, `false` when
   * explicitly disabled, or `undefined` when the attribute is absent
   * (defaults to true per OOXML spec).
   */
  protected extractBackgroundShowAnimation(
    slideXml: XmlObject,
  ): boolean | undefined {
    const sld = slideXml["p:sld"] as XmlObject | undefined;
    const bg = sld?.["p:cSld"]?.["p:bg"] as XmlObject | undefined;
    if (!bg) return undefined;
    const rawVal = bg["@_showAnimation"];
    if (rawVal === undefined) return undefined;
    const normalized = String(rawVal).trim().toLowerCase();
    return normalized !== "0" && normalized !== "false";
  }

  /**
   * Extract the `p:sld/@showMasterSp` flag.
   * Returns `false` when master shapes should be hidden, `true` when
   * explicitly shown, or `undefined` when the attribute is absent
   * (defaults to true per OOXML spec).
   */
  protected extractShowMasterShapes(slideXml: XmlObject): boolean | undefined {
    const sld = slideXml["p:sld"] as XmlObject | undefined;
    if (!sld) return undefined;
    const rawVal = sld["@_showMasterSp"];
    if (rawVal === undefined) return undefined;
    const normalized = String(rawVal).trim().toLowerCase();
    return normalized !== "0" && normalized !== "false";
  }

  protected isSlideHidden(
    slideXmlObj: XmlObject,
    slideIdEntry: XmlObject | undefined,
  ): boolean {
    const slideShowValue = String(
      slideXmlObj?.["p:sld"]?.["@_show"] ?? "",
    ).toLowerCase();
    if (slideShowValue === "0" || slideShowValue === "false") {
      return true;
    }

    const slideIdShowValue = String(
      slideIdEntry?.["@_show"] ?? "",
    ).toLowerCase();
    return slideIdShowValue === "0" || slideIdShowValue === "false";
  }

  protected extractTextFromTxBody(txBody: XmlObject | undefined): string {
    if (!txBody) return "";
    const paragraphs = this.ensureArray(txBody["a:p"]);
    if (paragraphs.length === 0) return "";
    const chunks: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paragraphs.forEach((paragraph: any, paragraphIndex: number) => {
      const runTexts: string[] = [];
      const runs = this.ensureArray(paragraph?.["a:r"]);
      runs.forEach((run) => {
        const value = run?.["a:t"];
        if (typeof value === "string") {
          runTexts.push(value);
        } else if (value !== undefined) {
          runTexts.push(String(value));
        }
      });

      const fields = this.ensureArray(paragraph?.["a:fld"]);
      fields.forEach((field) => {
        const value = field?.["a:t"];
        if (typeof value === "string") {
          runTexts.push(value);
        } else if (value !== undefined) {
          runTexts.push(String(value));
        }
      });

      if (paragraph?.["a:t"] !== undefined) {
        const value = paragraph["a:t"];
        runTexts.push(typeof value === "string" ? value : String(value));
      }

      const lineBreaks = this.ensureArray(paragraph?.["a:br"]);
      if (lineBreaks.length > 0) {
        for (let idx = 0; idx < lineBreaks.length; idx++) {
          runTexts.push("\n");
        }
      }

      chunks.push(runTexts.join(""));
      if (paragraphIndex < paragraphs.length - 1) {
        chunks.push("\n");
      }
    });

    return chunks.join("").trim();
  }

  protected async extractSlideNotes(
    slidePath: string,
  ): Promise<{ notes?: string; notesSegments?: TextSegment[] }> {
    const slideRels = this.slideRelsMap.get(slidePath);
    if (!slideRels) return {};

    let notesPath: string | undefined;
    for (const [, target] of slideRels.entries()) {
      if (!target.includes("notesSlide")) continue;
      notesPath = this.resolveImagePath(slidePath, target);
      break;
    }
    if (!notesPath) return {};

    const notesXml = await this.zip.file(notesPath)?.async("string");
    if (!notesXml) return {};
    const notesObj = this.parser.parse(notesXml) as XmlObject;
    const spTree = notesObj?.["p:notes"]?.["p:cSld"]?.["p:spTree"] as
      | XmlObject
      | undefined;
    if (!spTree) return {};

    const shapes = this.ensureArray(spTree["p:sp"]) as XmlObject[];
    const notesChunks: string[] = [];
    const allSegments: TextSegment[] = [];
    for (const shape of shapes) {
      const txBody = shape?.["p:txBody"] as XmlObject | undefined;
      const text = this.extractTextFromTxBody(txBody);
      if (text.length > 0) {
        notesChunks.push(text);
        const segs = this.extractTextSegmentsFromTxBodyForRewrite(
          txBody,
          undefined,
        );
        if (allSegments.length > 0 && segs.length > 0) {
          // Insert paragraph break between shapes
          allSegments.push({ text: "\n", isParagraphBreak: true, style: {} });
        }
        allSegments.push(...segs);
      }
    }

    const merged = notesChunks.join("\n").trim();
    return {
      notes: merged.length > 0 ? merged : undefined,
      notesSegments: allSegments.length > 0 ? allSegments : undefined,
    };
  }
}
