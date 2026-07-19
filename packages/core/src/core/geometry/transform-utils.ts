/**
 * Framework-agnostic element transform utilities.
 *
 * Builds CSS `transform` strings from element properties such as
 * flip-horizontal, flip-vertical, and rotation. These utilities
 * are framework-agnostic and produce plain CSS transform strings
 * suitable for use with any rendering system.
 */
import type { PptxElement } from '../types';

/**
 * Build a CSS `transform` string combining an element's flip and rotation.
 *
 * The order is rotation THEN flips (`rotate(θ) scaleX(-1) scaleY(-1)`). With
 * CSS `transform-origin: center`, transforms apply right-to-left, so the flips
 * run first and the rotation second - matching OOXML `a:xfrm`, which mirrors the
 * shape within its box before rotating it. Emitting the flips first would
 * reflect the rotation direction for any flipped + rotated shape.
 *
 * @param element - The element whose `flipHorizontal`, `flipVertical`, and `rotation` are read.
 * @returns A CSS `transform` value (e.g. `"rotate(45deg) scaleX(-1)"`), or `undefined` if no transforms apply.
 */
export function getElementTransform(element: PptxElement): string | undefined {
	const transforms: string[] = [];
	if (element.rotation) {
		transforms.push(`rotate(${element.rotation}deg)`);
	}
	if (element.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (element.flipVertical) {
		transforms.push('scaleY(-1)');
	}
	return transforms.length > 0 ? transforms.join(' ') : undefined;
}

/**
 * Build a CSS `transform` string to compensate for element flipping on text.
 *
 * When a shape is flipped, the text inside it should remain readable (not
 * mirrored). This function generates the inverse flip transform to apply
 * to the text layer so it appears right-side-up. Unlike {@link getElementTransform},
 * this does not include rotation, which should only apply to the element itself.
 *
 * @param element - The element whose `flipHorizontal` and `flipVertical` are read.
 * @returns A CSS `transform` value to counteract flipping, or `undefined` if no flips are present.
 */
export function getTextCompensationTransform(element: PptxElement): string | undefined {
	const transforms: string[] = [];
	if (element.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (element.flipVertical) {
		transforms.push('scaleY(-1)');
	}
	return transforms.length > 0 ? transforms.join(' ') : undefined;
}
