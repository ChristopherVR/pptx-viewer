import type { XmlObject, PptxCustomXmlPart } from "../../types";
import type { PptxSaveFormat } from "../types";

export interface PptxContentTypesSlideMediaBuildInput {
  contentTypesData: XmlObject;
  slidePaths: string[];
  usedMediaPaths: Set<string>;
  slideContentType: string;
}

export interface PptxContentTypesCommentBuildInput {
  contentTypesData: XmlObject;
  activeCommentPaths: Set<string>;
  hasCommentAuthors: boolean;
  commentContentType: string;
  commentAuthorContentType: string;
  commentAuthorsPartName: string;
}

export interface PptxContentTypesCustomXmlBuildInput {
  contentTypesData: XmlObject;
  customXmlParts: PptxCustomXmlPart[];
}

export interface IPptxContentTypesBuilder {
  applySlideAndMediaUpdates(
    init: PptxContentTypesSlideMediaBuildInput,
  ): XmlObject;
  applyCommentUpdates(init: PptxContentTypesCommentBuildInput): XmlObject;
  applyCustomXmlUpdates(init: PptxContentTypesCustomXmlBuildInput): void;
  applyOutputFormatOverride(
    contentTypesData: XmlObject,
    format: PptxSaveFormat,
    hasVba: boolean,
  ): void;
}

export class PptxContentTypesBuilder implements IPptxContentTypesBuilder {
  private readonly mimeByExtension: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
    svg: "image/svg+xml",
    emf: "image/x-emf",
    wmf: "image/x-wmf",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    ogv: "video/ogg",
    avi: "video/x-msvideo",
    wmv: "video/x-ms-wmv",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    wma: "audio/x-ms-wma",
    flac: "audio/flac",
  };

  public applySlideAndMediaUpdates(
    init: PptxContentTypesSlideMediaBuildInput,
  ): XmlObject {
    const typesRoot = this.ensureTypesRoot(init.contentTypesData);
    const defaults = this.ensureArray(typesRoot["Default"]);
    const overrides = this.ensureArray(typesRoot["Override"]);

    const activeSlidePartNames = new Set<string>(
      init.slidePaths.map((slidePath) =>
        this.normalizePartName(
          slidePath.startsWith("/") ? slidePath.substring(1) : slidePath,
        ),
      ),
    );
    const filteredOverrides = overrides.filter((entry) => {
      if (entry?.["@_ContentType"] !== init.slideContentType) return true;
      const partName = entry?.["@_PartName"];
      if (typeof partName !== "string") return false;
      return activeSlidePartNames.has(this.normalizePartName(partName));
    });

    const existingSlideOverrides = new Set<string>();
    for (const entry of filteredOverrides) {
      if (entry?.["@_ContentType"] !== init.slideContentType) continue;
      const partName = entry?.["@_PartName"];
      if (typeof partName !== "string") continue;
      existingSlideOverrides.add(this.normalizePartName(partName));
    }
    for (const partName of activeSlidePartNames) {
      if (existingSlideOverrides.has(partName)) continue;
      filteredOverrides.push({
        "@_PartName": partName,
        "@_ContentType": init.slideContentType,
      });
    }

    this.applyMediaDefaults(defaults, init.usedMediaPaths);
    typesRoot["Default"] = defaults;
    typesRoot["Override"] = filteredOverrides;
    init.contentTypesData["Types"] = typesRoot;
    return init.contentTypesData;
  }

  public applyCommentUpdates(
    init: PptxContentTypesCommentBuildInput,
  ): XmlObject {
    const typesRoot = this.ensureTypesRoot(init.contentTypesData);
    const defaults = this.ensureArray(typesRoot["Default"]);
    const overrides = this.ensureArray(typesRoot["Override"]);
    const activeCommentPartNames = new Set<string>(
      Array.from(init.activeCommentPaths).map((commentPath) =>
        this.normalizePartName(commentPath),
      ),
    );

    const filteredOverrides = overrides.filter((entry) => {
      const entryType = String(entry?.["@_ContentType"] || "");
      const rawPartName = entry?.["@_PartName"];
      const entryPartName =
        typeof rawPartName === "string"
          ? this.normalizePartName(rawPartName)
          : undefined;
      if (!entryPartName) return true;

      if (entryType === init.commentContentType) {
        return activeCommentPartNames.has(entryPartName);
      }
      if (entryType === init.commentAuthorContentType) {
        return (
          init.hasCommentAuthors &&
          entryPartName === init.commentAuthorsPartName
        );
      }
      return true;
    });

    const existingCommentOverrides = new Set<string>();
    let hasCommentAuthorsOverride = false;
    for (const entry of filteredOverrides) {
      const entryType = String(entry?.["@_ContentType"] || "");
      const rawPartName = entry?.["@_PartName"];
      if (typeof rawPartName !== "string") continue;
      const entryPartName = this.normalizePartName(rawPartName);
      if (entryType === init.commentContentType) {
        existingCommentOverrides.add(entryPartName);
      }
      if (
        entryType === init.commentAuthorContentType &&
        entryPartName === init.commentAuthorsPartName
      ) {
        hasCommentAuthorsOverride = true;
      }
    }

    for (const partName of activeCommentPartNames) {
      if (existingCommentOverrides.has(partName)) continue;
      filteredOverrides.push({
        "@_PartName": partName,
        "@_ContentType": init.commentContentType,
      });
    }
    if (init.hasCommentAuthors && !hasCommentAuthorsOverride) {
      filteredOverrides.push({
        "@_PartName": init.commentAuthorsPartName,
        "@_ContentType": init.commentAuthorContentType,
      });
    }

    typesRoot["Default"] = defaults;
    typesRoot["Override"] = filteredOverrides;
    init.contentTypesData["Types"] = typesRoot;
    return init.contentTypesData;
  }

  private applyMediaDefaults(
    defaults: XmlObject[],
    usedMediaPaths: Set<string>,
  ): void {
    const existingDefaults = new Set<string>();
    for (const entry of defaults) {
      const extension = entry?.["@_Extension"];
      if (typeof extension === "string") {
        existingDefaults.add(extension.toLowerCase());
      }
    }

    for (const mediaPath of usedMediaPaths) {
      const extension = mediaPath.split(".").pop()?.toLowerCase();
      if (!extension || existingDefaults.has(extension)) continue;
      const mime = this.mimeByExtension[extension];
      if (!mime) continue;
      defaults.push({
        "@_Extension": extension,
        "@_ContentType": mime,
      });
      existingDefaults.add(extension);
    }
  }

  private ensureTypesRoot(contentTypesData: XmlObject): XmlObject {
    return (contentTypesData["Types"] || {}) as XmlObject;
  }

  private ensureArray(value: unknown): XmlObject[] {
    if (Array.isArray(value)) return value as XmlObject[];
    if (value === undefined || value === null) return [];
    return [value as XmlObject];
  }

  private normalizePartName(partName: string): string {
    return partName.startsWith("/") ? partName : `/${partName}`;
  }

  /** Standard content type for custom XML item data parts. */
  private static readonly CUSTOM_XML_CONTENT_TYPE =
    "application/vnd.openxmlformats-officedocument.customXmlProperties+xml";

  /**
   * Ensure `[Content_Types].xml` contains Override entries for each
   * custom XML properties part (`customXml/itemProps{id}.xml`).
   *
   * The custom XML item files themselves are covered by a Default
   * extension entry for `.xml`, so only the itemProps overrides need
   * explicit registration.
   */
  public applyCustomXmlUpdates(
    init: PptxContentTypesCustomXmlBuildInput,
  ): void {
    if (init.customXmlParts.length === 0) return;

    const typesRoot = this.ensureTypesRoot(init.contentTypesData);
    const overrides = this.ensureArray(typesRoot["Override"]);

    const existingOverrides = new Set<string>();
    for (const entry of overrides) {
      const partName = entry?.["@_PartName"];
      if (typeof partName === "string") {
        existingOverrides.add(this.normalizePartName(partName));
      }
    }

    for (const part of init.customXmlParts) {
      if (!part.properties) continue;
      const partName = this.normalizePartName(
        `customXml/itemProps${part.id}.xml`,
      );
      if (existingOverrides.has(partName)) continue;
      overrides.push({
        "@_PartName": partName,
        "@_ContentType":
          PptxContentTypesBuilder.CUSTOM_XML_CONTENT_TYPE,
      });
      existingOverrides.add(partName);
    }

    typesRoot["Override"] = overrides;
    init.contentTypesData["Types"] = typesRoot;
  }

  /** Content type for the main presentation part keyed by output format. */
  private static readonly PRESENTATION_CONTENT_TYPES: Record<
    PptxSaveFormat,
    string
  > = {
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
    ppsx: "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml",
    pptm: "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml",
  };

  private static readonly VBA_PROJECT_CONTENT_TYPE =
    "application/vnd.ms-office.vbaProject";

  /**
   * Rewrite the main presentation content type for the chosen output format.
   * For PPTM, also ensures a vbaProject.bin content type override exists.
   */
  public applyOutputFormatOverride(
    contentTypesData: XmlObject,
    format: PptxSaveFormat,
    hasVba: boolean,
  ): void {
    if (format === "pptx") return;

    const typesRoot = this.ensureTypesRoot(contentTypesData);
    const overrides = this.ensureArray(typesRoot["Override"]);
    const targetContentType =
      PptxContentTypesBuilder.PRESENTATION_CONTENT_TYPES[format];

    // Replace the main presentation part content type
    for (const entry of overrides) {
      const partName = String(entry?.["@_PartName"] || "");
      const normalised = this.normalizePartName(partName);
      if (normalised === "/ppt/presentation.xml") {
        entry["@_ContentType"] = targetContentType;
        break;
      }
    }

    // For PPTM, ensure vbaProject.bin has a content type override
    if (format === "pptm" && hasVba) {
      const vbaPartName = "/ppt/vbaProject.bin";
      const hasVbaOverride = overrides.some((entry) => {
        const pn = String(entry?.["@_PartName"] || "");
        return this.normalizePartName(pn) === vbaPartName;
      });
      if (!hasVbaOverride) {
        overrides.push({
          "@_PartName": vbaPartName,
          "@_ContentType": PptxContentTypesBuilder.VBA_PROJECT_CONTENT_TYPE,
        });
      }
    }

    typesRoot["Override"] = overrides;
    contentTypesData["Types"] = typesRoot;
  }
}
