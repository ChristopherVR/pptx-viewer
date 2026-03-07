/**
 * Barrel re-export — all PPTX editor types from domain-specific modules.
 *
 * Import from this entry-point for convenience:
 * ```ts
 * import type { PptxSlide, PptxElement, TextStyle } from "./types";
 * ```
 *
 * @module pptx-types
 */

// ==========================================================================
// Barrel re-export — all PPTX editor types from domain-specific modules
// ==========================================================================

export * from "./common";
export * from "./three-d";
export * from "./text";
export * from "./shape-style";
export * from "./image";
export * from "./geometry";
export * from "./chart";
export * from "./smart-art";
export * from "./table";
export * from "./transition";
export * from "./animation";
export * from "./media";
export * from "./actions";
export * from "./metadata";
export * from "./element-base";
export * from "./elements";
export * from "./type-guards";
export * from "./theme";
export * from "./masters";
export * from "./presentation";
export * from "./view-properties";
