import type { PptxElement } from 'pptx-viewer-core';
import type { AlignEdge, ToolbarActionId } from 'pptx-viewer-shared';
import { arrangeAlignAction, arrangeHomeControls } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { tagRibbonControl, tagRibbonGroup } from '../ribbon-tagging';
import type { ArrangeExtrasHandlers } from './arrange-extras';
import { createArrangeExtras } from './arrange-extras';
import type { MergeCropHandlers } from './merge-crop-controls';
import { createMergeCropControls } from './merge-crop-controls';
import { createSharedHomeStrip } from './shared-strip';

export interface ArrangeGroupHandlers extends ArrangeExtrasHandlers, MergeCropHandlers {
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
 * The ribbon Home tab's Arrange group: align, distribute, the format painter,
 * flip, group/ungroup, the outline-width spinner, z-order, duplicate and
 * delete, matching React's `ArrangeSection` control for control.
 *
 * There is no Cut / Copy / Paste here. This group used to carry a second copy
 * of the trio because React did; PowerPoint has exactly one Clipboard group,
 * so React dropped its duplicate and so does this. The Clipboard group
 * (`clipboard-group.ts`) is the one place each of those commands appears.
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
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.arrange.groupLabel');
	el.appendChild(label);

	const painter = makeButton(doc, {
		label: t('pptx.arrange.format'),
		icon: 'paintbrush',
		textLabel: t('pptx.arrange.format'),
		onClick: handlers.toggleFormatPainter,
	});
	painter.btn.title = t('pptx.arrange.formatPainter');

	const strips = {
		align: createSharedHomeStrip(doc, t, 'arrange-align', ({ part }) => {
			const action = arrangeAlignAction(part);
			if (action?.kind === 'align') {
				handlers.alignElements(action.edge);
			} else if (action?.kind === 'distribute') {
				handlers.distributeElements(action.axis);
			}
		}),
		flip: createSharedHomeStrip(doc, t, 'arrange-flip', ({ id }) =>
			id === 'home.arrange.flipHorizontal' ? handlers.flipHorizontal() : handlers.flipVertical(),
		),
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

	const extras = createArrangeExtras(doc, t, handlers);
	const mergeCrop = createMergeCropControls(doc, t, handlers, hiddenActions);

	tagRibbonControl(painter.btn, 'home.clipboard.formatPainter');
	row.append(
		strips.align.el,
		painter.btn,
		strips.flip.el,
		extras.el,
		mergeCrop.el,
		strips.order.el,
		strips.edit.el,
	);
	const syncStrips = (controls: ReturnType<typeof arrangeHomeControls>) => {
		for (const strip of Object.values(strips)) {
			strip.set(controls);
		}
	};
	syncStrips(arrangeHomeControls({ editable: false, hasSelection: false, canDistribute: false }));

	return {
		el,
		update({
			editable,
			hasSelection,
			formatPainterActive,
			selectedCount,
			selectionGroupable,
			selectedElement,
			canMergeShapes = false,
			canCrop = false,
			cropActive = false,
		}) {
			syncStrips(
				arrangeHomeControls({
					editable,
					hasSelection,
					canDistribute: selectedCount >= MIN_DISTRIBUTE_SELECTION,
				}),
			);
			extras.update({ editable, selectedCount, selectionGroupable, selectedElement });
			mergeCrop.update({ editable, canMergeShapes, canCrop, cropActive });
			painter.setDisabled(!editable || (!hasSelection && !formatPainterActive));
			painter.btn.dataset.active = String(formatPainterActive);
		},
	};
}
