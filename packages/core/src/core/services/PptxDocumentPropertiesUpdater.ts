import JSZip from "jszip";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

import type {
  PptxAppProperties,
  PptxCoreProperties,
  PptxCustomProperty,
  PptxSlide,
  XmlObject,
} from "../types";

export interface PptxDocumentPropertiesSaveOptions {
  coreProperties?: PptxCoreProperties;
  appProperties?: PptxAppProperties;
  customProperties?: PptxCustomProperty[];
}

export interface PptxDocumentPropertiesUpdaterContext {
  zip: JSZip;
  parser: XMLParser;
  builder: XMLBuilder;
}

export class PptxDocumentPropertiesUpdater {
  private readonly context: PptxDocumentPropertiesUpdaterContext;

  public constructor(context: PptxDocumentPropertiesUpdaterContext) {
    this.context = context;
  }

  public async updateOnSave(
    slides: PptxSlide[],
    options?: PptxDocumentPropertiesSaveOptions,
  ): Promise<void> {
    const nowIso = this.toW3cDate(new Date());

    const coreFile = this.context.zip.file("docProps/core.xml");
    if (coreFile) {
      try {
        const coreXml = await coreFile.async("string");
        const coreData = this.context.parser.parse(coreXml) as XmlObject;
        const coreProps = coreData["cp:coreProperties"] as
          | XmlObject
          | undefined;
        if (coreProps) {
          this.applyCorePropertiesOverrides(coreProps, options?.coreProperties);
          const currentRevisionRaw = this.extractXmlNodeText(
            coreProps["cp:revision"],
          );
          const parsedRevision = Number.parseInt(currentRevisionRaw || "", 10);
          const nextRevision =
            Number.isFinite(parsedRevision) && parsedRevision >= 0
              ? parsedRevision + 1
              : 1;
          coreProps["cp:revision"] = String(nextRevision);

          const modifiedNode = coreProps["dcterms:modified"];
          if (
            modifiedNode &&
            typeof modifiedNode === "object" &&
            !Array.isArray(modifiedNode)
          ) {
            const modified = modifiedNode as XmlObject;
            modified["@_xsi:type"] = "dcterms:W3CDTF";
            modified["#text"] = nowIso;
            coreProps["dcterms:modified"] = modified;
          } else {
            coreProps["dcterms:modified"] = {
              "@_xsi:type": "dcterms:W3CDTF",
              "#text": nowIso,
            };
          }

          const lastModifiedBy = this.extractXmlNodeText(
            coreProps["cp:lastModifiedBy"],
          );
          if (!lastModifiedBy) {
            coreProps["cp:lastModifiedBy"] = "pptx";
          }

          coreData["cp:coreProperties"] = coreProps;
          this.context.zip.file(
            "docProps/core.xml",
            this.context.builder.build(coreData),
          );
        }
      } catch (error) {
        console.warn("Failed to update core document properties:", error);
      }
    }

    const appFile = this.context.zip.file("docProps/app.xml");
    if (!appFile) return;

    try {
      const appXml = await appFile.async("string");
      const appData = this.context.parser.parse(appXml) as XmlObject;
      const appProps = appData["Properties"] as XmlObject | undefined;
      if (!appProps) return;

      this.applyAppPropertiesOverrides(appProps, options?.appProperties);

      const hiddenSlidesCount = slides.filter((slide) => slide.hidden).length;
      const notesCount = slides.filter((slide) => {
        const notes = String(slide.notes || "").trim();
        return notes.length > 0;
      }).length;

      appProps["Slides"] = String(slides.length);
      appProps["HiddenSlides"] = String(hiddenSlidesCount);
      appProps["Notes"] = String(notesCount);

      appData["Properties"] = appProps;
      this.context.zip.file(
        "docProps/app.xml",
        this.context.builder.build(appData),
      );
    } catch (error) {
      console.warn("Failed to update application document properties:", error);
    }

    await this.updateCustomProperties(options?.customProperties);
  }

  private applyCorePropertiesOverrides(
    coreProps: XmlObject,
    overrides: PptxCoreProperties | undefined,
  ): void {
    if (!overrides) return;
    const map: Array<[keyof PptxCoreProperties, string]> = [
      ["title", "dc:title"],
      ["subject", "dc:subject"],
      ["creator", "dc:creator"],
      ["keywords", "cp:keywords"],
      ["description", "dc:description"],
      ["lastModifiedBy", "cp:lastModifiedBy"],
      ["revision", "cp:revision"],
      ["created", "dcterms:created"],
      ["modified", "dcterms:modified"],
      ["category", "cp:category"],
      ["contentStatus", "cp:contentStatus"],
    ];
    for (const [sourceKey, xmlKey] of map) {
      const value = overrides[sourceKey];
      if (value === undefined) continue;
      const text = String(value).trim();
      if (text.length === 0) {
        delete coreProps[xmlKey];
      } else if (xmlKey.startsWith("dcterms:")) {
        coreProps[xmlKey] = {
          "@_xsi:type": "dcterms:W3CDTF",
          "#text": text,
        };
      } else {
        coreProps[xmlKey] = text;
      }
    }
  }

  private applyAppPropertiesOverrides(
    appProps: XmlObject,
    overrides: PptxAppProperties | undefined,
  ): void {
    if (!overrides) return;
    const stringMap: Array<[keyof PptxAppProperties, string]> = [
      ["application", "Application"],
      ["appVersion", "AppVersion"],
      ["presentationFormat", "PresentationFormat"],
      ["company", "Company"],
      ["manager", "Manager"],
      ["template", "Template"],
    ];
    const numberMap: Array<[keyof PptxAppProperties, string]> = [
      ["slides", "Slides"],
      ["hiddenSlides", "HiddenSlides"],
      ["notes", "Notes"],
      ["totalTime", "TotalTime"],
      ["words", "Words"],
      ["paragraphs", "Paragraphs"],
    ];
    for (const [sourceKey, xmlKey] of stringMap) {
      const value = overrides[sourceKey];
      if (value === undefined) continue;
      const text = String(value).trim();
      if (text.length === 0) {
        delete appProps[xmlKey];
      } else {
        appProps[xmlKey] = text;
      }
    }
    for (const [sourceKey, xmlKey] of numberMap) {
      const value = overrides[sourceKey];
      if (value === undefined) continue;
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        appProps[xmlKey] = String(Math.trunc(numeric));
      }
    }
  }

  private async updateCustomProperties(
    customProperties: PptxCustomProperty[] | undefined,
  ): Promise<void> {
    if (!customProperties) return;
    const sanitized = customProperties
      .filter((entry) => entry.name.trim().length > 0)
      .map((entry, index) => ({
        ...entry,
        pid: index + 2,
      }));
    if (sanitized.length === 0) {
      this.context.zip.remove("docProps/custom.xml");
      return;
    }
    const customXml: XmlObject = {
      Properties: {
        "@_xmlns":
          "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties",
        "@_xmlns:vt":
          "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes",
        property: sanitized.map((entry) => {
          const vtType = this.normalizeCustomPropertyType(entry.type);
          const propertyNode: XmlObject = {
            "@_fmtid": "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}",
            "@_pid": String(entry.pid),
            "@_name": entry.name,
          };
          propertyNode[`vt:${vtType}`] = String(entry.value ?? "");
          return propertyNode;
        }),
      },
    };
    this.context.zip.file(
      "docProps/custom.xml",
      this.context.builder.build(customXml),
    );
  }

  private normalizeCustomPropertyType(type: string | undefined): string {
    const supportedTypes = new Set([
      "lpwstr",
      "i4",
      "bool",
      "filetime",
      "r8",
      "i2",
      "ui4",
      "lpstr",
    ]);
    const normalized = String(type || "lpwstr")
      .trim()
      .toLowerCase();
    return supportedTypes.has(normalized) ? normalized : "lpwstr";
  }

  private extractXmlNodeText(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value === "object") {
      const candidate = (value as XmlObject)["#text"];
      if (candidate === undefined || candidate === null) return undefined;
      const trimmed = String(candidate).trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  }

  private toW3cDate(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, "Z");
  }
}
