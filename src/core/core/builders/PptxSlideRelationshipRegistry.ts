import type { XmlObject } from "../../types";

export interface PptxSlideCommentRelationshipInfo {
  relationshipId: string;
  target: string;
}

export interface PptxSlideRelationshipRegistryOptions {
  relationships: XmlObject[];
  hyperlinkRelationshipType?: string;
}

export interface IPptxSlideRelationshipRegistry {
  nextRelationshipId(): string;
  upsertRelationship(
    relationshipId: string,
    relationshipType: string,
    relationshipTarget: string,
    targetMode?: string,
  ): void;
  resolveHyperlinkRelationshipId(target: string): string | undefined;
  removeCommentRelationships(
    commentRelationshipType: string,
  ): PptxSlideCommentRelationshipInfo;
  findFirstByTypeOrTargetIncludes(
    relationshipType: string,
    targetIncludes: string,
  ): XmlObject | undefined;
  toRelationshipMap(): Map<string, string>;
}

export class PptxSlideRelationshipRegistry implements IPptxSlideRelationshipRegistry {
  private readonly relationships: XmlObject[];

  private readonly usedRelationshipIds = new Set<string>();

  private readonly hyperlinkRelationshipIdByTarget = new Map<string, string>();

  private readonly hyperlinkRelationshipType: string;

  public constructor(options: PptxSlideRelationshipRegistryOptions) {
    this.relationships = options.relationships;
    this.hyperlinkRelationshipType =
      options.hyperlinkRelationshipType ||
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";
    for (const relationship of this.relationships) {
      const relationshipId = String(relationship?.["@_Id"] || "").trim();
      if (relationshipId.length > 0) {
        this.usedRelationshipIds.add(relationshipId);
      }
    }
  }

  public nextRelationshipId(): string {
    let candidate = 1;
    while (this.usedRelationshipIds.has(`rId${candidate}`)) {
      candidate += 1;
    }
    const relationshipId = `rId${candidate}`;
    this.usedRelationshipIds.add(relationshipId);
    return relationshipId;
  }

  public upsertRelationship(
    relationshipId: string,
    relationshipType: string,
    relationshipTarget: string,
    targetMode?: string,
  ): void {
    const existingRelationship = this.relationships.find(
      (relationship) => relationship?.["@_Id"] === relationshipId,
    );
    if (existingRelationship) {
      existingRelationship["@_Type"] = relationshipType;
      existingRelationship["@_Target"] = relationshipTarget;
      if (targetMode && targetMode.trim().length > 0) {
        existingRelationship["@_TargetMode"] = targetMode;
      } else {
        delete existingRelationship["@_TargetMode"];
      }
      return;
    }

    const relationship: XmlObject = {
      "@_Id": relationshipId,
      "@_Type": relationshipType,
      "@_Target": relationshipTarget,
    };
    if (targetMode && targetMode.trim().length > 0) {
      relationship["@_TargetMode"] = targetMode;
    }
    this.relationships.push(relationship);
  }

  public resolveHyperlinkRelationshipId(target: string): string | undefined {
    const normalizedTarget = String(target || "").trim();
    if (normalizedTarget.length === 0) return undefined;

    const cachedRelationshipId =
      this.hyperlinkRelationshipIdByTarget.get(normalizedTarget);
    if (cachedRelationshipId) {
      return cachedRelationshipId;
    }

    const existingRelationship = this.relationships.find((relationship) => {
      if (relationship?.["@_Type"] !== this.hyperlinkRelationshipType) {
        return false;
      }
      const relationshipTarget = String(
        relationship?.["@_Target"] || "",
      ).trim();
      return relationshipTarget === normalizedTarget;
    });
    const existingRelationshipId = String(
      existingRelationship?.["@_Id"] || "",
    ).trim();
    if (existingRelationshipId.length > 0) {
      this.hyperlinkRelationshipIdByTarget.set(
        normalizedTarget,
        existingRelationshipId,
      );
      return existingRelationshipId;
    }

    const relationshipId = this.nextRelationshipId();
    const targetMode = /^(https?:|mailto:|ftp:|file:)/i.test(normalizedTarget)
      ? "External"
      : undefined;
    this.upsertRelationship(
      relationshipId,
      this.hyperlinkRelationshipType,
      normalizedTarget,
      targetMode,
    );
    this.hyperlinkRelationshipIdByTarget.set(normalizedTarget, relationshipId);
    return relationshipId;
  }

  public removeCommentRelationships(
    commentRelationshipType: string,
  ): PptxSlideCommentRelationshipInfo {
    const commentRelationships = this.relationships.filter((relationship) =>
      this.isCommentRelationship(relationship, commentRelationshipType),
    );
    const retainedRelationships = this.relationships.filter(
      (relationship) =>
        !this.isCommentRelationship(relationship, commentRelationshipType),
    );
    this.relationships.length = 0;
    retainedRelationships.forEach((relationship) => {
      this.relationships.push(relationship);
    });

    return {
      relationshipId: String(commentRelationships[0]?.["@_Id"] || "").trim(),
      target: String(commentRelationships[0]?.["@_Target"] || "").trim(),
    };
  }

  public findFirstByTypeOrTargetIncludes(
    relationshipType: string,
    targetIncludes: string,
  ): XmlObject | undefined {
    const normalizedTargetIncludes = targetIncludes.toLowerCase().trim();
    return this.relationships.find((relationship) => {
      const relationType = String(relationship?.["@_Type"] || "");
      if (relationType === relationshipType) return true;
      const relationTarget = String(relationship?.["@_Target"] || "")
        .toLowerCase()
        .trim();
      return relationTarget.includes(normalizedTargetIncludes);
    });
  }

  public toRelationshipMap(): Map<string, string> {
    const relationshipMap = new Map<string, string>();
    this.relationships.forEach((relationship) => {
      const relationshipId = String(relationship?.["@_Id"] || "").trim();
      if (relationshipId.length === 0) return;
      const relationshipTarget = String(
        relationship?.["@_Target"] || "",
      ).trim();
      if (relationshipTarget.length === 0) return;
      relationshipMap.set(relationshipId, relationshipTarget);
    });
    return relationshipMap;
  }

  private isCommentRelationship(
    relationship: XmlObject,
    commentRelationshipType: string,
  ): boolean {
    const relationType = String(relationship?.["@_Type"] || "");
    if (relationType === commentRelationshipType) return true;
    const relationTarget = String(relationship?.["@_Target"] || "")
      .toLowerCase()
      .trim();
    return relationTarget.includes("comments/comment");
  }
}
