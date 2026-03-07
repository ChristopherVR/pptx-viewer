import type JSZip from "jszip";

import type { PptxSlide, XmlObject } from "../../types";
import type { IPptxSlideRelationshipRegistry } from "./PptxSlideRelationshipRegistry";
import type { PptxSaveState } from "./PptxSaveSessionBuilder";

export interface PptxSlideBackgroundBuilderInput {
  slideNode: XmlObject;
  slide: PptxSlide;
  zip: JSZip;
  saveState: PptxSaveState;
  relationshipRegistry: IPptxSlideRelationshipRegistry;
  slideImageRelationshipType: string;
  parseDataUrlToBytes: (
    dataUrl: string,
  ) => { bytes: Uint8Array; extension: string } | null;
}

export interface IPptxSlideBackgroundBuilder {
  applyBackground(init: PptxSlideBackgroundBuilderInput): void;
}

export class PptxSlideBackgroundBuilder implements IPptxSlideBackgroundBuilder {
  public applyBackground(init: PptxSlideBackgroundBuilderInput): void {
    const hasBackgroundColor =
      typeof init.slide.backgroundColor === "string" &&
      init.slide.backgroundColor.length > 0 &&
      init.slide.backgroundColor !== "transparent";
    const hasBackgroundImage =
      typeof init.slide.backgroundImage === "string" &&
      init.slide.backgroundImage.length > 0;
    const hasBackgroundGradient =
      typeof init.slide.backgroundGradient === "string" &&
      init.slide.backgroundGradient.length > 0;

    const cSld = (init.slideNode["p:cSld"] || {}) as XmlObject;
    if (!(hasBackgroundColor || hasBackgroundImage || hasBackgroundGradient)) {
      delete cSld["p:bg"];
      init.slideNode["p:cSld"] = cSld;
      return;
    }

    const backgroundProperties: XmlObject = {};
    if (hasBackgroundImage && init.slide.backgroundImage) {
      const parsedBackgroundImage = init.parseDataUrlToBytes(
        init.slide.backgroundImage,
      );
      if (parsedBackgroundImage) {
        const backgroundImagePath = init.saveState.nextMediaPath(
          parsedBackgroundImage.extension,
        );
        init.zip.file(backgroundImagePath, parsedBackgroundImage.bytes);
        const backgroundRelationshipId =
          init.relationshipRegistry.nextRelationshipId();
        const relativeBackgroundImagePath = backgroundImagePath.replace(
          /^ppt\//,
          "../",
        );
        init.relationshipRegistry.upsertRelationship(
          backgroundRelationshipId,
          init.slideImageRelationshipType,
          relativeBackgroundImagePath,
        );
        backgroundProperties["a:blipFill"] = {
          "a:blip": { "@_r:embed": backgroundRelationshipId },
          "a:stretch": { "a:fillRect": {} },
        };
      }
    } else if (hasBackgroundColor && init.slide.backgroundColor) {
      backgroundProperties["a:solidFill"] = {
        "a:srgbClr": {
          "@_val": init.slide.backgroundColor.replace("#", "").toUpperCase(),
        },
      };
    }
    backgroundProperties["a:effectLst"] = {};
    cSld["p:bg"] = { "p:bgPr": backgroundProperties };
    init.slideNode["p:cSld"] = cSld;
  }
}
