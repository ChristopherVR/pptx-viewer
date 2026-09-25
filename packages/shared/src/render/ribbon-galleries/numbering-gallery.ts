/**
 * Home > Numbering drop-down: PowerPoint's Numbering Library (None plus seven
 * `a:buAutoNum` schemes), applied to every paragraph of the selected
 * text-bearing element through the ribbon's own list machinery
 * (`list-library-apply.ts`).
 *
 * @module render/ribbon-galleries/numbering-gallery
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { formatAutoNumber } from '../bullet-autonum';
import type { RibbonGalleryModule } from './gallery-module';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryDescriptor,
	RibbonGalleryItem,
} from './gallery-types';
import { applyNumberingLibrary, hasNumberingLibrary } from './list-library-apply';
import { NUMBERING_LIBRARY } from './list-library-catalog';
import { LIST_TILE, listTileSvg } from './list-preview-svg';

function textElement(ctx: RibbonGalleryContext): PptxElement | null {
	return ctx.element && hasTextProperties(ctx.element) ? ctx.element : null;
}

function build(ctx: RibbonGalleryContext): RibbonGalleryDescriptor {
	const element = textElement(ctx);
	const none: RibbonGalleryItem = {
		id: 'none',
		labelKey: 'pptx.gallery.numbering.none',
		label: 'None',
		previewSvg: listTileSvg(null),
		applied: element !== null && hasNumberingLibrary(element, null),
	};
	return {
		id: 'numbering',
		labelKey: 'pptx.gallery.numbering.title',
		label: 'Numbering',
		disabled: element === null,
		sections: [
			{
				id: 'library',
				titleKey: 'pptx.gallery.numbering.library',
				title: 'Numbering Library',
				columns: 4,
				tileWidth: LIST_TILE.width,
				tileHeight: LIST_TILE.height,
				items: [
					none,
					...NUMBERING_LIBRARY.map(({ type, label }) => ({
						id: type,
						labelKey: `pptx.gallery.numbering.${type}`,
						label: `Numbered ${label}`,
						previewSvg: listTileSvg([1, 2, 3].map((n) => formatAutoNumber(type, n))),
						applied: element !== null && hasNumberingLibrary(element, type),
					})),
				],
			},
		],
	};
}

function apply(itemId: string, ctx: RibbonGalleryContext): RibbonGalleryApplyResult | null {
	const element = textElement(ctx);
	const known = NUMBERING_LIBRARY.some(({ type }) => type === itemId);
	if (!element || (!known && itemId !== 'none')) {
		return null;
	}
	return {
		kind: 'element',
		elementId: element.id,
		patch: applyNumberingLibrary(element, known ? itemId : null) as Partial<PptxElement>,
	};
}

export const NUMBERING_GALLERY: RibbonGalleryModule = { build, apply };
