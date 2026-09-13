import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { buildInlineListStylePatch, getInlineEditorSelectionResult } from 'pptx-viewer-shared';
import type { InlineTextEditSnapshot } from 'pptx-viewer-shared';
import { computed, ref, shallowRef } from 'vue';

import { useInlineListSession } from './useInlineListSession';
import type { UseMasterViewWiringResult } from './useMasterViewWiring';

/** Owns the master overlay's current native text session and existing commit route. */
export function useMasterInlineEditing(
	state: () => UseMasterViewWiringResult,
	canEdit: () => boolean,
) {
	/** The shape whose text is being typed into, and the text so far. */
	const editingId = ref<string | null>(null);
	const editingText = ref('');
	const editingSnapshot = shallowRef<InlineTextEditSnapshot>();
	function formatText(updates: Partial<TextStyle>): void {
		const element = editingElement.value;
		const snapshot = editingSnapshot.value;
		if (
			!canEdit() ||
			!element ||
			!hasTextProperties(element) ||
			!snapshot?.textSegments ||
			snapshot.elementId !== element.id
		) {
			return;
		}
		const selection = getInlineEditorSelectionResult(snapshot.textSegments);
		if (selection.kind !== 'supported') {
			return;
		}
		const patch = buildInlineListStylePatch(
			{ ...element, text: snapshot.text, textSegments: snapshot.textSegments },
			updates,
			selection.selection,
		);
		if (
			!patch?.textSegments ||
			!listSession.format({ ...snapshot, textSegments: patch.textSegments })
		) {
			return;
		}
		state().onMasterViewElementUpdate(element.id, { text: snapshot.text, ...patch });
	}
	function readInlineSnapshot(): InlineTextEditSnapshot | undefined {
		const current = listSession.read();
		return (
			current ??
			(editingSnapshot.value?.elementId === editingId.value ? editingSnapshot.value : undefined)
		);
	}

	function updateEditingText(text: string, snapshot?: InlineTextEditSnapshot): void {
		editingText.value = text;
		editingSnapshot.value =
			snapshot?.elementId === editingId.value && snapshot.text === text ? snapshot : undefined;
	}

	const editingElement = computed<PptxElement | undefined>(() =>
		editingId.value
			? state().activeMasterViewElements.value.find((element) => element.id === editingId.value)
			: undefined,
	);
	const listSession = useInlineListSession(() => editingElement.value, cancelInlineEdit);

	/**
	 * Open the inline text editor on one master/layout shape.
	 *
	 * Reached by double-clicking the shape, the same gesture the ordinary canvas
	 * uses and the one svelte, vanilla and angular already offer here, and by the
	 * selection overlay's tap-an-already-selected request.
	 */
	function beginInlineEdit(id: string | null): void {
		if (!canEdit() || !id) {
			return;
		}
		const element = state().activeMasterViewElements.value.find((candidate) => candidate.id === id);
		if (!element || !hasTextProperties(element)) {
			return;
		}
		// An equation's text is the literal "[Equation]" placeholder, so committing
		// it would remap the runs from that and drop the OMML for good.
		if (element.textSegments?.some((segment) => segment.equationXml)) {
			return;
		}
		editingId.value = element.id;
		editingSnapshot.value = undefined;
		editingText.value = (element as { text?: string }).text ?? '';
	}

	function commitInlineEdit(): void {
		const id = editingId.value;
		const snapshot = editingSnapshot.value;
		editingId.value = null;
		if (id) {
			state().onMasterViewTextCommit(id, editingText.value, snapshot);
		}
		editingSnapshot.value = undefined;
	}

	function cancelInlineEdit(): void {
		editingId.value = null;
		editingSnapshot.value = undefined;
	}

	return {
		editingId,
		editingText,
		editingElement,
		listSession,
		formatText,
		updateEditingText,
		beginInlineEdit,
		commitInlineEdit,
		cancelInlineEdit,
		readInlineSnapshot,
	};
}
