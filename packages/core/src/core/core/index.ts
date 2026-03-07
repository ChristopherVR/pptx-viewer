/**
 * Core runtime sub-system barrel export.
 *
 * Provides the runtime implementation hierarchy, its factory, and all
 * supporting builders and factories used by the PPTX load/save pipeline.
 *
 * @module pptx-core/runtime
 */

export {
  createDefaultPptxHandlerRuntime,
  PptxHandlerRuntimeFactory,
  type IPptxHandlerRuntimeFactory,
} from "./PptxHandlerRuntimeFactory";
export { PptxHandlerRuntime } from "./PptxHandlerRuntime";
export * from "./builders";
export * from "./factories";
export type {
  IPptxHandlerRuntime,
  PptxHandlerLoadOptions,
  PptxHandlerSaveOptions,
  PptxSaveFormat,
} from "./types";
