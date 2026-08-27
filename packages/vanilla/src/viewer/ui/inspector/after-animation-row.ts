import type { PptxAfterAnimationAction } from 'pptx-viewer-core';
import { AFTER_ANIMATION_VALUES } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

export interface AfterAnimationRowState {
	action: PptxAfterAnimationAction;
	color: string | undefined;
	editable: boolean;
}

export interface AfterAnimationRow {
	el: HTMLElement;
	update(state: AfterAnimationRowState): void;
}

/**
 * The animation panel's "after animation" row: dim to colour, hide after
 * animation, hide on next click, or don't dim.
 */
export function createAfterAnimationRow(
	doc: Document,
	t: Translator,
	onAction: (action: PptxAfterAnimationAction) => void,
	onColor: (color: string) => void,
): AfterAnimationRow {
	const el = createEl(doc, 'div', 'pptxv-after-animation-row');
	const actionLabel = createEl(doc, 'label');
	const actionCaption = createEl(doc, 'span');
	actionCaption.textContent = t('pptx.animation.afterAnimation');

	const select = doc.createElement('select');
	select.setAttribute('aria-label', t('pptx.animation.afterAnimation'));
	for (const value of AFTER_ANIMATION_VALUES) {
		const option = doc.createElement('option');
		option.value = value;
		option.textContent = t(`pptx.animation.afterAnimation.${value}`);
		select.appendChild(option);
	}
	select.addEventListener('change', () => onAction(select.value as PptxAfterAnimationAction));
	actionLabel.append(actionCaption, select);

	const colorLabel = createEl(doc, 'label', 'pptxv-after-animation-color');
	const colorCaption = createEl(doc, 'span');
	colorCaption.textContent = t('pptx.animation.afterAnimation.color');
	const colorInput = doc.createElement('input');
	colorInput.type = 'color';
	colorInput.setAttribute('aria-label', t('pptx.animation.afterAnimation.color'));
	colorInput.addEventListener('change', () => onColor(colorInput.value));
	colorLabel.append(colorCaption, colorInput);
	colorLabel.hidden = true;

	el.append(actionLabel, colorLabel);

	return {
		el,
		update(state) {
			select.value = state.action;
			select.disabled = !state.editable;
			const isDim = state.action === 'dimToColor';
			colorLabel.hidden = !isDim;
			colorInput.value = state.color ?? '#808080';
			colorInput.disabled = !state.editable;
		},
	};
}
