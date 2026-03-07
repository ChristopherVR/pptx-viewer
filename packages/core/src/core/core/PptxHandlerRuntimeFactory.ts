import { PptxHandlerRuntime } from "./PptxHandlerRuntime";

import type { IPptxHandlerRuntime } from "./types";

/**
 * Abstract factory contract for creating {@link IPptxHandlerRuntime}
 * instances.
 *
 * Implement this interface to supply a custom runtime (e.g. a
 * WASM-backed or test-double runtime) to {@link PptxHandlerCore}.
 */
export interface IPptxHandlerRuntimeFactory {
  /** Instantiate and return a new runtime implementation. */
  createRuntime(): IPptxHandlerRuntime;
}

/**
 * Default factory that produces the standard {@link PptxHandlerRuntime}.
 *
 * Used internally by {@link PptxHandlerCore} when no custom factory is
 * provided.
 */
export class PptxHandlerRuntimeFactory implements IPptxHandlerRuntimeFactory {
  /**
   * Create and return a new {@link PptxHandlerRuntime} instance.
   *
   * @returns A freshly constructed runtime ready for loading a PPTX file.
   */
  public createRuntime(): IPptxHandlerRuntime {
    return new PptxHandlerRuntime();
  }
}

/**
 * Convenience function that creates a default {@link IPptxHandlerRuntime}
 * without needing to instantiate the factory class.
 *
 * @returns A new {@link PptxHandlerRuntime} instance.
 */
export const createDefaultPptxHandlerRuntime = (): IPptxHandlerRuntime =>
  new PptxHandlerRuntime();
