import { computeInlineEditorRect } from 'pptx-viewer-shared';
import type { InlineEditRect } from 'pptx-viewer-shared';
import { onUnmounted, ref } from 'vue';
import type { Ref } from 'vue';

const NODE_ID_ATTR = 'data-smartart-node-id';

/** Grace period (ms) before clearing hover state once the pointer leaves the
 * node, so it can cross the small visual gap to a popover anchored to the
 * node (e.g. the fill-colour style bar) without the popover unmounting first. */
const HIDE_GRACE_MS = 150;

function findNodeEl(target: EventTarget | null): Element | null {
	let el = target instanceof Element ? target : null;
	while (el) {
		if (el.hasAttribute(NODE_ID_ATTR)) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

export function useSmartArtHoverRect(containerRef: Ref<HTMLElement | null>) {
	const hoveredNodeId = ref<string | null>(null);
	const hoveredNodeRect = ref<InlineEditRect | null>(null);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;

	function cancelPendingHide(): void {
		if (hideTimeout !== null) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}
	}

	/**
	 * `ignoreEl`, when given, is a popover anchored to the hovered node (e.g.
	 * the style bar) - the pointer sitting over it should not clear the hover
	 * state, since the popover would then unmount out from under the pointer.
	 */
	function onMouseMove(e: MouseEvent, ignoreEl?: HTMLElement | null): void {
		const nodeEl = findNodeEl(e.target as EventTarget);
		const container = containerRef.value;
		if (nodeEl && container) {
			cancelPendingHide();
			const id = nodeEl.getAttribute(NODE_ID_ATTR);
			if (id !== hoveredNodeId.value) {
				hoveredNodeId.value = id;
				hoveredNodeRect.value = id
					? computeInlineEditorRect(
							nodeEl.getBoundingClientRect(),
							container.getBoundingClientRect(),
						)
					: null;
			}
			return;
		}
		if (ignoreEl && e.target instanceof Node && ignoreEl.contains(e.target)) {
			cancelPendingHide();
			return;
		}
		cancelPendingHide();
		hideTimeout = setTimeout(() => {
			hoveredNodeId.value = null;
			hoveredNodeRect.value = null;
			hideTimeout = null;
		}, HIDE_GRACE_MS);
	}

	function onMouseLeave(): void {
		cancelPendingHide();
		hoveredNodeId.value = null;
		hoveredNodeRect.value = null;
	}

	onUnmounted(cancelPendingHide);

	return { hoveredNodeId, hoveredNodeRect, onMouseMove, onMouseLeave };
}
