/**
 * @fileoverview Shared type definitions used across the PptxHandlerRuntime
 * mixin chain. These interfaces decouple the parsing, styling, and
 * serialization layers by providing stable contracts for data flowing
 * between paragraph-level parsers, shape parsers, and the text body
 * property applicator.
 */

import type {
  XmlObject,
  TextStyle,
  TextSegment,
  PlaceholderDefaults,
  PlaceholderTextLevelStyle,
} from "../../types";

/**
 * Identifies a placeholder shape inside a slide layout or master.
 *
 * Per the OOXML spec (ISO/IEC 29500 19.3.1.36 `p:ph`), placeholders
 * are keyed by a combination of `idx` (numeric index for multi-instance
 * placeholders like content areas) and `type` (semantic role such as
 * "title", "body", "dt", "ftr", "sldNum").
 */
export interface PlaceholderInfo {
  /** Numeric index (`@_idx`) — distinguishes multiple body/content areas. */
  idx?: string;
  /** Semantic type (`@_type`) — e.g. "title", "body", "ctrTitle", "dt". */
  type?: string;
  /** Size hint (`@_sz`) — e.g. "half", "quarter" for layout hinting. */
  sz?: string;
}

/**
 * Context returned when looking up a matching placeholder in a layout
 * or master slide. Contains the raw XML of the inherited shape or
 * picture so that properties (spPr, txBody) can be merged.
 */
export interface PlaceholderLookupContext {
  /** The inherited shape XML object from the layout/master, if any. */
  shape?: XmlObject;
  /** The inherited picture XML object from the layout/master, if any. */
  picture?: XmlObject;
}

/**
 * Context passed to paragraph-level text parsing helpers.
 *
 * Aggregates all inputs needed to resolve paragraph and run styles
 * for a single shape's text body, including inheritance from layouts
 * and masters via placeholder defaults.
 */
export interface ShapeTextParsingContext {
  /** The `p:txBody` XML node from the current slide's shape. */
  readonly txBody: XmlObject | undefined;
  /** The `p:txBody` XML node inherited from the layout/master placeholder. */
  readonly inheritedTxBody: XmlObject | undefined;
  /** Merged default run style from `a:lstStyle > a:defPPr > a:defRPr`. */
  readonly bodyDefaultRunStyle: TextStyle;
  /** Relationship map for the current slide (rId -> target path). */
  readonly slideRelationshipMap: Map<string, string> | undefined;
  /** Placeholder identification info for this shape. */
  readonly placeholderInfo: PlaceholderInfo | undefined;
  /** Resolved placeholder defaults from layout/master chain. */
  readonly phDefaults: PlaceholderDefaults | undefined;
  /** Archive path of the slide being parsed (e.g. "ppt/slides/slide1.xml"). */
  readonly slidePath: string | undefined;
  /** Per-level text style overrides from the placeholder defaults or presentation default text style. */
  readonly effectiveLevelStyles:
    | Record<number, PlaceholderTextLevelStyle>
    | undefined;
}

/**
 * Result of resolving paragraph-level styles for a single `a:p` element.
 *
 * Produced by `resolveShapeParagraphStyle` and consumed when collecting
 * text runs to build the element's final text content.
 */
export interface ParagraphStyleResult {
  /** Resolved horizontal text alignment for this paragraph. */
  paraAlign: TextStyle["align"];
  /** Merged run-level default style combining body, level, and paragraph defaults. */
  mergedDefaultRunStyle: TextStyle;
  /** Per-paragraph indentation values (left margin and first-line indent, in pixels). */
  indent: { marginLeft?: number; indent?: number };
}

/**
 * Result of collecting text runs, fields, and equations for a single
 * paragraph (`a:p`).
 *
 * Produced by `collectShapeParagraphContent` and aggregated across
 * all paragraphs to form the element's final text string and segments.
 */
export interface ParagraphContentResult {
  /** Raw text parts (joined later to form the full text string). */
  parts: string[];
  /** Styled text segments preserving per-run formatting. */
  segments: TextSegment[];
  /** Style from the first text run, used to seed the shape-level text style. */
  seedStyle?: TextStyle;
}

/**
 * Return value from {@link applyBodyProperties}.
 *
 * Captures linked text box chain identifiers parsed from `a:bodyPr`
 * so they can be round-tripped during save.
 */
export interface BodyPropertiesResult {
  /** Linked text box chain identifier (`a:linkedTxbx @_id`). */
  linkedTxbxId?: number;
  /** Sequence number within the linked text box chain (`a:linkedTxbx @_seq`). */
  linkedTxbxSeq?: number;
}
