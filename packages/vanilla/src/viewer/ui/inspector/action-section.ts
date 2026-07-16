import type { ElementAction, ElementActionType } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import type { InspectorHandlers, InspectorState } from './types';

const ACTION_TYPES: readonly ElementActionType[] = [
	'none',
	'url',
	'slide',
	'firstSlide',
	'lastSlide',
	'prevSlide',
	'nextSlide',
	'endShow',
];

export function createActionSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
) {
	const el = section(t('pptx.action.title'));
	const click = actionEditor(doc, t, 'click', handlers);
	const hover = actionEditor(doc, t, 'hover', handlers);
	el.append(click.el, hover.el);
	return {
		el,
		update(state: InspectorState) {
			el.hidden = !state.hasSelection;
			click.update(state.actionClick);
			hover.update(state.actionHover);
		},
	};
}

function actionEditor(
	doc: Document,
	t: Translator,
	trigger: 'click' | 'hover',
	handlers: InspectorHandlers,
) {
	const el = doc.createElement('fieldset');
	const legend = doc.createElement('legend');
	legend.textContent = t(trigger === 'click' ? 'pptx.action.onClick' : 'pptx.action.onHover');
	const type = doc.createElement('select');
	for (const value of ACTION_TYPES) {
		const option = doc.createElement('option');
		option.value = value;
		option.textContent = t(`pptx.hyperlink.action${labelSuffix(value)}`);
		type.appendChild(option);
	}
	const target = doc.createElement('input');
	const commit = (): void => {
		const actionType = type.value as ElementActionType;
		handlers.setElementAction(trigger, {
			trigger,
			type: actionType,
			url: actionType === 'url' ? target.value : undefined,
			slideIndex: actionType === 'slide' ? Math.max(0, target.valueAsNumber - 1) : undefined,
		});
	};
	const syncTarget = (): void => {
		target.hidden = type.value !== 'url' && type.value !== 'slide';
		target.type = type.value === 'slide' ? 'number' : 'url';
		target.placeholder =
			type.value === 'slide' ? t('pptx.action.slideNumberPlaceholder') : 'https://';
		if (type.value === 'slide') {
			target.min = '1';
			target.step = '1';
		}
	};
	type.addEventListener('change', () => {
		syncTarget();
		commit();
	});
	target.addEventListener('change', commit);
	el.append(legend, type, target);
	return {
		el,
		update(action: ElementAction | undefined) {
			type.value = action?.type ?? 'none';
			target.value =
				action?.type === 'slide' ? String((action.slideIndex ?? 0) + 1) : (action?.url ?? '');
			syncTarget();
		},
	};
}

function labelSuffix(type: ElementActionType): string {
	return type[0].toUpperCase() + type.slice(1);
}
