import type JSZip from 'jszip';

import type { PptxSlide, XmlObject } from '../../types';
import { BLIP_FILL_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
import type { PptxSaveState } from './PptxSaveSessionBuilder';
import type { IPptxSlideRelationshipRegistry } from './PptxSlideRelationshipRegistry';

export interface PptxSlideBackgroundBuilderInput {
	slideNode: XmlObject;
	slide: PptxSlide;
	zip: JSZip;
	saveState: PptxSaveState;
	relationshipRegistry: IPptxSlideRelationshipRegistry;
	slideImageRelationshipType: string;
	/**
	 * Resolve a background-image URL to bytes. Handles `data:` URLs
	 * synchronously and fetches `blob:`/`http(s)://`/`pptx-resource://`
	 * asynchronously (same resolver the picture/media embedding uses), so a
	 * freshly applied background whose URL is not a data URL is embedded as a
	 * real media part rather than silently dropped.
	 */
	resolveImageToBytes: (url: string) => Promise<{ bytes: Uint8Array; extension: string } | null>;
	/** Optional sink for a "could not embed background" compatibility warning. */
	reportUnsupportedBackground?: (imageUrl: string) => void;
}

export interface IPptxSlideBackgroundBuilder {
	applyBackground(init: PptxSlideBackgroundBuilderInput): Promise<void>;
}

export class PptxSlideBackgroundBuilder implements IPptxSlideBackgroundBuilder {
	public async applyBackground(init: PptxSlideBackgroundBuilderInput): Promise<void> {
		const hasBackgroundColor =
			typeof init.slide.backgroundColor === 'string' &&
			init.slide.backgroundColor.length > 0 &&
			init.slide.backgroundColor !== 'transparent';
		const rawBackgroundImage =
			typeof init.slide.backgroundImage === 'string' ? init.slide.backgroundImage : '';
		const hasBackgroundImage = rawBackgroundImage.length > 0;
		const hasDataUrlBackgroundImage = hasBackgroundImage && rawBackgroundImage.startsWith('data:');
		const hasBackgroundGradient =
			typeof init.slide.backgroundGradient === 'string' && init.slide.backgroundGradient.length > 0;

		const cSld = (init.slideNode['p:cSld'] || {}) as XmlObject;

		if (!(hasBackgroundColor || hasBackgroundImage || hasBackgroundGradient)) {
			delete cSld['p:bg'];
			init.slideNode['p:cSld'] = cSld;
			return;
		}

		// When the slide already has a blipFill-based background (rId-referenced
		// image) preserve the raw <p:bg> XML unless the slide model provides
		// a fresh data-URL image to replace it. This round-trips all original
		// metadata (dpi, rotWithShape, srcRect, stretch/fillRect tile/alignment
		// coordinates, a:lum, …) that the model does not carry, and — critically
		// — avoids emitting a schema-invalid <p:bgPr><a:effectLst/></p:bgPr>
		// with no preceding fill when the source uses an rId-referenced image
		// rather than a data URL.
		//
		// backgroundColor / backgroundGradient frequently come from layout or
		// master fallbacks in the loader (see PptxSlideLoaderService), so their
		// presence alone must not clobber a slide-level blipFill. We only
		// regenerate on a data-URL image (a direct override).
		const existingBg = cSld['p:bg'] as XmlObject | undefined;
		const existingBgPr = existingBg?.['p:bgPr'] as XmlObject | undefined;
		const existingHasBlipFill = existingBgPr?.['a:blipFill'] !== undefined;
		if (!hasDataUrlBackgroundImage && existingHasBlipFill) {
			// OOXML CT_CommonSlideData requires child order: bg, spTree, ...
			// Reorder cSld so p:bg comes first while preserving the raw node.
			this.reorderCSldBgFirst(cSld, existingBg!);
			init.slideNode['p:cSld'] = cSld;
			return;
		}

		const backgroundProperties: XmlObject = {};
		// Embed ANY resolvable background image (data URL, or a fetched
		// blob:/http(s):///pptx-resource:// URL), not just data URLs. A freshly
		// applied background (e.g. from a design/theme preview) is typically a
		// bundled or remote URL; embedding it here is what makes it appear in
		// PowerPoint after save instead of being dropped.
		if (hasBackgroundImage) {
			const parsedBackgroundImage = await init.resolveImageToBytes(rawBackgroundImage);
			if (parsedBackgroundImage) {
				const backgroundImagePath = init.saveState.nextMediaPath(parsedBackgroundImage.extension);
				init.zip.file(backgroundImagePath, parsedBackgroundImage.bytes);
				const backgroundRelationshipId = init.relationshipRegistry.nextRelationshipId();
				const relativeBackgroundImagePath = backgroundImagePath.replace(/^ppt\//, '../');
				init.relationshipRegistry.upsertRelationship(
					backgroundRelationshipId,
					init.slideImageRelationshipType,
					relativeBackgroundImagePath,
				);
				backgroundProperties['a:blipFill'] = reorderObjectKeys(
					{
						'a:blip': { '@_r:embed': backgroundRelationshipId },
						'a:stretch': { 'a:fillRect': {} },
					},
					BLIP_FILL_ORDER,
				);
			} else {
				init.reportUnsupportedBackground?.(rawBackgroundImage);
			}
		}
		// Fall back to a solid colour only when no image fill was embedded.
		if (
			backgroundProperties['a:blipFill'] === undefined &&
			hasBackgroundColor &&
			init.slide.backgroundColor
		) {
			backgroundProperties['a:solidFill'] = {
				'a:srgbClr': {
					'@_val': init.slide.backgroundColor.replace('#', '').toUpperCase(),
				},
			};
		}

		// Guarantee a schema-valid <p:bgPr>: only emit <a:effectLst/> when a
		// fill child precedes it. EG_FillProperties is required before
		// a:effectLst in CT_BackgroundProperties.
		const hasFillChild =
			backgroundProperties['a:blipFill'] !== undefined ||
			backgroundProperties['a:solidFill'] !== undefined ||
			backgroundProperties['a:gradFill'] !== undefined ||
			backgroundProperties['a:pattFill'] !== undefined ||
			backgroundProperties['a:noFill'] !== undefined ||
			backgroundProperties['a:grpFill'] !== undefined;
		if (hasFillChild) {
			backgroundProperties['a:effectLst'] = {};
		}

		// Round-trip <p:bgPr/@shadeToTitle> when the slide carries the flag.
		// ECMA-376 §19.3.1.2 (CT_BackgroundProperties).
		if (init.slide.backgroundShadeToTitle === true) {
			backgroundProperties['@_shadeToTitle'] = '1';
		} else if (init.slide.backgroundShadeToTitle === false) {
			backgroundProperties['@_shadeToTitle'] = '0';
		}

		if (!hasFillChild) {
			// No fill child could be produced (e.g. a background image whose URL
			// could not be resolved to bytes). Prefer preserving any existing
			// <p:bg> over dropping it, so an unresolvable image does not silently
			// wipe a background that was there. Only when there is nothing to
			// preserve do we remove <p:bg> (avoids emitting invalid XML).
			if (existingBg !== undefined) {
				this.reorderCSldBgFirst(cSld, existingBg);
				init.slideNode['p:cSld'] = cSld;
				return;
			}
			delete cSld['p:bg'];
			init.slideNode['p:cSld'] = cSld;
			return;
		}

		// OOXML CT_CommonSlideData requires child order: bg, spTree,
		// custDataLst, controls, extLst. Rebuild p:cSld with p:bg first
		// so fast-xml-parser emits it before any other children.
		const rebuiltCSld: XmlObject = { 'p:bg': { 'p:bgPr': backgroundProperties } };
		for (const key of Object.keys(cSld)) {
			if (key === 'p:bg') {
				continue;
			}
			rebuiltCSld[key] = cSld[key];
		}
		init.slideNode['p:cSld'] = rebuiltCSld;
	}

	private reorderCSldBgFirst(cSld: XmlObject, bg: XmlObject): void {
		const keys = Object.keys(cSld);
		if (keys.length > 0 && keys[0] === 'p:bg') {
			// Already first; nothing to do.
			return;
		}
		const reordered: XmlObject = { 'p:bg': bg };
		for (const key of keys) {
			if (key === 'p:bg') {
				continue;
			}
			reordered[key] = cSld[key];
		}
		for (const key of Object.keys(cSld)) {
			delete cSld[key];
		}
		for (const key of Object.keys(reordered)) {
			cSld[key] = reordered[key];
		}
	}
}
