/**
 * Barrel re-export for backward compatibility.
 *
 * The implementation has been split into focused modules:
 * - text-field-substitution   field placeholder substitution
 * - text-layout               text box layout styles + tab size
 * - text-effects              text fill, shadow, glow, reflection CSS
 * - text-warp-css             CSS warp preset transforms
 * - text-animation            text build animation wrappers
 * - text-segment-helpers      highlight types, script-aware text
 * - text-segment-render       single-segment rendering
 * - text-paragraph-render     paragraph grouping + renderTextSegments
 */
export {
  type FieldSubstitutionContext,
  resolveFieldDateText,
  substituteFieldText,
} from "./text-field-substitution";
export { getTextLayoutStyle } from "./text-layout";
export {
  buildTextFillCss,
  buildText3DShadowCss,
  buildTextShadowCss,
  buildTextGlowFilter,
  buildTextReflectionCss,
} from "./text-effects";
export { getTextWarpStyle } from "./text-warp-css";
export {
  type ParagraphEntry,
  buildAnimStyle,
  wrapWithTextBuildAnimation,
} from "./text-animation";
export {
  type TextSegmentHighlight,
  type ElementFindHighlights,
  type ScriptFonts,
  renderScriptAwareText,
  renderSegmentContent,
} from "./text-segment-helpers";
export { renderSingleSegment } from "./text-segment-render";
export { renderTextSegments } from "./text-paragraph-render";
