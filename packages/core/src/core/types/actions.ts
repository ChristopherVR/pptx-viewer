/**
 * Action types: hyperlinks, slide jumps, macros, and action buttons.
 *
 * @module pptx-types/actions
 */

// ==========================================================================
// Shape actions (hyperlinks, slide jumps, macros)
// ==========================================================================

/**
 * A parsed shape-level action from `a:hlinkClick` or `a:hlinkHover`.
 *
 * @example
 * ```ts
 * const link: PptxAction = {
 *   url: "https://example.com",
 *   tooltip: "Visit Example",
 *   highlightClick: true,
 * };
 *
 * const slideJump: PptxAction = {
 *   action: "ppaction://hlinksldjump",
 *   targetSlideIndex: 3,
 * };
 * // => satisfies PptxAction
 * ```
 */
export interface PptxAction {
  /** Relationship ID referencing the action target. */
  rId?: string;
  /** OOXML action string (e.g. `ppaction://hlinksldjump`). */
  action?: string;
  /** Tooltip text shown on hover. */
  tooltip?: string;
  /** Whether the shape should highlight on click. */
  highlightClick?: boolean;
  /** Resolved URL or file path from the slide relationship map. */
  url?: string;
  /** Zero-based index into the slides array for internal slide jumps. */
  targetSlideIndex?: number;
  /** Relationship ID of an optional click sound (`a:snd/@r:embed`). */
  soundRId?: string;
  /** Resolved media target path for the optional click sound. */
  soundPath?: string;
}

/**
 * High-level action type for the action settings UI.
 * Maps to OOXML `ppaction://` verbs + external URLs.
 *
 * @example
 * ```ts
 * const type: ElementActionType = "slide";
 * // => "slide" — one of: "none" | "url" | "slide" | "firstSlide" | "lastSlide" | "prevSlide" | "nextSlide" | "endShow"
 * ```
 */
export type ElementActionType =
  | "none"
  | "url"
  | "slide"
  | "firstSlide"
  | "lastSlide"
  | "prevSlide"
  | "nextSlide"
  | "endShow";

/**
 * User-facing action configuration stored on an element.
 * This is a convenience wrapper around the lower-level `PptxAction` that maps
 * to/from OOXML hyperlink/action attributes.
 *
 * @example
 * ```ts
 * const action: ElementAction = {
 *   trigger: "click",
 *   type: "url",
 *   url: "https://example.com",
 * };
 *
 * const jumpToSlide: ElementAction = {
 *   trigger: "click",
 *   type: "slide",
 *   slideIndex: 5,
 * };
 * // => satisfies ElementAction
 * ```
 */
export interface ElementAction {
  /** When the action fires. */
  trigger: "click" | "hover";
  /** What kind of action to perform. */
  type: ElementActionType;
  /** External URL (for 'url' type). */
  url?: string;
  /** Zero-based slide index (for 'slide' type). */
  slideIndex?: number;
}

/**
 * Preset action button definition (OOXML built-in action button shapes).
 *
 * @example
 * ```ts
 * const btn: ActionButtonPreset = {
 *   shapeType: "actionButtonBackPrevious",
 *   label: "Back",
 *   defaultAction: "prevSlide",
 *   iconPath: "M 0 0 L 10 5 L 0 10 Z",
 * };
 * // => satisfies ActionButtonPreset
 * ```
 */
export interface ActionButtonPreset {
  /** OOXML preset geometry name (e.g. 'actionButtonBackPrevious'). */
  shapeType: string;
  /** Human-readable label. */
  label: string;
  /** Default action type pre-configured on the button. */
  defaultAction: ElementActionType;
  /** SVG path data for the icon rendered inside the button. */
  iconPath: string;
}
