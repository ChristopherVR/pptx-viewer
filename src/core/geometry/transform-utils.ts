/**
 * Framework-agnostic element transform utilities.
 */
import type { PptxElement } from "../types";

/**
 * Build a CSS `transform` string for an element's flip and rotation.
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
 */
export function getTextCompensationTransform(
  element: PptxElement,
): string | undefined {
  const transforms: string[] = [];
  if (element.flipHorizontal) transforms.push("scaleX(-1)");
  if (element.flipVertical) transforms.push("scaleY(-1)");
  return transforms.length > 0 ? transforms.join(" ") : undefined;
}
