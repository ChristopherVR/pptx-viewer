/**
 * Whether an element's resize/rotate/adjustment handles should be shown.
 *
 * Handles stay visible and draggable while the SAME element is actively
 * inline-edited (PowerPoint keeps a text box's handles live mid-edit; you can
 * grab a corner without first clicking out of edit mode). Every handle's own
 * hit target is a small button at the box's edge/corner with `stopPropagation`
 * on its own pointer-down, and the handle host itself is `pointer-events:
 * none` everywhere else, so leaving handles mounted during inline edit does
 * not capture clicks meant for caret placement in the interior of the text.
 * There is nothing to gate on an inline-edit flag here: only whether the
 * canvas is editable, the element is the (single) selection, and - for the
 * unclipped overlay variant - it isn't a connector/line, which renders its
 * own handles inside its own (already unclipped) element instead.
 */
export function shouldShowElementHandles(
	isEditableCanvas: boolean,
	isSelected: boolean,
	selectedCount: number,
): boolean {
	return isEditableCanvas && isSelected && selectedCount <= 1;
}
