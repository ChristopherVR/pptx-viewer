/**
 * Metadata types: slide comments, compatibility warnings, tags,
 * custom properties, core/app document properties.
 *
 * @module pptx-types/metadata
 */

// ==========================================================================
// Comments, compatibility warnings, tags, and document properties
// ==========================================================================

/**
 * A slide comment — may be a legacy positional comment or a modern
 * threaded comment with replies.
 *
 * @example
 * ```ts
 * const comment: PptxComment = {
 *   id: "c1",
 *   text: "Please update this chart.",
 *   author: "Alice",
 *   createdAt: "2024-06-01T10:00:00Z",
 *   resolved: false,
 * };
 * // => satisfies PptxComment
 * ```
 */
export interface PptxComment {
  id: string;
  text: string;
  /** Optional parent comment id for reply threading metadata. */
  parentId?: string;
  author?: string;
  createdAt?: string;
  x?: number;
  y?: number;
  /** Whether this comment has been resolved/marked done. */
  resolved?: boolean;
  /** Modern threaded comment support (p15:threadingInfo). */
  threadId?: string;
  /** Replies to this comment (for modern threaded comments). */
  replies?: PptxComment[];
  /** ID of the element this comment is associated with (if any). */
  elementId?: string;
}

/**
 * A compatibility warning generated during parse or save when the
 * file uses features not fully supported by the editor.
 *
 * @example
 * ```ts
 * const warning: PptxCompatibilityWarning = {
 *   code: "UNSUPPORTED_3D",
 *   message: "3D rotation effects may not render accurately.",
 *   severity: "warning",
 *   scope: "element",
 *   slideId: "slide-1",
 *   elementId: "elem-42",
 * };
 * // => satisfies PptxCompatibilityWarning
 * ```
 */
export interface PptxCompatibilityWarning {
  code: string;
  message: string;
  severity: "info" | "warning";
  scope: "presentation" | "slide" | "element" | "save";
  slideId?: string;
  elementId?: string;
  xmlPath?: string;
}

// ==========================================================================
// Tags & Custom Properties (GAP-14)
// ==========================================================================

/**
 * A single name–value tag from `ppt/tags/*.xml`.
 *
 * @example
 * ```ts
 * const tag: PptxTag = { name: "CUSTOM_ID", value: "12345" };
 * // => satisfies PptxTag
 * ```
 */
export interface PptxTag {
  name: string;
  value: string;
}

/**
 * A collection of tags from a single tags XML part.
 *
 * @example
 * ```ts
 * const coll: PptxTagCollection = {
 *   path: "ppt/tags/tag1.xml",
 *   tags: [{ name: "CUSTOM_ID", value: "12345" }],
 * };
 * // => satisfies PptxTagCollection
 * ```
 */
export interface PptxTagCollection {
  /** File path within the PPTX archive. */
  path: string;
  /** Tags in this collection. */
  tags: PptxTag[];
}

/**
 * A custom document property from `docProps/custom.xml`.
 *
 * @example
 * ```ts
 * const prop: PptxCustomProperty = {
 *   name: "Project",
 *   value: "pptx",
 *   type: "lpwstr",
 * };
 * // => satisfies PptxCustomProperty
 * ```
 */
export interface PptxCustomProperty {
  /** Property name. */
  name: string;
  /** Property value (always stringified). */
  value: string;
  /** Original VT type (e.g. "lpwstr", "i4", "bool", "filetime"). */
  type: string;
}

/**
 * Core document properties from `docProps/core.xml` (Dublin Core + OOXML).
 *
 * @example
 * ```ts
 * const core: PptxCoreProperties = {
 *   title: "Q4 Business Review",
 *   creator: "Alice",
 *   created: "2024-01-15T08:00:00Z",
 *   modified: "2024-06-01T12:30:00Z",
 *   lastModifiedBy: "Bob",
 * };
 * // => satisfies PptxCoreProperties
 * ```
 */
export interface PptxCoreProperties {
  /** dc:title */
  title?: string;
  /** dc:subject */
  subject?: string;
  /** dc:creator */
  creator?: string;
  /** cp:keywords */
  keywords?: string;
  /** dc:description */
  description?: string;
  /** cp:lastModifiedBy */
  lastModifiedBy?: string;
  /** cp:revision */
  revision?: string;
  /** dcterms:created (ISO 8601) */
  created?: string;
  /** dcterms:modified (ISO 8601) */
  modified?: string;
  /** cp:category */
  category?: string;
  /** cp:contentStatus */
  contentStatus?: string;
}

/**
 * Extended (application) properties from `docProps/app.xml`.
 *
 * @example
 * ```ts
 * const app: PptxAppProperties = {
 *   application: "Microsoft Office PowerPoint",
 *   appVersion: "16.0000",
 *   slides: 24,
 *   words: 1500,
 *   company: "Acme Corp",
 * };
 * // => satisfies PptxAppProperties
 * ```
 */
export interface PptxAppProperties {
  /** Application name (e.g. "Microsoft Office PowerPoint"). */
  application?: string;
  /** Application version string. */
  appVersion?: string;
  /** Presentation format (e.g. "On-screen Show (16:9)"). */
  presentationFormat?: string;
  /** Total number of slides. */
  slides?: number;
  /** Number of hidden slides. */
  hiddenSlides?: number;
  /** Number of notes slides. */
  notes?: number;
  /** Total editing time in minutes. */
  totalTime?: number;
  /** Number of words. */
  words?: number;
  /** Number of paragraphs. */
  paragraphs?: number;
  /** Company name. */
  company?: string;
  /** Manager name. */
  manager?: string;
  /** Template name. */
  template?: string;
  /** Hyperlink base URL. */
  hyperlinkBase?: string;
}
