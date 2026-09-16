/**
 * Counter-transform for an image fill's pixel content when
 * `a:blipFill/@rotWithShape="0"`.
 *
 * OOXML's `rotWithShape` (also present on `a:gradFill`/`a:pattFill`) decides
 * whether a FILL follows the owning shape's own `a:xfrm` rotation/flip, or
 * stays fixed to the page frame while only the shape's GEOMETRY (its outline/
 * clip) still transforms. `fill-style.ts` already applies the rotation half of
 * this for gradients (`GradientRenderContext`/`adjustLinearGradientAngle`), by
 * adjusting the CSS gradient angle string. An image fill has no angle to
 * adjust: its content is a bitmap painted via `background-image`/`<img>`, so
 * the only way to keep it upright while the shape silhouette flips is a
 * literal DOM counter-transform on the content layer, canceling the parent
 * frame's own `transform`.
 *
 * This is the same shape as the existing `getTextCompensationTransform`
 * (a nested layer inside the shape's transformed frame gets its own,
 * independent `transform`), generalised to also invert rotation, which text
 * compensation intentionally does not (it only fixes reading direction for
 * flips).
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

/**
 * The exact algebraic inverse of {@link getElementTransform} (from
 * `element-style-transform.ts`), restricted to rotation + flip (no skew: a
 * skewed image fill with `rotWithShape="0"` is rare enough that an exact
 * shear inverse is not worth the added complexity yet).
 *
 * Derivation: `getElementTransform` emits the CSS list
 * `rotate(θ) scaleX(fx) scaleY(fy)`, i.e. the matrix product `R * Sx * Sy`
 * (CSS applies the RIGHTMOST function to the point first). Its inverse is
 * `Sy⁻¹ * Sx⁻¹ * R⁻¹ = Sy * Sx * R(-θ)` (flips are self-inverse), which as a
 * CSS list is `scaleY(fy) scaleX(fx) rotate(-θ deg)` - order matters, and
 * differs from the forward transform's order.
 *
 * @param element - The element whose `rotation`/`flipHorizontal`/`flipVertical` are read.
 * @returns A CSS transform string, or `undefined` if no counter-transform is needed.
 */
export function getFrameInverseTransform(
	element: Pick<PptxElement, 'rotation' | 'flipHorizontal' | 'flipVertical'>,
): string | undefined {
	const transforms: string[] = [];
	if (element.flipVertical) {
		transforms.push('scaleY(-1)');
	}
	if (element.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (element.rotation) {
		transforms.push(`rotate(${-element.rotation}deg)`);
	}
	return transforms.length > 0 ? transforms.join(' ') : undefined;
}

/**
 * CSS `transform` to apply to a picture's / image fill's CONTENT layer (the
 * `<img>`, or a `background-image` layer) so it renders upright/unmirrored,
 * fixed to the page frame, when the owning element's image fill explicitly
 * disables `rotWithShape` (`ShapeStyle.fillImageRotWithShape === false`).
 *
 * `undefined` (apply nothing; keep today's behaviour) when:
 *  - the element has no shape styling, or its fill is not an image fill with
 *    `rotWithShape` explicitly false (the default, `true`/unset, means the
 *    fill rotates/flips WITH the shape, which is what already happens when
 *    the content layer has no transform of its own), or
 *  - the shape has no rotation/flip to counteract in the first place.
 *
 * Callers MUST keep the shape's own geometry mask (clip-path/border-radius)
 * on the STATIONARY frame container (never on this same content layer): the
 * container inherits the shape's rotate/flip so the visible clipped silhouette
 * still matches PowerPoint, while the content layer's own counter-transform
 * only affects its pixels, not the ancestor's clip region. A binding whose
 * content layer sometimes also carries its own copy of that clip-path (as a
 * micro-optimisation for the untransformed case) must suppress that copy
 * whenever this function returns a value, or the clip-path would double-flip
 * along with the content.
 *
 * Not applied when the content layer already carries a competing transform
 * (an `a:srcRect` source-crop translate/scale, see `getImageFitStyle`): the
 * two transforms' origins conflict (crop uses `top left`, this uses the
 * element's own `center`), so combining them is left as a follow-up; the far
 * more common crop takes priority. Pass `hasCompetingTransform: true` to skip
 * in that case.
 *
 * @param element - The element to inspect (reads `element.shapeStyle.fillImageRotWithShape`).
 * @param hasCompetingTransform - True when the content layer already has its own transform for an `a:srcRect` crop.
 */
export function getImageFillCounterTransform(
	element: PptxElement,
	hasCompetingTransform = false,
): string | undefined {
	if (hasCompetingTransform || !hasShapeProperties(element)) {
		return undefined;
	}
	if (element.shapeStyle?.fillImageRotWithShape !== false) {
		return undefined;
	}
	return getFrameInverseTransform(element);
}
