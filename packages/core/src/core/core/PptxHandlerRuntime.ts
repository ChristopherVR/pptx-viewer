import { PptxHandlerRuntime as PptxHandlerRuntimeImplementation } from "./runtime/PptxHandlerRuntimeImplementation";
import type { IPptxHandlerRuntime } from "./types";

export class PptxHandlerRuntime
  extends PptxHandlerRuntimeImplementation
  implements IPptxHandlerRuntime {}
