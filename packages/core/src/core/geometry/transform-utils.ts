/**
 * Framework-agnostic element transform utilities.
 *
 * Builds CSS `transform` strings from element properties such as
 * flip-horizontal, flip-vertical, and rotation. These utilities
 * are framework-agnostic and produce plain CSS transform strings
 * suitable for use with any rendering system.
 */
import type { PptxElement } from "../types";

/**
 * Build a CSS `transform` string combining an element's flip and rotation.
 *
 * The order of transforms is: flipH, flipV, rotation — applied in that
 * sequence so that flips happen before rotation in the CSS transform chain.
 *
 * @param element - The element whose `flipHorizontal`, `flipVertical`, and `rotation` are read.
 * @returns A CSS `transform` value (e.g. `"scaleX(-1) rotate(45deg)"`), or `undefined` if no transforms apply.
 */
export function getElementTransform(element: PptxElement): string | undefined {
  const transforms: string[] = [];
  if (element.flipHorizontal) transforms.push("scaleX(-1)");
  if (element.flipVertical) transforms.push("scaleY(-1)");
  if (element.rotation) transforms.push(`rotate(${element.rotation}deg)`);
  return transforms.length > 0 ? transforms.join(" ") : undefined;
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
export function getTextCompensationTransform(
  element: PptxElement,
): string | undefined {
  const transforms: string[] = [];
  if (element.flipHorizontal) transforms.push("scaleX(-1)");
  if (element.flipVertical) transforms.push("scaleY(-1)");
  return transforms.length > 0 ? transforms.join(" ") : undefined;
}
