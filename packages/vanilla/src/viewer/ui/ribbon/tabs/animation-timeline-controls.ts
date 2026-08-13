import type { PptxElementAnimation } from 'pptx-viewer-core';
import { animationEffectLabel } from 'pptx-viewer-shared';

import type { AnimationActions } from '../../../editor/editor-animation-actions';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';

export function timingField(doc: Document, text: string, value: number) {
	const label = doc.createElement('label');
	label.textContent = text;
	const input = doc.createElement('input');
	input.type = 'number';
	input.min = '0';
	input.max = '10000';
	input.step = '100';
	input.value = String(value);
	label.appendChild(input);
	return { label, input };
}

export function optionSelect(
	doc: Document,
	t: Translator,
	labelText: string,
	values: readonly string[],
) {
	const label = doc.createElement('label');
	label.textContent = t(labelText);
	const select = doc.createElement('select');
	// Named explicitly: the wrapping `<label>` would otherwise lend the select
	// its whole text content, which includes every option.
	select.setAttribute('aria-label', t(labelText));
	for (const value of values) {
		const option = doc.createElement('option');
		option.value = value;
		option.textContent = t(`${labelText}.${value}`);
		select.appendChild(option);
	}
	label.appendChild(select);
	return { label, select };
}

export function animationRow(
	doc: Document,
	t: Translator,
	animation: PptxElementAnimation,
	index: number,
	total: number,
	selectedElementId: string | undefined,
	editable: boolean,
	handlers: Pick<AnimationActions, 'reorderAnimation' | 'moveAnimation'>,
): HTMLElement {
	const row = createEl(doc, 'div', 'pptxv-animation-timeline-row');
	row.draggable = editable;
	row.addEventListener('dragstart', (event) =>
		event.dataTransfer?.setData('text/plain', animation.elementId),
	);
	row.addEventListener('dragover', (event) => event.preventDefault());
	row.addEventListener('drop', (event) => {
		event.preventDefault();
		const source = event.dataTransfer?.getData('text/plain');
		if (source) {
			handlers.moveAnimation(source, index);
		}
	});
	row.classList.toggle('is-selected', animation.elementId === selectedElementId);
	const label = createEl(doc, 'span', 'pptxv-animation-timeline-name');
	// Named through the shared resolver: the row used to print the raw preset
	// token (`fadeIn`) where the effect's name belongs.
	label.textContent = `${index + 1}. ${animationEffectLabel(animation, t)}`;
	const up = makeButton(doc, {
		label: t('pptx.animation.moveUp'),
		text: '↑',
		onClick: () => handlers.reorderAnimation(animation.elementId, 'up'),
	});
	const down = makeButton(doc, {
		label: t('pptx.animation.moveDown'),
		text: '↓',
		onClick: () => handlers.reorderAnimation(animation.elementId, 'down'),
	});
	up.setDisabled(!editable || index === 0);
	down.setDisabled(!editable || index === total - 1);
	row.append(label, up.btn, down.btn);
	return row;
}
