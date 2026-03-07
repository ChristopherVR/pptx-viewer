import { PptxHandlerRuntime as PptxHandlerRuntimeImplementation } from "./runtime/PptxHandlerRuntimeImplementation";
import type { IPptxHandlerRuntime } from "./types";

/**
 * Concrete PPTX handler runtime — the "final" class in the runtime
 * inheritance chain.
 *
 * This thin subclass exists purely to seal the multi-file mixin hierarchy
 * defined under `./runtime/` and to declare that the assembled class
 * satisfies the {@link IPptxHandlerRuntime} contract. No additional logic
 * is added here; all behaviour comes from
 * {@link PptxHandlerRuntimeImplementation} and its ancestor mixins.
 *
 * Consumers should interact with the runtime through the
 * {@link IPptxHandlerRuntime} interface rather than this concrete class.
 */
export class PptxHandlerRuntime
  extends PptxHandlerRuntimeImplementation
  implements IPptxHandlerRuntime {}
