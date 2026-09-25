import type { PptxElement } from 'pptx-viewer-core';
import type { AlignEdge, ToolbarActionId } from 'pptx-viewer-shared';
import { ALIGNMENT_LABEL_KEYS } from 'pptx-viewer-shared/i18n';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { IconName } from '../../icons';
import type { ArrangeExtrasHandlers } from './arrange-extras';
import { createArrangeExtras } from './arrange-extras';
import type { MergeCropHandlers } from './merge-crop-controls';
import { createMergeCropControls } from './merge-crop-controls';

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

/**
 * Keep the operation's edge separate from the shared label direction:
 * horizontal centering uses `centerH` internally and `center` for its label.
 */
const ALIGN_BUTTONS: ReadonlyArray<{ edge: AlignEdge; label: string; icon: IconName }> = [
	{ edge: 'left', label: 'left', icon: 'align-left' },
	{ edge: 'centerH', label: 'center', icon: 'align-center' },
	{ edge: 'right', label: 'right', icon: 'align-right' },
	{ edge: 'top', label: 'top', icon: 'align-top' },
	{ edge: 'middle', label: 'middle', icon: 'align-middle' },
	{ edge: 'bottom', label: 'bottom', icon: 'align-bottom' },
];

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
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.arrange.groupLabel');
	el.appendChild(label);

	const alignButtons = ALIGN_BUTTONS.map((def) =>
		makeButton(doc, {
			label: t(ALIGNMENT_LABEL_KEYS[def.label]),
			icon: def.icon,
			onClick: () => handlers.alignElements(def.edge),
		}),
	);
	const distributeH = makeButton(doc, {
		label: t('pptx.arrange.distributeHorizontal'),
		icon: 'distribute-h',
		onClick: () => handlers.distributeElements('horizontal'),
	});
	const distributeV = makeButton(doc, {
		label: t('pptx.arrange.distributeVertical'),
		icon: 'distribute-v',
		onClick: () => handlers.distributeElements('vertical'),
	});

	const painter = makeButton(doc, {
		label: t('pptx.arrange.format'),
		icon: 'copy',
		textLabel: t('pptx.arrange.format'),
		onClick: handlers.toggleFormatPainter,
	});
	painter.btn.title = t('pptx.arrange.formatPainter');

	const flipH = makeButton(doc, {
		label: t('pptx.arrange.flipH'),
		icon: 'flip-h',
		onClick: handlers.flipHorizontal,
	});
	const flipV = makeButton(doc, {
		label: t('pptx.arrange.flipV'),
		icon: 'flip-v',
		onClick: handlers.flipVertical,
	});

	const backward = makeButton(doc, {
		label: t('pptx.arrange.sendBackward'),
		icon: 'send-backward',
		onClick: handlers.sendBackward,
	});
	const forward = makeButton(doc, {
		label: t('pptx.arrange.bringForward'),
		icon: 'bring-forward',
		onClick: handlers.bringForward,
	});
	const back = makeButton(doc, {
		label: t('pptx.arrange.back'),
		icon: 'send-back',
		onClick: handlers.sendToBack,
	});
	back.btn.title = t('pptx.arrange.sendToBack');
	const front = makeButton(doc, {
		label: t('pptx.arrange.front'),
		icon: 'bring-front',
		onClick: handlers.bringToFront,
	});
	front.btn.title = t('pptx.arrange.bringToFront');

	const duplicate = makeButton(doc, {
		label: t('pptx.arrange.duplicate'),
		icon: 'duplicate',
		textLabel: t('pptx.arrange.duplicate'),
		onClick: handlers.duplicate,
	});
	const del = makeButton(doc, {
		label: t('pptx.arrange.delete'),
		icon: 'trash',
		textLabel: t('pptx.arrange.delete'),
		onClick: handlers.delete,
	});

	const extras = createArrangeExtras(doc, t, handlers);
	const mergeCrop = createMergeCropControls(doc, t, handlers, hiddenActions);

	row.append(
		...alignButtons.map((b) => b.btn),
		distributeH.btn,
		distributeV.btn,
		painter.btn,
		flipH.btn,
		flipV.btn,
		extras.el,
		mergeCrop.el,
		backward.btn,
		forward.btn,
		back.btn,
		front.btn,
		duplicate.btn,
		del.btn,
	);

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
			const canMut = editable && hasSelection;
			for (const b of [
				...alignButtons,
				flipH,
				flipV,
				backward,
				forward,
				back,
				front,
				duplicate,
				del,
			]) {
				b.setDisabled(!canMut);
			}
			extras.update({ editable, selectedCount, selectionGroupable, selectedElement });
			mergeCrop.update({ editable, canMergeShapes, canCrop, cropActive });
			painter.setDisabled(!editable || (!hasSelection && !formatPainterActive));
			painter.btn.dataset.active = String(formatPainterActive);
			distributeH.setDisabled(!editable || selectedCount < MIN_DISTRIBUTE_SELECTION);
			distributeV.setDisabled(!editable || selectedCount < MIN_DISTRIBUTE_SELECTION);
		},
	};
}
