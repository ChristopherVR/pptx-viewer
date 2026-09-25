/**
 * Home > Bullets drop-down: PowerPoint's Bullet Library (None plus seven
 * character bullets), applied to every paragraph of the selected text-bearing
 * element through the ribbon's own list machinery (`list-library-apply.ts`).
 *
 * @module render/ribbon-galleries/bullets-gallery
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { RibbonGalleryModule } from './gallery-module';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryDescriptor,
	RibbonGalleryItem,
} from './gallery-types';
import { applyBulletLibrary, hasBulletLibrary } from './list-library-apply';
import { BULLET_LIBRARY } from './list-library-catalog';
import { LIST_TILE, listTileSvg } from './list-preview-svg';

function textElement(ctx: RibbonGalleryContext): PptxElement | null {
	return ctx.element && hasTextProperties(ctx.element) ? ctx.element : null;
}

function build(ctx: RibbonGalleryContext): RibbonGalleryDescriptor {
	const element = textElement(ctx);
	const none: RibbonGalleryItem = {
		id: 'none',
		labelKey: 'pptx.gallery.bullets.none',
		label: 'None',
		previewSvg: listTileSvg(null),
		applied: element !== null && hasBulletLibrary(element, null),
	};
	return {
		id: 'bullets',
		labelKey: 'pptx.gallery.bullets.title',
		label: 'Bullets',
		disabled: element === null,
		sections: [
			{
				id: 'library',
				titleKey: 'pptx.gallery.bullets.library',
				title: 'Bullet Library',
				columns: 4,
				tileWidth: LIST_TILE.width,
				tileHeight: LIST_TILE.height,
				items: [
					none,
					...BULLET_LIBRARY.map((spec) => ({
						id: spec.key,
						labelKey: `pptx.gallery.bullets.${spec.key}`,
						label: spec.label,
						previewSvg: listTileSvg([spec.preview, spec.preview, spec.preview]),
						applied: element !== null && hasBulletLibrary(element, spec),
					})),
				],
			},
		],
	};
}

function apply(itemId: string, ctx: RibbonGalleryContext): RibbonGalleryApplyResult | null {
	const element = textElement(ctx);
	const spec = BULLET_LIBRARY.find((candidate) => candidate.key === itemId);
	if (!element || (!spec && itemId !== 'none')) {
		return null;
	}
	return {
		kind: 'element',
		elementId: element.id,
		patch: applyBulletLibrary(element, spec ?? null) as Partial<PptxElement>,
	};
}

export const BULLETS_GALLERY: RibbonGalleryModule = { build, apply };
