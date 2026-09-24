import type { PptxElement } from '../../types';
import { hasTextProperties } from '../../types';

/** The handful of runtime capabilities `enrichBulletPictureImages` needs. */
export interface BulletPictureImageResolver {
	/** Relationship map for one slide (rId -> target), keyed by slide path. */
	slideRelsMap: Map<string, Map<string, string>>;
	/** Resolve a relationship target to a zip-relative image path (`''` on failure). */
	resolveImagePath(slidePath: string, target: string): string;
	/** Load (and cache) image bytes as a `<img src>`-ready URL. */
	getImageData(imagePath: string): Promise<string | undefined>;
}

/** Matches `enrichOleElementsWithEmbeddedData`'s guard against a cyclic/pathological group tree. */
const MAX_GROUP_DEPTH = 32;

/**
 * Resolve `a:buBlip` picture-bullet images that `resolveParagraphBulletInfo`
 * (parse time, synchronous) could only leave as an `imageRelId`.
 *
 * Paragraph/bullet parsing runs synchronously and outside any async
 * image-loading pass, so it can only serve `imageDataUrl` from whatever
 * `imageDataCache` already happens to hold. A bullet glyph that is never ALSO
 * used as a regular embedded picture elsewhere in the deck (the common case:
 * a small icon authored purely as a list marker) never populates that cache,
 * and NONE of the five bindings fall back to resolving `imageRelId`
 * themselves - every one of them gates its `<img>` on `bulletInfo.src`
 * (`resolvePictureBullet` in `pptx-viewer-shared`) alone. The bullet therefore
 * silently rendered as a plain dot even though the relationship was right
 * there on the slide.
 *
 * Mirrors `enrichOleElementsWithEmbeddedData`'s shape: an async pass over one
 * slide's already-parsed elements, run alongside the OLE/media enrichments in
 * `PptxSlideLoaderService`, mutating `bulletInfo.imageDataUrl` in place so it
 * reaches the finished `PptxSlide` before any binding ever sees it.
 */
export async function enrichBulletPictureImages(
	elements: readonly PptxElement[],
	slidePath: string,
	resolver: BulletPictureImageResolver,
	depth: number = 0,
): Promise<void> {
	if (depth > MAX_GROUP_DEPTH) {
		return;
	}
	for (const element of elements) {
		if (element.type === 'group' && element.children) {
			await enrichBulletPictureImages(element.children, slidePath, resolver, depth + 1);
			continue;
		}
		if (!hasTextProperties(element) || !element.textSegments) {
			continue;
		}
		for (const segment of element.textSegments) {
			const bulletInfo = segment.bulletInfo;
			if (!bulletInfo?.imageRelId || bulletInfo.imageDataUrl) {
				continue;
			}
			try {
				const dataUrl = await resolveBulletImage(bulletInfo.imageRelId, slidePath, resolver);
				if (dataUrl) {
					bulletInfo.imageDataUrl = dataUrl;
				}
			} catch {
				// Non-critical: the bullet keeps its accessible dot fallback.
			}
		}
	}
}

/** Same resolution `resolveParagraphBulletInfo` already does synchronously, awaited here. */
async function resolveBulletImage(
	imageRelId: string,
	slidePath: string,
	resolver: BulletPictureImageResolver,
): Promise<string | undefined> {
	const target = resolver.slideRelsMap.get(slidePath)?.get(imageRelId);
	if (!target) {
		return undefined;
	}
	if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('data:')) {
		return target;
	}
	const imagePath = resolver.resolveImagePath(slidePath, target);
	if (!imagePath) {
		return undefined;
	}
	return resolver.getImageData(imagePath);
}
