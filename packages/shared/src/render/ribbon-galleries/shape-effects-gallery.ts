/**
 * Shape Format > Shape Effects (and Picture Format > Picture Effects): the
 * Shadow, Reflection, Glow, Soft Edges, Bevel and 3-D Rotation menus.
 *
 * A pick edits ONLY its own effect family on the element's `shapeStyle`
 * (see `shape-effects-style.ts`); the catalogue is PowerPoint's own COM
 * capture (see `shape-effects-catalog.ts`).
 *
 * @module render/ribbon-galleries/shape-effects-gallery
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import type { RibbonGalleryModule } from './gallery-module';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryDescriptor,
} from './gallery-types';
import { EFFECT_TILE } from './shape-effects-entries';
import type { ShapeEffectEntry } from './shape-effects-entries';
import { shapeEffectSections } from './shape-effects-sections';

function findEntry(itemId: string, ctx: RibbonGalleryContext): ShapeEffectEntry | undefined {
	for (const section of shapeEffectSections(ctx)) {
		const entry = section.entries.find((candidate) => candidate.id === itemId);
		if (entry) {
			return entry;
		}
	}
	return undefined;
}

function build(ctx: RibbonGalleryContext): RibbonGalleryDescriptor {
	const element = ctx.element;
	const style = element && hasShapeProperties(element) ? (element.shapeStyle ?? {}) : undefined;
	return {
		id: 'shapeEffects',
		labelKey: 'pptx.gallery.shapeEffects.title',
		label: 'Shape Effects',
		disabled: style === undefined,
		sections: shapeEffectSections(ctx).map((section) => ({
			id: section.id,
			titleKey: `pptx.gallery.shapeEffects.section.${section.id}`,
			title: section.title,
			columns: section.columns,
			tileWidth: EFFECT_TILE.width,
			tileHeight: EFFECT_TILE.height,
			items: section.entries.map((entry) => ({
				id: entry.id,
				labelKey: entry.labelKey,
				...(entry.labelParams && { labelParams: entry.labelParams }),
				label: entry.label,
				previewSvg: entry.preview(),
				applied: style !== undefined && entry.matches(style),
			})),
		})),
	};
}

function apply(itemId: string, ctx: RibbonGalleryContext): RibbonGalleryApplyResult | null {
	const element = ctx.element;
	if (!element || !hasShapeProperties(element)) {
		return null;
	}
	const entry = findEntry(itemId, ctx);
	if (!entry) {
		return null;
	}
	return {
		kind: 'element',
		elementId: element.id,
		patch: { shapeStyle: entry.edit(element.shapeStyle ?? {}) } as Partial<PptxElement>,
	};
}

export const SHAPE_EFFECTS_GALLERY: RibbonGalleryModule = { build, apply };
