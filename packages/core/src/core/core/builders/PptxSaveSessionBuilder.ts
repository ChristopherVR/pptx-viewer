import type JSZip from "jszip";
import type { PptxCommentAuthor } from "../../types";

export type PptxSaveMediaKind = "image" | "audio" | "video";

export interface PptxSaveStateConfig {
  zip: JSZip;
  commentAuthorMap: Map<string, string>;
  /** Full author details for round-trip preservation of initials, lastIdx, clrIdx. */
  commentAuthorDetails?: Map<string, PptxCommentAuthor>;
  emuPerPx: number;
}

export interface PptxCommentAuthorDescriptor {
  authorId: string;
  authorName: string;
  initials: string;
  lastCommentIndex: number;
  colorIndex: number;
}

export class PptxSaveState {
  private readonly commentAuthorMap: Map<string, string>;

  /** Original author details loaded from the file, for round-trip preservation. */
  private readonly commentAuthorDetails: Map<string, PptxCommentAuthor>;

  private readonly emuPerPx: number;

  private readonly usedSlideNumbers = new Set<number>();

  private readonly usedMediaPaths = new Set<string>();

  private readonly existingCommentPaths = new Set<string>();

  private readonly activeCommentPaths = new Set<string>();

  private readonly existingAuthorIdByName = new Map<string, string>();

  private readonly usedAuthorIdByName = new Map<string, string>();

  private readonly commentLastIdxByAuthorId = new Map<string, number>();

  private maxCommentPartIndex = 0;

  private maxAuthorId = -1;

  public constructor(config: PptxSaveStateConfig) {
    this.commentAuthorMap = config.commentAuthorMap;
    this.commentAuthorDetails = config.commentAuthorDetails ?? new Map();
    this.emuPerPx = config.emuPerPx;

    this.initializeZipState(config.zip);
    this.initializeCommentAuthorState(config.commentAuthorMap);
  }

  public nextSlideNumber(): number {
    let candidate = 1;
    while (this.usedSlideNumbers.has(candidate)) candidate += 1;
    this.usedSlideNumbers.add(candidate);
    return candidate;
  }

  public nextMediaPath(
    extension: string,
    kind: PptxSaveMediaKind = "image",
  ): string {
    let candidate = 1;
    const baseName =
      kind === "audio" ? "audio" : kind === "video" ? "video" : "image";
    let filePath = `ppt/media/${baseName}${candidate}.${extension}`;
    while (this.usedMediaPaths.has(filePath)) {
      candidate += 1;
      filePath = `ppt/media/${baseName}${candidate}.${extension}`;
    }
    this.usedMediaPaths.add(filePath);
    return filePath;
  }

  public getUsedMediaPaths(): Set<string> {
    return this.usedMediaPaths;
  }

  public nextCommentPath(): string {
    this.maxCommentPartIndex += 1;
    return `ppt/comments/comment${this.maxCommentPartIndex}.xml`;
  }

  public toSlideCommentTarget(commentPath: string): string {
    const normalized = commentPath.startsWith("ppt/")
      ? commentPath.substring(4)
      : commentPath;
    return `../${normalized}`;
  }

  public activateCommentPath(commentPath: string): void {
    this.activeCommentPaths.add(commentPath);
  }

  public isCommentPathActive(commentPath: string): boolean {
    return this.activeCommentPaths.has(commentPath);
  }

  public getExistingCommentPaths(): Set<string> {
    return this.existingCommentPaths;
  }

  public getActiveCommentPaths(): Set<string> {
    return this.activeCommentPaths;
  }

  public toEmu(value: number | undefined, fallback = 0): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.round(value * this.emuPerPx);
  }

  public resolveCommentAuthorId(authorName: string | undefined): string {
    const normalizedName = String(authorName || "User").trim() || "User";
    const existingUsed = this.usedAuthorIdByName.get(normalizedName);
    if (existingUsed) return existingUsed;

    let authorId = this.existingAuthorIdByName.get(normalizedName);
    if (!authorId) {
      this.maxAuthorId += 1;
      authorId = String(Math.max(this.maxAuthorId, 0));
    }

    this.usedAuthorIdByName.set(normalizedName, authorId);
    this.commentAuthorMap.set(authorId, normalizedName);
    return authorId;
  }

  public resolveCommentIndex(
    authorId: string,
    commentId: string | undefined,
    fallbackIndex: number,
  ): number {
    const rawIdx = Number.parseInt(String(commentId || ""), 10);
    const commentIdx = Number.isFinite(rawIdx) ? rawIdx : fallbackIndex;
    const previousMax = this.commentLastIdxByAuthorId.get(authorId) ?? -1;
    this.commentLastIdxByAuthorId.set(
      authorId,
      Math.max(previousMax, commentIdx),
    );
    return commentIdx;
  }

  public hasUsedCommentAuthors(): boolean {
    return this.usedAuthorIdByName.size > 0;
  }

  public getUsedCommentAuthors(): PptxCommentAuthorDescriptor[] {
    return Array.from(this.usedAuthorIdByName.entries())
      .map(([authorName, authorId], index) => {
        // Try to use original author details for round-trip preservation
        const original = this.commentAuthorDetails.get(authorId);
        if (original) {
          return {
            authorId,
            authorName,
            initials: original.initials,
            lastCommentIndex: Math.max(
              original.lastIdx,
              this.commentLastIdxByAuthorId.get(authorId) ?? 0,
            ),
            colorIndex: original.clrIdx,
          };
        }
        // Fallback for newly created authors
        const numericAuthorId = Number.parseInt(authorId, 10);
        const colorIndex = Number.isFinite(numericAuthorId)
          ? Math.max(0, numericAuthorId)
          : index;
        return {
          authorId,
          authorName,
          initials: this.toCommentInitials(authorName),
          lastCommentIndex: this.commentLastIdxByAuthorId.get(authorId) ?? 0,
          colorIndex: colorIndex % 10,
        };
      })
      .sort((left, right) => {
        const leftId = Number.parseInt(String(left.authorId || ""), 10);
        const rightId = Number.parseInt(String(right.authorId || ""), 10);
        if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
          return leftId - rightId;
        }
        return String(left.authorId || "").localeCompare(
          String(right.authorId || ""),
        );
      });
  }

  private initializeZipState(zip: JSZip): void {
    zip.forEach((relativePath) => {
      const slideMatch = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      if (slideMatch) {
        const numericValue = Number.parseInt(slideMatch[1], 10);
        if (Number.isFinite(numericValue)) {
          this.usedSlideNumbers.add(numericValue);
        }
      }

      if (relativePath.startsWith("ppt/media/")) {
        this.usedMediaPaths.add(relativePath);
      }

      const commentMatch = relativePath.match(
        /^ppt\/comments\/comment(\d+)\.xml$/,
      );
      if (!commentMatch) return;

      this.existingCommentPaths.add(relativePath);
      const commentIndex = Number.parseInt(commentMatch[1], 10);
      if (Number.isFinite(commentIndex)) {
        this.maxCommentPartIndex = Math.max(
          this.maxCommentPartIndex,
          commentIndex,
        );
      }
    });
  }

  private initializeCommentAuthorState(
    commentAuthorMap: Map<string, string>,
  ): void {
    for (const [authorId, authorName] of commentAuthorMap.entries()) {
      const normalizedName = authorName.trim();
      if (normalizedName.length === 0) continue;
      if (!this.existingAuthorIdByName.has(normalizedName)) {
        this.existingAuthorIdByName.set(normalizedName, authorId);
      }

      const numericAuthorId = Number.parseInt(authorId, 10);
      if (Number.isFinite(numericAuthorId)) {
        this.maxAuthorId = Math.max(this.maxAuthorId, numericAuthorId);
      }
    }
  }

  private toCommentInitials(authorName: string): string {
    const tokens = authorName
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    if (tokens.length === 0) return "U";

    return tokens
      .slice(0, 2)
      .map((token) => token[0].toUpperCase())
      .join("");
  }
}

export class PptxSaveStateBuilder {
  private zip: JSZip | null = null;

  private commentAuthorMap: Map<string, string> | null = null;

  private _commentAuthorDetails: Map<string, PptxCommentAuthor> | null = null;

  private emuPerPx = 9525;

  public withZip(zip: JSZip): this {
    this.zip = zip;
    return this;
  }

  public withCommentAuthorMap(commentAuthorMap: Map<string, string>): this {
    this.commentAuthorMap = commentAuthorMap;
    return this;
  }

  public withCommentAuthorDetails(details: Map<string, PptxCommentAuthor>): this {
    this._commentAuthorDetails = details;
    return this;
  }

  public withEmuPerPx(emuPerPx: number): this {
    this.emuPerPx = emuPerPx;
    return this;
  }

  public build(): PptxSaveState {
    if (!this.zip) {
      throw new Error("PptxSaveStateBuilder requires zip before build().");
    }
    if (!this.commentAuthorMap) {
      throw new Error(
        "PptxSaveStateBuilder requires commentAuthorMap before build().",
      );
    }

    return new PptxSaveState({
      zip: this.zip,
      commentAuthorMap: this.commentAuthorMap,
      commentAuthorDetails: this._commentAuthorDetails ?? undefined,
      emuPerPx: this.emuPerPx,
    });
  }
}

export {
  PptxSaveState as PptxSaveSession,
  PptxSaveStateBuilder as PptxSaveSessionBuilder,
};
