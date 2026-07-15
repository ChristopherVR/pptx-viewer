import type { AlignEdge } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { IconName } from '../../icons';

export interface ArrangeGroupHandlers {
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
	alignElements(edge: AlignEdge): void;
	distributeElements(axis: 'horizontal' | 'vertical'): void;
	flipHorizontal(): void;
	flipVertical(): void;
	groupSelected(): void;
	ungroupSelected(): void;
	duplicate(): void;
	delete(): void;
}

export interface ArrangeGroupState {
	editable: boolean;
	hasSelection: boolean;
	isGroup: boolean;
	selectedCount: number;
}

export interface ArrangeGroup {
	el: HTMLElement;
	update(state: ArrangeGroupState): void;
}

const ALIGN_BUTTONS: ReadonlyArray<{ edge: AlignEdge; icon: IconName }> = [
	{ edge: 'left', icon: 'align-left' },
	{ edge: 'centerH', icon: 'align-center' },
	{ edge: 'right', icon: 'align-right' },
	{ edge: 'top', icon: 'align-top' },
	{ edge: 'middle', icon: 'align-middle' },
	{ edge: 'bottom', icon: 'align-bottom' },
];

/**
 * The ribbon Home tab's Arrange group: z-order, align, distribute, flip,
 * group/ungroup, duplicate/delete. Multi-selection enables distribute and
 * group using the same selection-count thresholds as React.
 */
export function createArrangeGroup(
	doc: Document,
	t: Translator,
	handlers: ArrangeGroupHandlers,
): ArrangeGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.ribbon.arrange');
	el.appendChild(label);

	const front = makeButton(doc, {
		label: t('pptx.arrange.bringToFront'),
		icon: 'bring-front',
		onClick: handlers.bringToFront,
	});
	const forward = makeButton(doc, {
		label: t('pptx.arrange.bringForward'),
		icon: 'bring-forward',
		onClick: handlers.bringForward,
	});
	const backward = makeButton(doc, {
		label: t('pptx.arrange.sendBackward'),
		icon: 'send-backward',
		onClick: handlers.sendBackward,
	});
	const back = makeButton(doc, {
		label: t('pptx.arrange.sendToBack'),
		icon: 'send-back',
		onClick: handlers.sendToBack,
	});

	const alignButtons = ALIGN_BUTTONS.map((def) =>
		makeButton(doc, {
			label: t('pptx.arrange.align', { direction: def.edge }),
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
	const group = makeButton(doc, {
		label: t('pptx.ribbon.group'),
		icon: 'group',
		onClick: handlers.groupSelected,
	});
	const ungroup = makeButton(doc, {
		label: t('pptx.ribbon.ungroup'),
		icon: 'ungroup',
		onClick: handlers.ungroupSelected,
	});
	const duplicate = makeButton(doc, {
		label: t('pptx.arrange.duplicate'),
		icon: 'duplicate',
		onClick: handlers.duplicate,
	});
	const del = makeButton(doc, {
		label: t('pptx.arrange.delete'),
		icon: 'trash',
		onClick: handlers.delete,
	});

	row.append(
		front.btn,
		forward.btn,
		backward.btn,
		back.btn,
		...alignButtons.map((b) => b.btn),
		distributeH.btn,
		distributeV.btn,
		flipH.btn,
		flipV.btn,
		group.btn,
		ungroup.btn,
		duplicate.btn,
		del.btn,
	);

	return {
		el,
		update({ editable, hasSelection, isGroup, selectedCount }) {
			const canMut = editable && hasSelection;
			for (const b of [
				front,
				forward,
				backward,
				back,
				...alignButtons,
				flipH,
				flipV,
				duplicate,
				del,
			]) {
				b.setDisabled(!canMut);
			}
			distributeH.setDisabled(!editable || selectedCount < 3);
			distributeV.setDisabled(!editable || selectedCount < 3);
			group.setDisabled(!editable || selectedCount < 2);
			ungroup.setDisabled(!canMut || !isGroup);
		},
	};
}
