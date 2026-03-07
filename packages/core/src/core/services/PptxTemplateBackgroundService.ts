import type { XmlObject } from "../types";

export interface PptxTemplateBackgroundState {
  layoutXmlMap: Map<string, XmlObject>;
  masterXmlMap: Map<string, XmlObject>;
}

export interface IPptxTemplateBackgroundService {
  setBackground(
    state: PptxTemplateBackgroundState,
    path: string,
    backgroundColor: string | undefined,
  ): void;
  getBackgroundColor(
    state: PptxTemplateBackgroundState,
    path: string,
    extractBackgroundColor: (
      xmlObj: XmlObject,
      rootTag?: string,
    ) => string | undefined,
  ): string | undefined;
}

interface TemplatePartContext {
  xmlMap: Map<string, XmlObject>;
  rootTag: "p:sldLayout" | "p:sldMaster";
}

export class PptxTemplateBackgroundService implements IPptxTemplateBackgroundService {
  public setBackground(
    state: PptxTemplateBackgroundState,
    path: string,
    backgroundColor: string | undefined,
  ): void {
    const partContext = this.resolvePartContext(state, path);
    if (!partContext) return;

    const xmlObj = partContext.xmlMap.get(path);
    if (!xmlObj) return;

    const rootNode = (xmlObj[partContext.rootTag] || {}) as XmlObject;
    const cSld = (rootNode["p:cSld"] || {}) as XmlObject;

    if (
      backgroundColor &&
      backgroundColor.length > 0 &&
      backgroundColor !== "transparent"
    ) {
      const rawHex = backgroundColor.replace("#", "").toUpperCase();
      cSld["p:bg"] = {
        "p:bgPr": {
          "a:solidFill": { "a:srgbClr": { "@_val": rawHex } },
          "a:effectLst": {},
        },
      };
    } else {
      delete cSld["p:bg"];
    }

    rootNode["p:cSld"] = cSld;
    xmlObj[partContext.rootTag] = rootNode;
  }

  public getBackgroundColor(
    state: PptxTemplateBackgroundState,
    path: string,
    extractBackgroundColor: (
      xmlObj: XmlObject,
      rootTag?: string,
    ) => string | undefined,
  ): string | undefined {
    const partContext = this.resolvePartContext(state, path);
    if (!partContext) return undefined;

    const xmlObj = partContext.xmlMap.get(path);
    if (!xmlObj) return undefined;

    return extractBackgroundColor(xmlObj, partContext.rootTag);
  }

  private resolvePartContext(
    state: PptxTemplateBackgroundState,
    path: string,
  ): TemplatePartContext | undefined {
    const isLayout = path.includes("slideLayout");
    const isMaster = path.includes("slideMaster");
    if (!isLayout && !isMaster) return undefined;

    if (isLayout) {
      return {
        xmlMap: state.layoutXmlMap,
        rootTag: "p:sldLayout",
      };
    }

    return {
      xmlMap: state.masterXmlMap,
      rootTag: "p:sldMaster",
    };
  }
}
