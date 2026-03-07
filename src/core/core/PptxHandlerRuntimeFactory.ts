import { PptxHandlerRuntime } from "./PptxHandlerRuntime";

import type { IPptxHandlerRuntime } from "./types";

export interface IPptxHandlerRuntimeFactory {
  createRuntime(): IPptxHandlerRuntime;
}

export class PptxHandlerRuntimeFactory implements IPptxHandlerRuntimeFactory {
  public createRuntime(): IPptxHandlerRuntime {
    return new PptxHandlerRuntime();
  }
}

export const createDefaultPptxHandlerRuntime = (): IPptxHandlerRuntime =>
  new PptxHandlerRuntime();
