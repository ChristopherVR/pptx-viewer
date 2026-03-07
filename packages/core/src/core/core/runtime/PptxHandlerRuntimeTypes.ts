import type {
  XmlObject,
  TextStyle,
  TextSegment,
  PlaceholderDefaults,
  PlaceholderTextLevelStyle,
} from "../../types";

export interface PlaceholderInfo {
  idx?: string;
  type?: string;
  sz?: string;
}

export interface PlaceholderLookupContext {
  shape?: XmlObject;
  picture?: XmlObject;
}

/** Context passed to paragraph-level text parsing helpers. */
export interface ShapeTextParsingContext {
  readonly txBody: XmlObject | undefined;
  readonly inheritedTxBody: XmlObject | undefined;
  readonly bodyDefaultRunStyle: TextStyle;
  readonly slideRelationshipMap: Map<string, string> | undefined;
  readonly placeholderInfo: PlaceholderInfo | undefined;
  readonly phDefaults: PlaceholderDefaults | undefined;
  readonly slidePath: string | undefined;
  readonly effectiveLevelStyles:
    | Record<number, PlaceholderTextLevelStyle>
    | undefined;
}

/** Result of resolving paragraph-level styles for a single paragraph. */
export interface ParagraphStyleResult {
  paraAlign: TextStyle["align"];
  mergedDefaultRunStyle: TextStyle;
  indent: { marginLeft?: number; indent?: number };
}

/** Result of collecting text runs/fields/equations for a single paragraph. */
export interface ParagraphContentResult {
  parts: string[];
  segments: TextSegment[];
  seedStyle?: TextStyle;
}

/** Return value from {@link applyBodyProperties}. */
export interface BodyPropertiesResult {
  linkedTxbxId?: number;
  linkedTxbxSeq?: number;
}
