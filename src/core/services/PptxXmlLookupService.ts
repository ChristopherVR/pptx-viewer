import type { XmlObject } from "../types";

export interface IPptxXmlLookupService {
  getChildByLocalName(
    parent: XmlObject | undefined,
    localName: string,
  ): XmlObject | undefined;
  getChildrenArrayByLocalName(
    parent: XmlObject | undefined,
    localName: string,
  ): XmlObject[];
  getScalarChildByLocalName(
    parent: XmlObject | undefined,
    localName: string,
  ): string | undefined;
}

export class PptxXmlLookupService implements IPptxXmlLookupService {
  public getChildByLocalName(
    parent: XmlObject | undefined,
    localName: string,
  ): XmlObject | undefined {
    if (!parent) return undefined;
    const direct = parent[localName];
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct as XmlObject;
    }

    const suffix = `:${localName}`;
    const matchingKey = Object.keys(parent).find((key) => key.endsWith(suffix));
    if (!matchingKey) return undefined;

    const value = parent[matchingKey];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as XmlObject;
  }

  public getChildrenArrayByLocalName(
    parent: XmlObject | undefined,
    localName: string,
  ): XmlObject[] {
    if (!parent) return [];

    const direct = parent[localName];
    if (direct !== undefined) {
      return this.toXmlArray(direct);
    }

    const suffix = `:${localName}`;
    const matchingKey = Object.keys(parent).find((key) => key.endsWith(suffix));
    if (!matchingKey) return [];

    return this.toXmlArray(parent[matchingKey]);
  }

  public getScalarChildByLocalName(
    parent: XmlObject | undefined,
    localName: string,
  ): string | undefined {
    if (!parent) return undefined;

    const direct = parent[localName];
    if (typeof direct === "string" || typeof direct === "number") {
      return String(direct);
    }

    const suffix = `:${localName}`;
    for (const [key, value] of Object.entries(parent)) {
      if (key !== localName && !key.endsWith(suffix)) continue;
      if (typeof value === "string" || typeof value === "number") {
        return String(value);
      }
    }
    return undefined;
  }

  private toXmlArray(value: unknown): XmlObject[] {
    if (Array.isArray(value)) {
      return value.filter((entry): entry is XmlObject =>
        this.isXmlObject(entry),
      );
    }
    if (this.isXmlObject(value)) {
      return [value];
    }
    return [];
  }

  private isXmlObject(value: unknown): value is XmlObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
