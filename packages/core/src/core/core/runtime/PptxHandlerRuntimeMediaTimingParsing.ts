import { parseTimeTargetElement } from '../../services/animation-target-build-helpers';
import { resolveSlideTimingNode } from '../../services/slide-transition-envelope';
import { XmlObject } from '../../types';
import type { MediaTimingData } from './PptxHandlerRuntimeImageEffects';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeImageEffects';
import {
	getXmlShapeIdFromXml,
	getPathExtensionFromPath,
	getImageMimeTypeFromPath,
	parseCtnMediaTiming,
	resolvePlayAcrossSlides,
} from './PptxHandlerRuntimeMediaParsingUtils';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Recursively walk the timing tree looking for `p:video` and `p:audio`
	 * nodes that contain `p:cMediaNode`.
	 */
	protected walkMediaTimingTree(
		node: XmlObject,
		result: Map<string, MediaTimingData>,
		slidePath: string,
	): void {
		if (!node) {
			return;
		}

		// Check for p:video and p:audio nodes at this level
		for (const mediaTag of ['p:video', 'p:audio']) {
			const mediaNodes = this.ensureArray(node[mediaTag]);
			for (const mediaNode of mediaNodes) {
				const cMediaNode = mediaNode['p:cMediaNode'] as XmlObject | undefined;
				if (!cMediaNode) {
					continue;
				}

				// Extract target shape ID. Delegates to the shared timing-target
				// parser (rather than re-reading `p:spTgt/@_spid` here directly)
				// so a media node targeting a shape NESTED in a group
				// (`p:spTgt/p:subSp`) resolves to the real leaf shape, exactly
				// like every other animation target parse (Rule 2 dedupe: this
				// used to reimplement a narrower version of the same read).
				const tgtEl = cMediaNode['p:tgtEl'] as XmlObject | undefined;
				const target = parseTimeTargetElement(tgtEl);
				const shapeId =
					target?.type === 'shape' ? (target.subShapeId ?? target.shapeId) : undefined;
				if (!shapeId) {
					continue;
				}

				// Extract timing from p:cTn
				const cTn = cMediaNode['p:cTn'] as XmlObject | undefined;
				const timing = parseCtnMediaTiming(cTn, mediaTag);

				// Full-screen flag
				const fullScreen = cMediaNode['@_fullScrn'] === '1';

				// Volume (0-100000 in OOXML, maps to 0-1)
				let volume: number | undefined;
				const volRaw = cMediaNode['@_vol'];
				if (volRaw !== undefined) {
					const volVal = parseInt(String(volRaw));
					if (Number.isFinite(volVal)) {
						volume = Math.max(0, Math.min(1, volVal / 100000));
					}
				}

				// Hide-when-not-playing
				const hideWhenNotPlaying = cMediaNode['@_showWhenStopped'] === '0';

				// Play across slides: the `cMediaNode/@numSld` form is folded in
				// alongside the cTn `dur="indefinite"` heuristic (issue #132).
				const playAcrossSlides = resolvePlayAcrossSlides(
					cMediaNode,
					timing.playAcrossSlides,
					mediaTag,
				);

				// Poster frame — resolve rId
				let posterFramePath: string | undefined;
				const posterRId = cMediaNode['@_posterFrame'];
				if (posterRId) {
					posterFramePath = this.resolveRelationshipTarget(slidePath, String(posterRId));
				}

				// `p14:media` (trim/fade/bookmarks/embed) is NOT read here (G18):
				// real PowerPoint never writes that extension under the TIMING
				// tree's `p:video`/`p:audio`/`p:cMediaNode`, only under the
				// picture's own `p:nvPr/p:extLst` (see `parsePicture`, which reads
				// it directly off `nvPr` and sets those fields on the element).
				// This map now carries only the genuine `p:cMediaNode`/`p:cTn`
				// flags: fullScreen, loop, volume, autoPlay, playAcrossSlides,
				// hideWhenNotPlaying, posterFramePath.
				result.set(shapeId, {
					fullScreen: fullScreen || undefined,
					loop: timing.loop || undefined,
					posterFramePath,
					volume,
					autoPlay: timing.autoPlay || undefined,
					playAcrossSlides: playAcrossSlides || undefined,
					hideWhenNotPlaying: hideWhenNotPlaying || undefined,
				});
			}
		}

		// Recurse into timing containers
		const cTn = node['p:cTn'] as XmlObject | undefined;
		if (cTn) {
			const childTnLst = cTn['p:childTnLst'] as XmlObject | undefined;
			if (childTnLst) {
				for (const container of ['p:par', 'p:seq', 'p:excl']) {
					const children = this.ensureArray(childTnLst[container]);
					for (const child of children) {
						this.walkMediaTimingTree(child, result, slidePath);
					}
				}
				// Also check for p:video / p:audio directly inside childTnLst
				this.walkMediaTimingTree(childTnLst, result, slidePath);
			}
		}

		// Direct container children
		for (const container of ['p:par', 'p:seq', 'p:excl', 'p:tnLst']) {
			const children = this.ensureArray(node[container]);
			for (const child of children) {
				this.walkMediaTimingTree(child, result, slidePath);
			}
		}
	}

	/**
	 * Walk the slide's `p:timing` tree and collect media-specific timing data
	 * (`p:video` / `p:audio` → `p:cMediaNode`) keyed by target shape ID.
	 *
	 * Returns a map of shapeId → { fullScreen, loop, volume, autoPlay,
	 * playAcrossSlides, hideWhenNotPlaying, posterFramePath }. Trim, fade,
	 * bookmarks and the `p14:media` embed fallback are NOT sourced from here
	 * (see the comment inside {@link walkMediaTimingTree}); `parsePicture`
	 * reads those directly off the picture's own `p:nvPr/p:extLst`.
	 */
	protected extractMediaTimingMap(
		slideXml: XmlObject,
		slidePath: string,
	): Map<string, MediaTimingData> {
		const result = new Map<string, MediaTimingData>();

		try {
			// `resolveSlideTimingNode` also finds a `p:timing` wrapped in a
			// slide-root `mc:AlternateContent` envelope (issue #132 deck).
			const timing = resolveSlideTimingNode(slideXml?.['p:sld'] as XmlObject | undefined);
			if (!timing) {
				return result;
			}

			this.walkMediaTimingTree(timing, result, slidePath);
		} catch (e) {
			console.warn('Failed to parse media timing data:', e);
		}

		return result;
	}

	/**
	 * Extract the XML shape ID (`p:cNvPr/@_id`) from a parsed element's raw XML.
	 * Delegates to standalone utility function.
	 */
	protected getXmlShapeId(rawXml: XmlObject | undefined): string | undefined {
		return getXmlShapeIdFromXml(rawXml);
	}

	protected getPathExtension(pathValue: string): string | undefined {
		return getPathExtensionFromPath(pathValue);
	}

	protected getImageMimeType(imagePath: string): string {
		return getImageMimeTypeFromPath(imagePath);
	}

	/**
	 * Extract a media file from the PPTX archive as an ArrayBuffer.
	 * This avoids the base64 encoding overhead of getImageData, saving ~33%
	 * memory for large audio/video files.
	 */
	async getMediaArrayBuffer(mediaPath: string): Promise<ArrayBuffer | undefined> {
		if (!mediaPath) {
			return undefined;
		}
		const file = this.zip.file(mediaPath);
		if (!file) {
			return undefined;
		}
		try {
			return await file.async('arraybuffer');
		} catch {
			return undefined;
		}
	}
}
