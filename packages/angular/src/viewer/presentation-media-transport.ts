/**
 * presentation-media-transport.ts: `ppaction://media` support for the running
 * slide show.
 *
 * A click carrying this action targets the CLICKED element's own embedded
 * `<video>`/`<audio>`, as opposed to a `media` element's normal inline
 * transport controls. The element renderers stamp `data-element-id` on every
 * mounted element (see `presentation-stage-animator.ts`'s `closestElementId`),
 * so toggling playback is a scoped `querySelector` rather than new per-element
 * plumbing.
 *
 * @module viewer/presentation-media-transport
 */

/**
 * Toggle play/pause on the `<video>`/`<audio>` embedded in `elementId`'s
 * rendered subtree, scoped to `root` (the presentation stage). A missing
 * element or one carrying no playable media is a silent no-op.
 */
export function toggleStageElementMedia(
	root: HTMLElement | null | undefined,
	elementId: string | undefined,
): void {
	if (!root || !elementId) {
		return;
	}
	const media = root.querySelector<HTMLMediaElement>(
		`[data-element-id="${cssEscape(elementId)}"] video, [data-element-id="${cssEscape(elementId)}"] audio`,
	);
	if (!media) {
		return;
	}
	if (media.paused) {
		void media.play().catch(() => {
			/* ignore autoplay restrictions */
		});
	} else {
		media.pause();
	}
}

/** Minimal `CSS.escape` fallback: `data-element-id` values are core-generated ids, never untrusted markup. */
function cssEscape(value: string): string {
	return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
		? CSS.escape(value)
		: value.replace(/"/gu, '\\"');
}
