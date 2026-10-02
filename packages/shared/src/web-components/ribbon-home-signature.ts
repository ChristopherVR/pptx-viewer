import { HOME_COLOUR_KEYS, homeLabel } from '../render';
import type { RibbonHomeControlSpec, RibbonHomeControlState, RibbonHomeViewState } from '../render';

/**
 * What a popup currently shows, as one string. A host re-assigns `state` after
 * every render; repainting an open popup each time would replace the node under
 * the pointer and swallow the click, so the popup repaints only when this changes.
 */
export function popupSignature(
	control: RibbonHomeControlSpec,
	current: RibbonHomeControlState | undefined,
	state: RibbonHomeViewState,
): string {
	const rows = (current?.items ?? control.items ?? []).map((row) => [
		row.value,
		row.label ?? homeLabel(state, row.labelKey ?? '', row.fallback ?? row.value),
		row.groupKey ? homeLabel(state, row.groupKey, row.group ?? '') : row.group,
		row.checked,
		row.disabled,
	]);
	const previews = current?.layouts?.previews;
	const previewPaths = previews instanceof Map ? [...previews.keys()] : Object.keys(previews ?? {});
	return JSON.stringify([
		current?.value,
		rows,
		current?.colour,
		current?.layouts && [current.layouts.layouts, current.layouts.current, previewPaths],
		[...HOME_COLOUR_KEYS, 'pptx.layoutGallery.empty', 'pptx.layoutGallery.current'].map((key) =>
			homeLabel(state, key, ''),
		),
	]);
}
