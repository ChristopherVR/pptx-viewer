import { XmlObject, TextSegment, TextStyle, PptxElement } from "../../types";

import type { ConnectorTextResult } from "../builders/PptxConnectorParser";
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeGroupParsing";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Parse text body from a connector shape (p:cxnSp > p:txBody).
   * Uses the same text run extraction logic as regular shapes but
   * without placeholder inheritance (connectors don't have placeholders).
   */
  protected parseConnectorTextBody(
    txBody: XmlObject | undefined,
    slidePath?: string,
  ): ConnectorTextResult | null {
    if (!txBody) return null;
    const paras = this.ensureArray(txBody["a:p"]);
    if (paras.length === 0) return null;

    const slideRelationshipMap = slidePath
      ? this.slideRelsMap.get(slidePath)
      : undefined;

    const textStyle: TextStyle = {};
    const textSegments: TextSegment[] = [];
    const textParts: string[] = [];
    let didSeedPrimaryTextStyle = false;

    const bodyPr = txBody["a:bodyPr"] as XmlObject | undefined;
    const verticalAlign = this.textVerticalAlignFromDrawingValue(
      bodyPr?.["@_anchor"],
    );
    if (verticalAlign) textStyle.vAlign = verticalAlign;
    if (!textStyle.align) textStyle.align = "center";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paras.forEach((p: any, pIdx: number) => {
      const pPr = p["a:pPr"] as XmlObject | undefined;
      let paraAlign: TextStyle["align"] = "center";
      if (pPr?.["@_algn"]) {
        const alignMap: Record<string, TextStyle["align"]> = {
          l: "left",
          ctr: "center",
          r: "right",
          just: "justify",
          justify: "justify",
        };
        paraAlign = alignMap[pPr["@_algn"]] || "center";
        if (!textStyle.align) textStyle.align = paraAlign;
      }

      const defaultRunStyle = this.extractTextRunStyle(
        pPr?.["a:defRPr"],
        paraAlign,
        slideRelationshipMap,
      );
      const mergedDefaultRunStyle = { ...defaultRunStyle } as TextStyle;

      const appendRun = (
        runText: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runProps: any,
      ) => {
        const runStyle = {
          ...mergedDefaultRunStyle,
          ...this.extractTextRunStyle(
            runProps as XmlObject | undefined,
            paraAlign,
            slideRelationshipMap,
          ),
        } as TextStyle;

        textParts.push(runText);
        textSegments.push({ text: runText, style: runStyle });

        if (!didSeedPrimaryTextStyle) {
          Object.assign(textStyle, runStyle);
          didSeedPrimaryTextStyle = true;
        }
      };

      const runs = this.ensureArray(p["a:r"]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runs.forEach((r: any) => {
        if (!r) return;
        const runText =
          typeof r["a:t"] === "string"
            ? r["a:t"]
            : r["a:t"] !== undefined
              ? String(r["a:t"])
              : "";
        appendRun(runText, r["a:rPr"]);
      });

      if (p["a:t"] !== undefined) {
        const directText =
          typeof p["a:t"] === "string" ? p["a:t"] : String(p["a:t"]);
        appendRun(directText, p["a:rPr"]);
      }

      if (pIdx < paras.length - 1) {
        textParts.push("\n");
        textSegments.push({
          text: "\n",
          style: { ...mergedDefaultRunStyle },
        });
      }
    });

    const text = textParts.join("");
    if (text.trim().length === 0) return null;

    return { text, textStyle, textSegments };
  }

  protected async parseSlide(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slideXml: any,
    slidePath: string,
  ): Promise<PptxElement[]> {
    const spTree = slideXml["p:sld"]?.["p:cSld"]?.["p:spTree"];
    if (!spTree) return [];

    this.unwrapAlternateContent(spTree as Record<string, unknown>);

    let rawXmlStr: string | undefined;
    try {
      rawXmlStr =
        (await this.zip.file(slidePath)?.async("string")) ?? undefined;
    } catch {
      // Non-critical — will fall back to type-grouped order
    }

    return this.parseSpTreeChildren(
      spTree as Record<string, unknown>,
      slidePath,
      rawXmlStr,
      "p:spTree",
    );
  }
}
