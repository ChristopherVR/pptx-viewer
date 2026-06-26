import { computeInlineEditorRect } from 'pptx-viewer-shared';
import type { InlineEditRect } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

const NODE_ID_ATTR = 'data-smartart-node-id';

function findNodeEl(target: EventTarget | null): Element | null {
	let el = target instanceof Element ? target : null;
	while (el) {
		if (el.hasAttribute(NODE_ID_ATTR)) return el;
		el = el.parentElement;
	}
	return null;
}

export function useSmartArtHoverRect(containerRef: Ref<HTMLElement | null>) {
	const hoveredNodeId = ref<string | null>(null);
	const hoveredNodeRect = ref<InlineEditRect | null>(null);

	function onMouseMove(e: MouseEvent): void {
		const nodeEl = findNodeEl(e.target as EventTarget);
		const container = containerRef.value;
		if (!nodeEl || !container) {
			if (hoveredNodeId.value !== null) {
				hoveredNodeId.value = null;
				hoveredNodeRect.value = null;
			}
			return;
		}
		const id = nodeEl.getAttribute(NODE_ID_ATTR);
		if (id !== hoveredNodeId.value) {
			hoveredNodeId.value = id;
			hoveredNodeRect.value = id
				? computeInlineEditorRect(nodeEl.getBoundingClientRect(), container.getBoundingClientRect())
				: null;
		}
	}

	function onMouseLeave(): void {
		hoveredNodeId.value = null;
		hoveredNodeRect.value = null;
	}

	return { hoveredNodeId, hoveredNodeRect, onMouseMove, onMouseLeave };
}
