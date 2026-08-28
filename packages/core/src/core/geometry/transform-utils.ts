/**
 * Framework-agnostic element transform utilities.
 *
 * Builds CSS `transform` strings from element properties such as
 * flip-horizontal, flip-vertical, and rotation. These utilities
 * are framework-agnostic and produce plain CSS transform strings
 * suitable for use with any rendering system.
 */
import type { PptxElement, TextOrientationMatrix } from '../types';

export const TEXT_ORIENTATION_IDENTITY: TextOrientationMatrix = [1, 0, 0, 1];

export function isTextOrientationMatrix(value: unknown): value is TextOrientationMatrix {
	return (
		Array.isArray(value) &&
		value.length === 4 &&
		value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
	);
}

export function multiplyTextOrientationMatrices(
	left: TextOrientationMatrix,
	right: TextOrientationMatrix,
): TextOrientationMatrix {
	return [
		left[0] * right[0] + left[2] * right[1],
		left[1] * right[0] + left[3] * right[1],
		left[0] * right[2] + left[2] * right[3],
		left[1] * right[2] + left[3] * right[3],
	];
}

export function getElementOrientationMatrix(
	element: Pick<PptxElement, 'rotation' | 'flipHorizontal' | 'flipVertical'>,
): TextOrientationMatrix {
	const radians = ((Number(element.rotation) || 0) * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const rotation: TextOrientationMatrix = [cosine, sine, -sine, cosine];
	const flip: TextOrientationMatrix = [
		element.flipHorizontal ? -1 : 1,
		0,
		0,
		element.flipVertical ? -1 : 1,
	];
	return multiplyTextOrientationMatrices(rotation, flip);
}

function textOrientationAngleScore(matrix: TextOrientationMatrix): number {
	return Math.abs(Math.atan2(matrix[1], matrix[0]));
}

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
	const normalizedRotation = (((Number(element.rotation) || 0) % 360) + 360) % 360;
	const swapFlipAxis =
		normalizedRotation > 90 &&
		normalizedRotation < 270 &&
		element.flipHorizontal !== element.flipVertical;
	const compensateHorizontal = swapFlipAxis ? element.flipVertical : element.flipHorizontal;
	const compensateVertical = swapFlipAxis ? element.flipHorizontal : element.flipVertical;
	if (compensateHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (compensateVertical) {
		transforms.push('scaleY(-1)');
	}

	const ancestorGroupTransform =
		'textStyle' in element ? element.textStyle?.ancestorGroupTransform : undefined;
	if (isTextOrientationMatrix(ancestorGroupTransform)) {
		const localCompensation: TextOrientationMatrix = [
			compensateHorizontal ? -1 : 1,
			0,
			0,
			compensateVertical ? -1 : 1,
		];
		const visibleTransform = multiplyTextOrientationMatrices(
			multiplyTextOrientationMatrices(ancestorGroupTransform, getElementOrientationMatrix(element)),
			localCompensation,
		);
		const determinant =
			visibleTransform[0] * visibleTransform[3] - visibleTransform[1] * visibleTransform[2];
		if (determinant < -1e-6) {
			const horizontalCandidate = multiplyTextOrientationMatrices(visibleTransform, [-1, 0, 0, 1]);
			const verticalCandidate = multiplyTextOrientationMatrices(visibleTransform, [1, 0, 0, -1]);
			transforms.push(
				textOrientationAngleScore(horizontalCandidate) <=
					textOrientationAngleScore(verticalCandidate)
					? 'scaleX(-1)'
					: 'scaleY(-1)',
			);
		}
	}
	return transforms.length > 0 ? transforms.join(' ') : undefined;
}
