import type { ElementAction, ElementActionType } from 'pptx-viewer-core';
import {
	actionTypeNeedsTarget,
	canCommitActionType,
	ELEMENT_ACTION_TYPE_OPTIONS,
	toSlideIndex,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * The Action Settings section (React's `ActionSettingsPanel`): what the element
 * does when clicked or hovered in a slide show. The option catalogue and the
 * 1-based-to-0-based slide-number conversion come from
 * `pptx-viewer-shared/element-action-options`, so a new action kind reaches
 * every binding at once.
 */
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
	// The deck's slide count is not part of the per-element inspector state, so
	// the pane pushes it separately (it only bounds the "go to slide" spinner).
	let slideCount = 1;
	return {
		el,
		setSlideCount(count: number) {
			slideCount = Math.max(1, count);
		},
		update(state: InspectorState) {
			el.hidden = !state.hasSelection;
			click.update(state.actionClick, slideCount);
			hover.update(state.actionHover, slideCount);
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
	type.setAttribute(
		'aria-label',
		t(trigger === 'click' ? 'pptx.action.onClick' : 'pptx.action.onHover'),
	);
	for (const option of ELEMENT_ACTION_TYPE_OPTIONS) {
		const node = doc.createElement('option');
		node.value = option.value;
		node.textContent = t(option.labelKey);
		type.appendChild(node);
	}
	const target = doc.createElement('input');
	let slideCount = 1;
	/** What the two inputs currently say, in `ElementAction` terms. */
	const currentTarget = (actionType: ElementActionType) => ({
		url: actionType === 'url' ? target.value : undefined,
		slideIndex: actionType === 'slide' ? toSlideIndex(target.valueAsNumber, slideCount) : undefined,
	});
	const commit = (): void => {
		const actionType = type.value as ElementActionType;
		handlers.setElementAction(trigger, { trigger, type: actionType, ...currentTarget(actionType) });
	};
	const syncTarget = (): void => {
		target.hidden = !actionTypeNeedsTarget(type.value as ElementActionType);
		target.type = type.value === 'slide' ? 'number' : 'url';
		target.placeholder =
			type.value === 'slide' ? t('pptx.action.slideNumberPlaceholder') : 'https://';
		if (type.value === 'slide') {
			target.min = '1';
			target.max = String(Math.max(1, slideCount));
			target.step = '1';
		}
	};
	type.addEventListener('change', () => {
		syncTarget();
		// "Go to URL" / "Go to Slide" with an empty target serialises to an empty
		// OOXML action, which parses back as "none" and would immediately reset
		// this select and hide the field the user still has to fill in. So the
		// type alone is only committed once it carries a target (the shared rule
		// every binding's action panel applies).
		const actionType = type.value as ElementActionType;
		if (canCommitActionType(actionType, currentTarget(actionType))) {
			commit();
		}
	});
	target.addEventListener('change', commit);
	el.append(legend, type, target);
	return {
		el,
		update(action: ElementAction | undefined, slides: number) {
			slideCount = Math.max(1, slides);
			type.value = action?.type ?? 'none';
			target.value =
				action?.type === 'slide' ? String((action.slideIndex ?? 0) + 1) : (action?.url ?? '');
			syncTarget();
		},
	};
}
