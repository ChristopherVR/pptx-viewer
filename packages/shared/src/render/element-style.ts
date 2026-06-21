/**
 * Element CSS-style builders shared by the React, Vue, and Angular bindings.
 *
 * Holds the framework-agnostic, binding-identical portions of each binding's
 * element-style layer: the absolute container style (position / size / flip +
 * rotation transform / opacity / z-index / hidden) and the displayable
 * image-source resolution. Returns a neutral CSS map keyed in camelCase (both
 * Vue `CSSProperties` and Angular `[ngStyle]` accept camelCase keys), which
 * each binding casts to its framework's style type.
 *
 * The fill/stroke/geometry and text-block builders are intentionally NOT shared
 * here: the Vue and Angular implementations diverge (Vue resolves fills via the
 * shared structured fill/effect/3D builders and applies body insets; Angular
 * uses inline gradient/pattern/duotone builders and a different geometry
 * cascade), so each binding keeps its own to avoid changing render output.
 */
import type { PptxElement } from 'pptx-viewer-core';

import type { CssStyleMap } from './element-style-transform';

/** Map a number to a CSS pixel string. */
export function px(n: number): string {
	return `${n}px`;
}

/**
 * Absolute container style: position, size, rotation, flip, opacity, z-index.
 * Mirrors the essentials of the React `getContainerStyle`.
 */
export function getContainerStyle(el: PptxElement, zIndex: number): CssStyleMap {
	const transforms: string[] = [];
	if (el.rotation) {
		transforms.push(`rotate(${el.rotation}deg)`);
	}
	if (el.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (el.flipVertical) {
		transforms.push('scaleY(-1)');
	}

	const style: CssStyleMap = {
		position: 'absolute',
		left: px(el.x),
		top: px(el.y),
		width: px(el.width),
		height: px(el.height),
		zIndex,
		boxSizing: 'border-box',
	};
	if (transforms.length > 0) {
		style['transform'] = transforms.join(' ');
	}
	if (typeof el.opacity === 'number') {
		style['opacity'] = el.opacity;
	}
	if (el.hidden) {
		style['display'] = 'none';
	}
	return style;
}

/** Resolve a displayable image source for picture/image/media poster frames. */
export function getImageSrc(
	el: PptxElement,
	mediaDataUrls: Map<string, string>,
): string | undefined {
	if (el.type === 'picture' || el.type === 'image') {
		return el.imageData ?? (el.imagePath ? mediaDataUrls.get(el.imagePath) : undefined);
	}
	if (el.type === 'media') {
		return (
			el.posterFrameData ?? (el.posterFramePath ? mediaDataUrls.get(el.posterFramePath) : undefined)
		);
	}
	return undefined;
}
