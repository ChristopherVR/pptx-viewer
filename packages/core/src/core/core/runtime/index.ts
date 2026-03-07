/**
 * @fileoverview Public entry point for the PptxHandlerRuntime module.
 *
 * The runtime is assembled via a long mixin/inheritance chain where each
 * file in this directory adds a focused set of capabilities (parsing,
 * saving, theme handling, etc.) to a shared `PptxHandlerRuntime` class.
 * The final concrete class is produced by
 * {@link PptxHandlerRuntimeImplementation} and re-exported here as the
 * single public symbol.
 */
export { PptxHandlerRuntime } from "./PptxHandlerRuntimeImplementation";
