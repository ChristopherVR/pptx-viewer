import { convertDeckToWriteModel, buildPptFile } from '../../ppt/writer';
import type { PptxSlide } from '../../types';
import type { PptxHandlerSaveOptions } from '../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveHandoutInfrastructure';

/** True when `path` names a WAV file by extension (the only audio format `media-writer.ts` embeds). */
function isWavPath(path: string): boolean {
	return /\.wav$/iu.test(path);
}

/**
 * The `'ppt'` output-format branch of the save pipeline.
 *
 * A legacy binary `.ppt` is not an OOXML ZIP package at all, so this bypasses
 * every other save mixin entirely (no XML builder, no OOXML relationship
 * bookkeeping) rather than reusing the OOXML pipeline and converting its
 * output: it builds the `write-ppt.ts` intermediate model directly from the
 * live `PptxSlide[]` and hands it to the binary writer. `this.zip` (the
 * loaded archive, still populated even on this branch: see
 * `PptxHandlerRuntimeLoadSession.ts`) is read from, never written to, purely
 * to resolve `media`-`audio` elements loaded from a real `.pptx` (see
 * `resolveAudioMediaBytes`'s doc).
 */
export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * A `media`-`audio` element loaded from a real `.pptx` carries only
	 * `mediaPath` (a lazy reference into `this.zip`), never `mediaData`
	 * (unlike `imageData`, which the loader eagerly base64-encodes): see
	 * `PptxSlideLoaderService.ts`. Resolve every such path's WAV bytes here,
	 * before conversion, so `element-to-write-model.ts`'s `ConvertContext.
	 * resolvedMedia` can embed them without mutating the live element tree
	 * (the OOXML save pipeline's `PptxHandlerRuntimeSaveElementEmbedding.ts`
	 * reads from the exact same `this.zip` path for the equivalent case, but
	 * mutates the live element in place, which this branch avoids since
	 * nothing else about the live model is touched by a `.ppt` save).
	 */
	private async resolveAudioMediaBytes(slides: PptxSlide[]): Promise<Map<string, Uint8Array>> {
		const paths = new Set<string>();
		const walk = (elements: PptxSlide['elements']): void => {
			for (const el of elements) {
				if (
					el.type === 'media' &&
					el.mediaType === 'audio' &&
					!el.mediaData &&
					el.mediaPath &&
					isWavPath(el.mediaPath)
				) {
					paths.add(el.mediaPath);
				} else if (el.type === 'group') {
					walk(el.children);
				}
			}
		};
		for (const slide of slides) {
			walk(slide.elements);
		}
		const resolved = new Map<string, Uint8Array>();
		await Promise.all(
			[...paths].map(async (path) => {
				const bytes = await this.zip.file(path)?.async('uint8array');
				if (bytes) {
					resolved.set(path, bytes);
				}
			}),
		);
		return resolved;
	}

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
		const resolvedMedia = await this.resolveAudioMediaBytes(slides);
		const deck = convertDeckToWriteModel(
			slides,
			this.rawSlideWidthEmu || 9144000,
			this.rawSlideHeightEmu || 6858000,
			(warning) => this.compatibilityService.reportWarning(warning),
			options?.customShows,
			resolvedMedia,
		);
		return buildPptFile(deck, { password: options?.pptPassword });
	}
}
