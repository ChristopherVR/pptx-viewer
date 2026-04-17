import type JSZip from 'jszip';

import type { PptxSlide, XmlObject } from '../../types';
import type { PptxSaveState } from './PptxSaveSessionBuilder';
import type { IPptxSlideRelationshipRegistry } from './PptxSlideRelationshipRegistry';

export interface PptxSlideBackgroundBuilderInput {
	slideNode: XmlObject;
	slide: PptxSlide;
	zip: JSZip;
	saveState: PptxSaveState;
	relationshipRegistry: IPptxSlideRelationshipRegistry;
	slideImageRelationshipType: string;
	parseDataUrlToBytes: (dataUrl: string) => { bytes: Uint8Array; extension: string } | null;
}

export interface IPptxSlideBackgroundBuilder {
	applyBackground(init: PptxSlideBackgroundBuilderInput): void;
}

export class PptxSlideBackgroundBuilder implements IPptxSlideBackgroundBuilder {
	public applyBackground(init: PptxSlideBackgroundBuilderInput): void {
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
		if (hasDataUrlBackgroundImage) {
			const parsedBackgroundImage = init.parseDataUrlToBytes(rawBackgroundImage);
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
				backgroundProperties['a:blipFill'] = {
					'a:blip': { '@_r:embed': backgroundRelationshipId },
					'a:stretch': { 'a:fillRect': {} },
				};
			}
		} else if (hasBackgroundColor && init.slide.backgroundColor) {
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

		if (!hasFillChild) {
			// Nothing to write (e.g. data URL parse failed and no other source).
			// Fall back to dropping <p:bg> entirely rather than emitting
			// invalid XML.
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
