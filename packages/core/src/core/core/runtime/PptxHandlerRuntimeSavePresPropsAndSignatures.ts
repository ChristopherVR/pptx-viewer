import { XmlObject, type PptxPresentationProperties } from "../../types";
import {
  getSignaturePathsToStrip,
  DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
} from "../../utils/signature-detection";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveDocumentParts";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  protected async applyPresentationPropertiesPart(
    properties: PptxPresentationProperties | undefined,
  ): Promise<void> {
    if (!properties) return;

    const relsXml = await this.zip
      .file("ppt/_rels/presentation.xml.rels")
      ?.async("string");
    let propsPath = "ppt/presProps.xml";
    if (relsXml) {
      try {
        const relsData = this.parser.parse(relsXml) as XmlObject;
        const relNodes = this.ensureArray(
          relsData?.Relationships?.Relationship,
        ) as XmlObject[];
        const relNode = relNodes.find((node) => {
          const relType = String(node?.["@_Type"] || "");
          const relTarget = String(node?.["@_Target"] || "");
          return (
            relType.includes("presProps") || relTarget.includes("presProps")
          );
        });
        if (relNode) {
          const target = String(relNode["@_Target"] || "").trim();
          if (target.length > 0) {
            propsPath = target.startsWith("/")
              ? target.slice(1)
              : `ppt/${target}`;
          }
        }
      } catch {
        // Fall back to default part path when relationship parsing fails.
      }
    }

    const existingPropsXml = await this.zip.file(propsPath)?.async("string");
    const propsData = existingPropsXml
      ? (this.parser.parse(existingPropsXml) as XmlObject)
      : {
          "p:presentationPr": {
            "@_xmlns:p":
              "http://schemas.openxmlformats.org/presentationml/2006/main",
            "@_xmlns:a":
              "http://schemas.openxmlformats.org/drawingml/2006/main",
          },
        };

    const root = (propsData["p:presentationPr"] || {}) as XmlObject;

    const showPr = (root["p:showPr"] || {}) as XmlObject;
    delete showPr["p:present"];
    delete showPr["p:browse"];
    delete showPr["p:kiosk"];
    if (properties.showType === "browsed") {
      showPr["p:browse"] = {};
    } else if (properties.showType === "kiosk") {
      showPr["p:kiosk"] = {};
    } else {
      showPr["p:present"] = {};
    }
    if (properties.loopContinuously !== undefined) {
      showPr["@_loop"] = properties.loopContinuously ? "1" : "0";
    }
    if (properties.showWithNarration !== undefined) {
      showPr["@_showNarration"] = properties.showWithNarration ? "1" : "0";
    }
    if (properties.showWithAnimation !== undefined) {
      showPr["@_showAnimation"] = properties.showWithAnimation ? "1" : "0";
    }
    if (properties.advanceMode !== undefined) {
      showPr["@_useTimings"] =
        properties.advanceMode === "useTimings" ? "1" : "0";
    }

    // Pen colour
    if (properties.penColor) {
      showPr["p:penClr"] = {
        "a:srgbClr": { "@_val": properties.penColor.replace("#", "") },
      };
    }

    // Slide range / custom show selection
    delete showPr["p:sldRg"];
    delete showPr["p:custShow"];
    if (properties.showSlidesMode === "range") {
      showPr["p:sldRg"] = {
        "@_st": String(properties.showSlidesFrom ?? 1),
        "@_end": String(properties.showSlidesTo ?? 1),
      };
    } else if (
      properties.showSlidesMode === "customShow" &&
      properties.showSlidesCustomShowId
    ) {
      showPr["p:custShow"] = {
        "@_id": properties.showSlidesCustomShowId,
      };
    }
    // 'all' => no child element needed (default)

    root["p:showPr"] = showPr;

    if (
      properties.printFrameSlides !== undefined ||
      properties.printSlidesPerPage !== undefined ||
      properties.printColorMode !== undefined
    ) {
      const prnPr = (root["p:prnPr"] || {}) as XmlObject;
      if (properties.printFrameSlides !== undefined) {
        prnPr["@_frameSlides"] = properties.printFrameSlides ? "1" : "0";
      }
      if (properties.printSlidesPerPage !== undefined) {
        prnPr["@_sldPerPg"] = String(properties.printSlidesPerPage);
      }
      if (properties.printColorMode !== undefined) {
        prnPr["@_clrMode"] = properties.printColorMode;
      }
      root["p:prnPr"] = prnPr;
    }

    if (properties.mruColors && properties.mruColors.length > 0) {
      root["p:clrMru"] = {
        "a:srgbClr": properties.mruColors.map((color) => ({
          "@_val": color.replace("#", ""),
        })),
      };
    }

    // Grid spacing
    if (properties.gridSpacing) {
      root["p:gridSpacing"] = {
        "@_cx": String(properties.gridSpacing.cx),
        "@_cy": String(properties.gridSpacing.cy),
      };
    }

    propsData["p:presentationPr"] = root;
    this.zip.file(propsPath, this.builder.build(propsData));
  }

  /**
   * Strip digital signature parts from the ZIP if the document was signed.
   * Also removes the digital-signature-origin relationship from `_rels/.rels`.
   */
  protected async stripDigitalSignatures(): Promise<void> {
    if (!this.signatureDetection?.hasSignatures) return;

    // Collect all entry paths
    const entryPaths: string[] = [];
    this.zip.forEach((relativePath) => {
      entryPaths.push(relativePath);
    });

    // Remove all _xmlsignatures/ entries
    const pathsToRemove = getSignaturePathsToStrip(entryPaths);
    for (const sigPath of pathsToRemove) {
      this.zip.remove(sigPath);
    }

    // Remove the digital-signature-origin relationship from _rels/.rels
    const relsXml = await this.zip.file("_rels/.rels")?.async("string");
    if (relsXml) {
      const relsData = this.parser.parse(relsXml) as XmlObject;
      const relsRoot = (relsData?.Relationships ?? {}) as XmlObject;
      const relationships = this.ensureArray(
        relsRoot.Relationship,
      ) as XmlObject[];

      const filtered = relationships.filter(
        (rel) =>
          String(rel?.["@_Type"] || "") !== DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
      );

      if (filtered.length !== relationships.length) {
        relsRoot.Relationship = filtered;
        relsData.Relationships = relsRoot;
        this.zip.file("_rels/.rels", this.builder.build(relsData));
      }
    }

    // Remove signature content types from [Content_Types].xml
    const ctXml = await this.zip.file("[Content_Types].xml")?.async("string");
    if (ctXml) {
      const ctData = this.parser.parse(ctXml) as XmlObject;
      const typesRoot = (ctData?.Types ?? {}) as XmlObject;
      const overrides = this.ensureArray(typesRoot.Override) as XmlObject[];

      const filteredOverrides = overrides.filter((o) => {
        const partName = String(o?.["@_PartName"] || "");
        return !partName.startsWith("/_xmlsignatures/");
      });

      if (filteredOverrides.length !== overrides.length) {
        typesRoot.Override = filteredOverrides;
        ctData.Types = typesRoot;
        this.zip.file("[Content_Types].xml", this.builder.build(ctData));
      }
    }

    // Clear the detection result after stripping
    this.signatureDetection = null;
  }
}
