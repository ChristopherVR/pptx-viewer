import type { MergeShapeOperation, PptxElement } from 'pptx-viewer-core';
import type { AlignEdge, ToolbarActionId } from 'pptx-viewer-shared';
import {
	arrangeAlignAction,
	arrangeHomeControls,
	arrangePainterHomeControls,
	arrangeShapeHomeControls,
	canGroupSelection,
	canSetStrokeWidth,
	canUngroupSelection,
	isActionHidden,
	parseCropValue,
	strokeWidthOf,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { tagRibbonGroup } from '../ribbon-tagging';
import { createSharedHomeStrip } from './shared-strip';

export interface ArrangeGroupHandlers {
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
	alignElements(edge: AlignEdge): void;
	distributeElements(axis: 'horizontal' | 'vertical'): void;
	flipHorizontal(): void;
	flipVertical(): void;
	toggleFormatPainter(): void;
	duplicate(): void;
	delete(): void;
	groupSelected(): void;
	ungroupSelected(): void;
	setStrokeWidth(width: number): void;
	mergeShapes(operation: MergeShapeOperation): void;
	toggleCropMode(): void;
	cropToAspect(ratioWidth: number, ratioHeight: number): void;
	cropFill(): void;
	cropFit(): void;
}

export interface ArrangeGroupState {
	editable: boolean;
	hasSelection: boolean;
	formatPainterActive: boolean;
	selectedCount: number;
	/** Whether every selected element allows `a:spLocks/@noGrp` grouping. */
	selectionGroupable: boolean;
	selectedElement: PptxElement | undefined;
	/** Shared `canMergeShapes` over the selection (Merge Shapes). */
	canMergeShapes?: boolean;
	/** A single croppable picture is selected (Crop). */
	canCrop?: boolean;
	/** Picture crop mode is on. */
	cropActive?: boolean;
}

export interface ArrangeGroup {
	el: HTMLElement;
	update(state: ArrangeGroupState): void;
}

/** Multi-selection threshold below which Distribute cannot do anything useful. */
const MIN_DISTRIBUTE_SELECTION = 3;

/**
 * The ribbon Home tab's Arrange group: six shared strips (align and
 * distribute, the Format Painter pill, flip, group/merge/crop/outline width,
 * z-order, duplicate and delete) whose intents run the native handlers.
 */
export function createArrangeGroup(
	doc: Document,
	t: Translator,
	handlers: ArrangeGroupHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): ArrangeGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	el.dataset.pptxChrome = 'home-group';
	tagRibbonGroup(el, 'home.arrange');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	row.dataset.pptxChrome = 'arrange-controls';
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.arrange.groupLabel');
	el.append(row, label);

	const strips = {
		align: createSharedHomeStrip(doc, t, 'arrange-align', ({ part }) => {
			const action = arrangeAlignAction(part);
			if (action?.kind === 'align') {
				handlers.alignElements(action.edge);
			} else if (action?.kind === 'distribute') {
				handlers.distributeElements(action.axis);
			}
		}),
		painter: createSharedHomeStrip(doc, t, 'arrange-painter', () => handlers.toggleFormatPainter()),
		flip: createSharedHomeStrip(doc, t, 'arrange-flip', ({ id }) =>
			id === 'home.arrange.flipHorizontal' ? handlers.flipHorizontal() : handlers.flipVertical(),
		),
		shape: createSharedHomeStrip(doc, t, 'arrange-shape', ({ id, value }) => {
			if (id === 'home.arrange.group') {
				handlers.groupSelected();
			} else if (id === 'home.arrange.ungroup') {
				handlers.ungroupSelected();
			} else if (id === 'home.arrange.mergeShapes') {
				handlers.mergeShapes(value as MergeShapeOperation);
			} else if (id === 'home.arrange.outlineWidth') {
				handlers.setStrokeWidth(Number(value));
			} else if (value === undefined) {
				handlers.toggleCropMode();
			} else {
				const crop = parseCropValue(value);
				if (crop?.kind === 'aspect') {
					handlers.cropToAspect(crop.width, crop.height);
				} else if (crop?.kind === 'fill') {
					handlers.cropFill();
				} else if (crop?.kind === 'fit') {
					handlers.cropFit();
				}
			}
		}),
		order: createSharedHomeStrip(doc, t, 'arrange-order', ({ id }) =>
			({
				'home.arrange.sendBackward': handlers.sendBackward,
				'home.arrange.bringForward': handlers.bringForward,
				'home.arrange.sendToBack': handlers.sendToBack,
				'home.arrange.bringToFront': handlers.bringToFront,
			})[id as 'home.arrange.sendBackward']?.(),
		),
		edit: createSharedHomeStrip(doc, t, 'arrange-edit', ({ id }) =>
			id === 'home.arrange.duplicate' ? handlers.duplicate() : handlers.delete(),
		),
	};
	// Presses inside the crop controls own crop mode's toggle, so they must not also commit it.
	strips.shape.el.anchor('home.arrange.crop')?.setAttribute('data-pptx-crop-controls', 'true');
	row.append(
		strips.align.el,
		strips.painter.el,
		strips.flip.el,
		strips.shape.el,
		strips.order.el,
		strips.edit.el,
	);

	const render = (state: ArrangeGroupState) => {
		const { editable, hasSelection, formatPainterActive, selectedElement } = state;
		const common = arrangeHomeControls({
			editable,
			hasSelection,
			canDistribute: state.selectedCount >= MIN_DISTRIBUTE_SELECTION,
		});
		for (const key of ['align', 'flip', 'order', 'edit'] as const) {
			strips[key].set(common);
		}
		strips.painter.set(
			arrangePainterHomeControls({
				editable,
				active: formatPainterActive,
				canFormatPaint: hasSelection,
				show: true,
			}),
		);
		const element = selectedElement ?? null;
		strips.shape.set(
			arrangeShapeHomeControls({
				editable,
				canGroup: canGroupSelection(editable, state.selectedCount, state.selectionGroupable),
				canUngroup: canUngroupSelection(editable, element),
				canMerge: Boolean(state.canMergeShapes),
				canCrop: Boolean(state.canCrop) || Boolean(state.cropActive),
				cropActive: Boolean(state.cropActive),
				canStrokeWidth: canSetStrokeWidth(editable, element),
				strokeWidth: strokeWidthOf(element),
				hideMerge: isActionHidden('mergeShapes', hiddenActions),
				hideCrop: isActionHidden('crop', hiddenActions),
			}),
		);
	};
	render({
		editable: false,
		hasSelection: false,
		formatPainterActive: false,
		selectedCount: 0,
		selectionGroupable: true,
		selectedElement: undefined,
	});

	return { el, update: render };
}
