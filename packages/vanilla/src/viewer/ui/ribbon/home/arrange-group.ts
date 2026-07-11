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
 * The ribbon Home tab's Arrange group: z-order, align (to slide; see
 * `editor-arrange-mutations.alignToCanvas` docs), distribute (permanently
 * disabled today, needs multi-select), flip, group/ungroup, duplicate/delete.
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
		onClick: () => {
			/* needs multi-select; disabled, see module docs. */
		},
	});
	const distributeV = makeButton(doc, {
		label: t('pptx.arrange.distributeVertical'),
		icon: 'distribute-v',
		onClick: () => {
			/* needs multi-select; disabled, see module docs. */
		},
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
		update({ editable, hasSelection, isGroup }) {
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
			// Multi-selection only; unreachable under the single-selection model.
			distributeH.setDisabled(true);
			distributeV.setDisabled(true);
			group.setDisabled(true);
			ungroup.setDisabled(!canMut || !isGroup);
		},
	};
}
