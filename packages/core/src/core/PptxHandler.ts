import { PptxHandlerCore } from "./PptxHandlerCore";
import {
	PresentationBuilder,
	type PresentationBuilderResult,
} from "./builders/sdk/PresentationBuilder";
import type { PresentationOptions } from "./builders/sdk/types";

/**
 * Public facade for the PPTX editor handler.
 *
 * The implementation lives in `PptxHandlerCore` so this surface can stay small,
 * stable, and easy to replace with alternate implementations in the future.
 */
export class PptxHandler extends PptxHandlerCore {
	/**
	 * Create a new blank PPTX presentation from scratch.
	 *
	 * This is a convenience static method that delegates to
	 * {@link PresentationBuilder.create}. The returned handler is fully
	 * initialized and ready for editing, adding slides, and saving.
	 *
	 * @param options - Optional slide dimensions, theme, and metadata.
	 * @returns Handler, parsed data, and a slide builder factory.
	 *
	 * @example
	 * ```ts
	 * const { handler, data, createSlide } = await PptxHandler.createBlank({
	 *   title: "My Deck",
	 *   theme: { colors: { accent1: "#FF6B6B" } },
	 * });
	 *
	 * data.slides.push(
	 *   createSlide("Blank")
	 *     .addText("Hello", { fontSize: 36 })
	 *     .build()
	 * );
	 *
	 * const bytes = await handler.save(data.slides);
	 * ```
	 */
	static async createBlank(
		options?: PresentationOptions,
	): Promise<PresentationBuilderResult> {
		return PresentationBuilder.create(options);
	}
}
