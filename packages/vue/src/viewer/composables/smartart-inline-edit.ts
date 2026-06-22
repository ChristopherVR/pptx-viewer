import type { PptxSmartArtNode } from 'pptx-viewer-core';
import { computeInlineEditorRect, flattenNodes } from 'pptx-viewer-shared';
import type { InlineEditRect } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * smartart-inline-edit (Vue): reactive state + node-id mapping for on-canvas
 * SmartArt node text editing. Kept out of the SFC so the component stays thin
 * (CLAUDE.md <= 300 LOC) and the mapping is unit-testable.
 *
 * Pure rect projection and the no-op-commit guard live in the framework-agnostic
 * `pptx-viewer-shared` (`computeInlineEditorRect`, `shouldCommitSmartArtNodeText`)
 * and are reused here rather than reimplemented. This module adds only the
 * Vue-reactive edit state and the rendered-node -> source-node-id mapping.
 */

/**
 * Pair each rendered fallback-layout node with its source node id by matching
 * `flattenNodes` order: the per-family layout functions iterate the flattened
 * tree in the same order, so index `i` of the rendered list corresponds to
 * index `i` of the flattened source tree.
 */
export function nodeIdsInRenderOrder(roots: readonly PptxSmartArtNode[]): string[] {
	return flattenNodes(roots as PptxSmartArtNode[]).map((n) => n.id);
}

/**
 * Ids of flattened nodes that carry text, in order. Used by the drawing-shape
 * path, where each text-bearing shape corresponds positionally to a text-bearing
 * node (decoration shapes such as connectors carry no text and are skipped).
 */
export function textNodeIdsInRenderOrder(roots: readonly PptxSmartArtNode[]): string[] {
	return flattenNodes(roots as PptxSmartArtNode[])
		.filter((n) => (n.text ?? '').length > 0)
		.map((n) => n.id);
}

/** Project a node's on-screen rect into container-relative pixels for overlay. */
export function inlineEditorRect(
	nodeRect: InlineEditRect,
	containerRect: InlineEditRect,
): InlineEditRect {
	return computeInlineEditorRect(nodeRect, containerRect);
}

/** Reactive inline-edit state shared with the renderer template. */
export interface SmartArtInlineEditState {
	editingNodeId: Ref<string | null>;
	draft: Ref<string>;
	rect: Ref<InlineEditRect | null>;
	isEditing: ComputedRef<boolean>;
	begin: (nodeId: string, text: string, rect: InlineEditRect) => void;
	cancel: () => void;
}

/** Construct the reactive edit-state container (no commit policy here). */
export function useSmartArtInlineEditState(): SmartArtInlineEditState {
	const editingNodeId = ref<string | null>(null);
	const draft = ref('');
	const rect = ref<InlineEditRect | null>(null);

	function begin(nodeId: string, text: string, box: InlineEditRect): void {
		editingNodeId.value = nodeId;
		draft.value = text;
		rect.value = box;
	}

	function cancel(): void {
		editingNodeId.value = null;
		draft.value = '';
		rect.value = null;
	}

	const isEditing = computed(() => editingNodeId.value !== null);

	return { editingNodeId, draft, rect, isEditing, begin, cancel };
}
