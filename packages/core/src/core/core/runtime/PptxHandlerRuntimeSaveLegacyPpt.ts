import { convertDeckToWriteModel, buildPptFile } from '../../ppt/writer';
import type { PptxSlide } from '../../types';
import type { PptxHandlerSaveOptions } from '../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveHandoutInfrastructure';

/**
 * The `'ppt'` output-format branch of the save pipeline.
 *
 * A legacy binary `.ppt` is not an OOXML ZIP package at all, so this bypasses
 * every other save mixin entirely (no `this.zip`, no XML builder) rather than
 * reusing the OOXML pipeline and converting its output: it builds the
 * `write-ppt.ts` intermediate model directly from the live `PptxSlide[]` and
 * hands it to the binary writer.
 */
export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Serialise `slides` to a legacy binary PowerPoint 97-2003 (`.ppt`) file.
	 *
	 * @param slides - The (possibly mutated) live slide array.
	 * @param options - Only `pptPassword` is consulted; every OOXML-specific
	 *   option (conformance, embedded fonts, table styles, ...) has no binary
	 *   `.ppt` counterpart and is ignored.
	 */
	protected async saveAsLegacyPpt(
		slides: PptxSlide[],
		options: PptxHandlerSaveOptions | undefined,
	): Promise<Uint8Array> {
		this.compatibilityService.resetWarnings();
		const deck = convertDeckToWriteModel(
			slides,
			this.rawSlideWidthEmu || 9144000,
			this.rawSlideHeightEmu || 6858000,
			(warning) => this.compatibilityService.reportWarning(warning),
		);
		return buildPptFile(deck, { password: options?.pptPassword });
	}
}
