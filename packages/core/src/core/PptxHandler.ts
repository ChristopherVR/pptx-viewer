import { PptxHandlerCore } from "./PptxHandlerCore";

/**
 * Public facade for the PPTX editor handler.
 *
 * The implementation lives in `PptxHandlerCore` so this surface can stay small,
 * stable, and easy to replace with alternate implementations in the future.
 */
export class PptxHandler extends PptxHandlerCore {}
