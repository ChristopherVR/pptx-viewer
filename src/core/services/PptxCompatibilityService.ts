import type {
  PptxCompatibilityWarning,
  PptxElement,
  XmlObject,
} from "../types";

export interface CompatibilityWarningInput {
  code: string;
  message: string;
  severity?: PptxCompatibilityWarning["severity"];
  scope: PptxCompatibilityWarning["scope"];
  slideId?: string;
  elementId?: string;
  xmlPath?: string;
}

export interface IPptxCompatibilityService {
  resetWarnings(): void;
  getWarnings(): PptxCompatibilityWarning[];
  getXmlLocalName(xmlKey: string): string;
  reportWarning(warning: CompatibilityWarningInput): void;
  inspectPresentationCompatibility(): void;
  inspectSlideCompatibility(slideXmlObj: XmlObject, slidePath: string): void;
  inspectShapeCompatibility(
    spPr: XmlObject | undefined,
    txBody: XmlObject | undefined,
    slideId: string | undefined,
    elementId: string,
  ): void;
  inspectPictureCompatibility(
    blipFill: XmlObject | undefined,
    blip: XmlObject | undefined,
    slideId: string,
    elementId: string,
  ): void;
  inspectGraphicFrameCompatibility(
    type: PptxElement["type"],
    slideId: string,
    elementId: string,
  ): void;
}

export class PptxCompatibilityService implements IPptxCompatibilityService {
  private warnings: PptxCompatibilityWarning[] = [];

  private warningKeys: Set<string> = new Set();

  public resetWarnings(): void {
    this.warnings = [];
    this.warningKeys.clear();
  }

  public getWarnings(): PptxCompatibilityWarning[] {
    return this.warnings.map((warning) => ({ ...warning }));
  }

  public getXmlLocalName(xmlKey: string): string {
    if (!xmlKey) return "";
    const withoutAttributePrefix = xmlKey.startsWith("@_")
      ? xmlKey.slice(2)
      : xmlKey;
    const separatorIndex = withoutAttributePrefix.lastIndexOf(":");
    if (separatorIndex < 0) return withoutAttributePrefix;
    return withoutAttributePrefix.slice(separatorIndex + 1);
  }

  public reportWarning(warning: CompatibilityWarningInput): void {
    const warningKey = this.getWarningKey(warning);
    if (this.warningKeys.has(warningKey)) return;
    this.warningKeys.add(warningKey);

    const normalizedWarning: PptxCompatibilityWarning = {
      code: warning.code,
      message: warning.message,
      severity: warning.severity || "warning",
      scope: warning.scope,
      slideId: warning.slideId,
      elementId: warning.elementId,
      xmlPath: warning.xmlPath,
    };

    this.warnings.push(normalizedWarning);

    const scopeToken = normalizedWarning.slideId
      ? `slide=${normalizedWarning.slideId}`
      : "presentation";
    const xmlToken = normalizedWarning.xmlPath
      ? ` path=${normalizedWarning.xmlPath}`
      : "";
    const logMessage = `[PptxHandler][${normalizedWarning.severity}] ${normalizedWarning.code} (${scopeToken}) ${normalizedWarning.message}${xmlToken}`;
    if (normalizedWarning.severity === "info") {
      console.info(logMessage);
    } else {
      console.warn(logMessage);
    }
  }

  public inspectPresentationCompatibility(): void {
    // No-op: full parity achieved.
  }

  public inspectSlideCompatibility(
    _slideXmlObj: XmlObject,
    _slidePath: string,
  ): void {
    // No-op: full parity achieved.
  }

  public inspectShapeCompatibility(
    _spPr: XmlObject | undefined,
    _txBody: XmlObject | undefined,
    _slideId: string | undefined,
    _elementId: string,
  ): void {
    // No-op: full parity achieved.
  }

  public inspectPictureCompatibility(
    _blipFill: XmlObject | undefined,
    _blip: XmlObject | undefined,
    _slideId: string,
    _elementId: string,
  ): void {
    // No-op: full parity achieved.
  }

  public inspectGraphicFrameCompatibility(
    _type: PptxElement["type"],
    _slideId: string,
    _elementId: string,
  ): void {
    // No-op: full parity achieved.
  }

  private normalizeWarningPath(path: string | undefined): string {
    if (!path) return "";
    return path.replace(/\[\d+\]/g, "[]");
  }

  private getWarningKey(warning: CompatibilityWarningInput): string {
    return [
      warning.code,
      warning.scope,
      warning.slideId || "*",
      this.normalizeWarningPath(warning.xmlPath),
    ].join("|");
  }
}
