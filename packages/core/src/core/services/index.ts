/**
 * Barrel export for the PPTX services layer.
 *
 * Re-exports all public service classes, interfaces, and supporting types
 * used by the core PPTX handler for slide loading, animation parsing/writing,
 * transitions, compatibility inspection, XML lookup, document properties,
 * and template backgrounds.
 *
 * @module services
 */

export {
  PptxCompatibilityService,
  type CompatibilityWarningInput,
  type IPptxCompatibilityService,
} from "./PptxCompatibilityService";
export { PptxDocumentPropertiesUpdater } from "./PptxDocumentPropertiesUpdater";
export {
  PptxTemplateBackgroundService,
  type IPptxTemplateBackgroundService,
  type PptxTemplateBackgroundState,
} from "./PptxTemplateBackgroundService";
export {
  PptxSlideLoaderService,
  type IPptxSlideLoaderService,
  type PptxMediaTimingEntry,
  type PptxMediaTimingMap,
  type PptxSlideLoaderParams,
  type PptxSlideLoaderThemeOverride,
  type PptxSlideNotesResult,
} from "./PptxSlideLoaderService";
export {
  PptxXmlLookupService,
  type IPptxXmlLookupService,
} from "./PptxXmlLookupService";
export {
  PptxEditorAnimationService,
  type IPptxEditorAnimationService,
  type PptxEditorAnimationServiceOptions,
} from "./PptxEditorAnimationService";
export {
  PptxNativeAnimationService,
  type IPptxNativeAnimationService,
} from "./PptxNativeAnimationService";
export {
  PptxSlideTransitionService,
  type IPptxSlideTransitionService,
  type PptxSlideTransitionServiceOptions,
} from "./PptxSlideTransitionService";
export {
  PptxAnimationWriteService,
  type IPptxAnimationWriteService,
} from "./PptxAnimationWriteService";
export { PRESET_TO_OOXML } from "./animation-write-mappings";
export { buildSingleEffectNode } from "./animation-write-node-builders";
export {
  parseCondition,
  parseConditionList,
  serializeCondition,
  serializeConditionList,
} from "./native-animation-helpers";
