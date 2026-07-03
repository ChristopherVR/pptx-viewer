import type { PptxElement } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { applyFormatToElement, copyFormatFromElement, hasCopyableFormat } from './format-painter';
import type { CopiedFormat } from './format-painter';
import type { EditorOperations } from './useEditorOperations';

export interface UseFormatPainterInput {
	selectedElements: ComputedRef<PptxElement[]>;
	findActiveElement: (id: string) => PptxElement | undefined;
	ops: EditorOperations;
}

export interface UseFormatPainterResult {
	formatPainterActive: Ref<boolean>;
	canActivateFormatPainter: ComputedRef<boolean>;
	toggleFormatPainter: () => void;
	cancelFormatPainter: () => void;
	applyFormatToTarget: (id: string) => void;
}

/**
 * useFormatPainter: Home ▸ Format Painter. Arm by copying the selected
 * element's format; the next element click applies it (or, on an
 * empty-canvas click, is simply disarmed). Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useFormatPainter(input: UseFormatPainterInput): UseFormatPainterResult {
	const { selectedElements, findActiveElement, ops } = input;

	const formatPainterActive = ref(false);
	const copiedFormat = ref<CopiedFormat | null>(null);
	const canActivateFormatPainter = computed(
		() => selectedElements.value.length === 1 && hasCopyableFormat(selectedElements.value[0]),
	);

	function toggleFormatPainter(): void {
		if (formatPainterActive.value) {
			cancelFormatPainter();
			return;
		}
		const source = selectedElements.value[0];
		if (!source || !hasCopyableFormat(source)) {
			return;
		}
		copiedFormat.value = copyFormatFromElement(source);
		formatPainterActive.value = true;
	}
	function cancelFormatPainter(): void {
		formatPainterActive.value = false;
		copiedFormat.value = null;
	}
	/** Apply the copied format to a target element (shape/text style only). */
	function applyFormatToTarget(id: string): void {
		const format = copiedFormat.value;
		const target = findActiveElement(id);
		if (!format || !target) {
			return;
		}
		const updated = applyFormatToElement(target, format) as unknown as Record<string, unknown>;
		const patch: Record<string, unknown> = {};
		if (format.shapeStyle && updated.shapeStyle !== undefined) {
			patch.shapeStyle = updated.shapeStyle;
		}
		if (format.textStyle && updated.textStyle !== undefined) {
			patch.textStyle = updated.textStyle;
		}
		if (Object.keys(patch).length > 0) {
			ops.updateElement(id, patch as Partial<PptxElement>);
		}
	}

	return {
		formatPainterActive,
		canActivateFormatPainter,
		toggleFormatPainter,
		cancelFormatPainter,
		applyFormatToTarget,
	};
}
