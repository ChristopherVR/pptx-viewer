/**
 * Picture Format > Picture Styles: PowerPoint's 28 built-in picture styles
 * (catalogue: `picture-styles-catalog.ts`, captured from PowerPoint). A pick
 * replaces the picture's geometry, frame, effects and 3-D wholesale; see
 * `picture-styles-patch.ts`.
 *
 * @module render/ribbon-galleries/picture-styles-gallery
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { getShapeType } from 'pptx-viewer-core';

import type { RibbonGalleryModule } from './gallery-module';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryDescriptor,
} from './gallery-types';
import { PICTURE_STYLE_TILE, pictureStyleTileSvg } from './picture-style-tile-svg';
import { PICTURE_STYLES } from './picture-styles-catalog';
import { pictureStylePatch } from './picture-styles-patch';
import type { PictureStyleSpec } from './picture-styles-spec';

const KEY = 'pptx.gallery.pictureStyles';
const EMU_PER_PX = 9525;

function isPicture(element: PptxElement | null): element is PptxElement {
	return element?.type === 'image' || element?.type === 'picture';
}

function near(value: number | undefined, expected: number, tolerance = 0.05): boolean {
	return Math.abs((value ?? 0) - expected) <= tolerance;
}

/** True when `element` carries exactly what picking `spec` writes (geometry, frame and effects). */
export function pictureStyleMatches(spec: PictureStyleSpec, element: PptxElement): boolean {
	const shapeType = (element as { shapeType?: string }).shapeType ?? 'rect';
	if (getShapeType(shapeType) !== getShapeType(spec.geom)) {
		return false;
	}
	const style: ShapeStyle = (element as { shapeStyle?: ShapeStyle }).shapeStyle ?? {};
	const hasLine = style.strokeFillMode !== 'none' && (style.strokeWidth ?? 0) > 0;
	if (spec.line) {
		if (
			!hasLine ||
			!near(style.strokeWidth, spec.line.w / EMU_PER_PX) ||
			(style.strokeColor ?? '').toUpperCase() !== spec.line.color ||
			(style.compoundLine ?? undefined) !== spec.line.cmpd
		) {
			return false;
		}
	} else if (hasLine) {
		return false;
	}
	return (
		near(style.shadowBlur, (spec.outer?.blur ?? 0) / EMU_PER_PX) &&
		near(style.innerShadowBlur, (spec.innerBlur ?? 0) / EMU_PER_PX) &&
		near(style.reflectionStartOpacity, (spec.reflection?.stA ?? 0) / 100000, 0.005) &&
		near(style.softEdgeRadius, (spec.softEdge ?? 0) / EMU_PER_PX) &&
		near(style.shape3d?.bevelTopHeight, spec.sp3d?.bevelH ?? 0, 1) &&
		(style.scene3d?.cameraPreset ?? undefined) === spec.scene?.camera
	);
}

function build(ctx: RibbonGalleryContext): RibbonGalleryDescriptor {
	const element = isPicture(ctx.element) ? ctx.element : null;
	return {
		id: 'pictureStyles',
		labelKey: `${KEY}.title`,
		label: 'Picture Styles',
		disabled: element === null,
		sections: [
			{
				id: 'styles',
				columns: 7,
				tileWidth: PICTURE_STYLE_TILE.width,
				tileHeight: PICTURE_STYLE_TILE.height,
				items: PICTURE_STYLES.map((spec) => ({
					id: spec.key,
					labelKey: `${KEY}.${spec.key}`,
					label: spec.label,
					previewSvg: pictureStyleTileSvg(spec),
					applied: element !== null && pictureStyleMatches(spec, element),
				})),
			},
		],
	};
}

function apply(itemId: string, ctx: RibbonGalleryContext): RibbonGalleryApplyResult | null {
	const element = ctx.element;
	if (!isPicture(element)) {
		return null;
	}
	const spec = PICTURE_STYLES.find((candidate) => candidate.key === itemId);
	if (!spec) {
		return null;
	}
	return { kind: 'element', elementId: element.id, patch: pictureStylePatch(spec, element) };
}

export const PICTURE_STYLES_GALLERY: RibbonGalleryModule = { build, apply };
