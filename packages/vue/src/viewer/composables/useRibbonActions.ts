import { hasTextProperties } from 'pptx-viewer-core';
import type {
	PptxElement,
	PptxSlide,
	PptxTableCellStyle,
	TablePptxElement,
	TextStyle,
} from 'pptx-viewer-core';
import type { AlignEdge, ChangeCaseMode } from 'pptx-viewer-shared';
import { transformTextCase } from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { ShapePreset } from '../components/EditorToolbar.vue';
import type {
	SupportedShapeType,
	TableCellEditorState,
	ViewerMode,
} from '../components/ribbon/ribbon-types';
import type { TableSelectionState } from './table-selection';
import type { EditorOperations } from './useEditorOperations';

export interface UseRibbonActionsInput {
	canEdit: () => boolean;
	presenting: Ref<boolean>;
	showMasterView: Ref<boolean>;
	tableSelection: Ref<TableSelectionState | null>;
	selectedElements: ComputedRef<PptxElement[]>;
	selectedElementIds: Ref<string[]>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	activeSlideIndex: Ref<number>;
	slides: Ref<PptxSlide[]>;
	pushHistory: () => void;
	ops: EditorOperations;
}

/** Ribbon `align` key → shared `AlignEdge`. */
export const RIBBON_ALIGN: Record<string, AlignEdge> = {
	left: 'left',
	center: 'centerH',
	right: 'right',
	top: 'top',
	middle: 'middle',
	bottom: 'bottom',
};

/** Narrow a ribbon `SupportedShapeType` to the EditorToolbar's `ShapePreset`. */
export function toShapePreset(t: SupportedShapeType): ShapePreset {
	return t === 'ellipse' || t === 'roundRect' || t === 'triangle' ? t : 'rect';
}

/**
 * useRibbonActions: the derived ribbon mode plus the ribbon-only editing helpers
 * (cell/text-style application, flip, front/back z-order). Extracted verbatim
 * from `PowerPointViewer.vue`; the big `ribbonProps` adapter stays in the SFC.
 */
export function useRibbonActions(input: UseRibbonActionsInput) {
	const {
		canEdit,
		presenting,
		showMasterView,
		tableSelection,
		selectedElements,
		selectedElementIds,
		activeSlide,
		activeSlideIndex,
		slides,
		pushHistory,
		ops,
	} = input;

	const ribbonMode = computed<ViewerMode>(() =>
		presenting.value ? 'present' : showMasterView.value ? 'master' : canEdit() ? 'edit' : 'preview',
	);

	/**
	 * The active table cell selection remapped to the ribbon's `TableCellEditorState`
	 * shape, but only when the selected element is the table that owns the selection.
	 * Feeds the ribbon Text section so cell-cell toggles read the cell's own style.
	 */
	const activeTableSelection = computed<TableCellEditorState | null>(() => {
		const sel = tableSelection.value;
		const el = selectedElements.value[0];
		if (!sel || !el || el.type !== 'table' || sel.elementId !== el.id) {
			return null;
		}
		return { elementId: sel.elementId, rowIndex: sel.rowIndex, columnIndex: sel.columnIndex };
	});

	/** Apply a text-style delta to the selected table cell (ribbon Text section). */
	function applyCellTextStyle(el: TablePptxElement, updates: Partial<TextStyle>): void {
		const sel = tableSelection.value;
		if (!canEdit() || !el.tableData || !sel || sel.elementId !== el.id) {
			return;
		}
		const { rowIndex, columnIndex } = sel;
		const rows = el.tableData.rows.map((row, ri) =>
			ri !== rowIndex
				? row
				: {
						...row,
						cells: row.cells.map((c, ci) =>
							ci !== columnIndex
								? c
								: { ...c, style: { ...c.style, ...updates } as PptxTableCellStyle },
						),
					},
		);
		ops.updateElement(el.id, { tableData: { ...el.tableData, rows } } as Partial<PptxElement>);
	}

	function ribbonUpdateTextStyle(updates: Partial<TextStyle>): void {
		const id = selectedElementIds.value[0];
		if (!id) {
			return;
		}
		const el = activeSlide.value?.elements.find((e) => e.id === id);
		if (!el) {
			return;
		}
		// Tables route to the selected cell's style; other elements to their textStyle.
		if (el.type === 'table') {
			applyCellTextStyle(el, updates);
			return;
		}
		if (!hasTextProperties(el)) {
			return;
		}
		const textStyle = { ...el.textStyle, ...updates };
		const segments =
			el.textSegments && el.textSegments.length > 0
				? el.textSegments.map((s) => ({ ...s, style: { ...s.style, ...updates } }))
				: undefined;
		ops.updateElement(
			id,
			(segments ? { textStyle, textSegments: segments } : { textStyle }) as Partial<PptxElement>,
		);
	}

	/**
	 * Rewrite the selected element's text characters (ribbon Aa "Change Case"
	 * dropdown). Unlike `ribbonUpdateTextStyle`, this mutates content, not style,
	 * so table cells (plain-text only) are left alone rather than getting a
	 * misleading `textCaps` style hint.
	 */
	function ribbonUpdateTextCase(mode: ChangeCaseMode): void {
		const id = selectedElementIds.value[0];
		if (!id) {
			return;
		}
		const el = activeSlide.value?.elements.find((e) => e.id === id);
		if (!el || !hasTextProperties(el)) {
			return;
		}
		const updates: Partial<PptxElement> = {};
		if (el.textSegments && el.textSegments.length > 0) {
			(updates as { textSegments?: unknown }).textSegments = el.textSegments.map((s) =>
				s.isParagraphBreak || s.text === '\n' ? s : { ...s, text: transformTextCase(s.text, mode) },
			);
		}
		if (typeof el.text === 'string') {
			(updates as { text?: string }).text = transformTextCase(el.text, mode);
		}
		ops.updateElement(id, updates);
	}

	/** Flip the selected elements horizontally / vertically as one history entry. */
	function ribbonFlip(direction: 'horizontal' | 'vertical'): void {
		const ids = new Set(selectedElementIds.value);
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (ids.size === 0 || !slide) {
			return;
		}
		pushHistory();
		const nextElements = slide.elements.map((el) => {
			if (!ids.has(el.id)) {
				return el;
			}
			return direction === 'horizontal'
				? { ...el, flipHorizontal: !el.flipHorizontal }
				: { ...el, flipVertical: !el.flipVertical };
		});
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, elements: nextElements };
		slides.value = nextSlides;
	}

	/** Move the first selected element to the front/back of the slide z-order. */
	function ribbonMoveToEdge(dir: string): void {
		const id = selectedElementIds.value[0];
		const slide = activeSlide.value;
		if (!id || !slide) {
			return;
		}
		const toFront = dir === 'front' || dir === 'forward' || dir === 'up';
		ops.reorder(id, toFront ? slide.elements.length - 1 : 0);
	}

	return {
		ribbonMode,
		activeTableSelection,
		ribbonUpdateTextStyle,
		ribbonUpdateTextCase,
		ribbonFlip,
		ribbonMoveToEdge,
	};
}
