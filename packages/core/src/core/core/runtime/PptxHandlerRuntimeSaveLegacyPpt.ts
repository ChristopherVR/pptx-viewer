import {
	buildMasterRoundTripFromPptx,
	buildMetroBlobs,
	buildPptFile,
	convertDeckToWriteModel,
	deckNeedsMetroBlobs,
	convertMasterTextStyles,
	resolvePictureSources,
} from '../../ppt/writer';
import type { PptxMasterTextStyles, PptxSlide } from '../../types';
import type { PptxHandlerSaveOptions } from '../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveHandoutInfrastructure';

/** Serialises the deck being saved as a Transitional `.pptx` (see `saveAsLegacyPpt`). */
export type LegacyPptxSerializer = () => Promise<Uint8Array>;

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
	 * Build the `metroBlob` round-trip packages (see
	 * `ppt/writer/metro-blob-package.ts`) that let PowerPoint 2007+ reopen
	 * ink, SmartArt, charts and 3D models from the `.ppt` as native objects.
	 * Their OOXML comes from this handler's own lossless `.pptx` save of the
	 * same slides (always Transitional: the package is read by PowerPoint's
	 * Transitional DrawingML loader), so an edited element round-trips its
	 * current state, not the state it was loaded with. Skipped entirely when
	 * the deck holds no such element.
	 */
	private async resolveMetroBlobs(
		slides: PptxSlide[],
		pptxBytes: Uint8Array | undefined,
	): Promise<Map<string, Uint8Array> | undefined> {
		if (!pptxBytes || !deckNeedsMetroBlobs(slides)) {
			return undefined;
		}
		return buildMetroBlobs(pptxBytes, slides);
	}

	/**
	 * The master text styles the `.ppt`'s single main master carries: those of
	 * the first slide's own master (a binary `.ppt` written here has one
	 * master), preferring an edited copy passed in `options.slideMasters` over
	 * the styles parsed at load.
	 */
	private legacyMasterTextStyles(
		slides: PptxSlide[],
		options: PptxHandlerSaveOptions | undefined,
	): PptxMasterTextStyles | undefined {
		const layoutPath = slides[0]?.layoutPath;
		const masterPath =
			(layoutPath ? this.resolveMasterPathForLayout(layoutPath) : undefined) ??
			this.masterTxStylesCache.keys().next().value;
		if (!masterPath) {
			return undefined;
		}
		const edited = options?.slideMasters?.find((master) => master.path === masterPath)?.txStyles;
		return edited ?? this.masterTxStylesCache.get(masterPath);
	}

	/**
	 * Serialise `slides` to a legacy binary PowerPoint 97-2003 (`.ppt`) file.
	 *
	 * @param slides - The (possibly mutated) live slide array.
	 * @param options - Only `pptPassword` is consulted; every OOXML-specific
	 *   option (conformance, embedded fonts, table styles, ...) has no binary
	 *   `.ppt` counterpart and is ignored.
	 * @param saveAsPptx - Serialises the same slides as a Transitional `.pptx`
	 *   (the save pipeline's own OOXML path), the source of the `metroBlob`
	 *   packages and of the master's placeholders and theme round-trip atoms;
	 *   omit to write plain fallbacks and a default master only.
	 */
	protected async saveAsLegacyPpt(
		slides: PptxSlide[],
		options: PptxHandlerSaveOptions | undefined,
		saveAsPptx?: LegacyPptxSerializer,
	): Promise<Uint8Array> {
		// One Transitional .pptx save feeds both the metroBlob packages and the
		// main master's placeholders, theme and text-style round-trip atoms.
		const pptxBytes = saveAsPptx ? await saveAsPptx() : undefined;
		const metroBlobs = await this.resolveMetroBlobs(slides, pptxBytes);
		const master = pptxBytes ? await buildMasterRoundTripFromPptx(pptxBytes) : undefined;
		this.compatibilityService.resetWarnings();
		const resolvedMedia = await this.resolveAudioMediaBytes(slides);
		const resolvedPictures = await resolvePictureSources(slides, async (path) =>
			this.zip.file(path)?.async('uint8array'),
		);
		const deck = convertDeckToWriteModel(
			slides,
			this.rawSlideWidthEmu || 9144000,
			this.rawSlideHeightEmu || 6858000,
			(warning) => this.compatibilityService.reportWarning(warning),
			options?.customShows,
			resolvedMedia,
			metroBlobs,
			resolvedPictures,
		);
		deck.masterStyles = convertMasterTextStyles(
			this.legacyMasterTextStyles(slides, options),
			master?.themeFonts,
		);
		deck.master = master;
		return buildPptFile(deck, { password: options?.pptPassword });
	}
}
