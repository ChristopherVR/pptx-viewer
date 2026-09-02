import type { ElementAction, ElementActionType } from 'pptx-viewer-core';
import { canCommitActionType, ELEMENT_ACTION_TYPE_OPTIONS, toSlideIndex } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * The Action Settings section (React's `ActionSettingsPanel`): what the element
 * does when clicked or hovered in a slide show. The option catalogue and the
 * 1-based-to-0-based slide-number conversion come from
 * `pptx-viewer-shared/element-action-options`, so a new action kind reaches
 * every binding at once.
 */
/** A named custom show, for the `customShow` action's picker. */
export interface ActionCustomShowOption {
	id: string;
	name: string;
}

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
	// Neither the deck's slide count nor its custom shows are part of the
	// per-element inspector state, so the pane pushes both separately (they
	// only bound the "go to slide" spinner / populate the custom-show picker).
	let slideCount = 1;
	let customShows: readonly ActionCustomShowOption[] = [];
	return {
		el,
		setSlideCount(count: number) {
			slideCount = Math.max(1, count);
		},
		setCustomShows(shows: readonly ActionCustomShowOption[]) {
			customShows = shows;
		},
		update(state: InspectorState) {
			el.hidden = !state.hasSelection;
			click.update(state.actionClick, slideCount, customShows);
			hover.update(state.actionHover, slideCount, customShows);
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
	// `openFile` / `openPresentation` reuse `ElementAction.url`, the same field
	// `url` writes to, and share this text input; they are not in
	// `actionTypeNeedsTarget` (an empty target does not round-trip them back to
	// "none"), so only their visibility rides on the action type, not the
	// commit-gating below.
	const textTargetTypes = new Set<ElementActionType>(['url', 'openFile', 'openPresentation']);

	const customShowSelect = doc.createElement('select');
	customShowSelect.dataset.testid = 'pptx-action-custom-show';
	customShowSelect.setAttribute('aria-label', t('pptx.hyperlink.customShowLabel'));
	const customShowEmpty = doc.createElement('option');
	customShowEmpty.value = '';
	customShowSelect.appendChild(customShowEmpty);

	const returnAfterRow = doc.createElement('label');
	returnAfterRow.className = 'pptxv-action-return-row';
	const returnAfter = doc.createElement('input');
	returnAfter.type = 'checkbox';
	returnAfter.dataset.testid = 'pptx-action-custom-show-return';
	returnAfterRow.append(returnAfter, doc.createTextNode(t('pptx.hyperlink.customShowReturn')));

	let slideCount = 1;
	let customShows: readonly ActionCustomShowOption[] = [];

	/** What the inputs currently say, in `ElementAction` terms. */
	const currentTarget = (actionType: ElementActionType) => ({
		url: textTargetTypes.has(actionType) ? target.value : undefined,
		slideIndex: actionType === 'slide' ? toSlideIndex(target.valueAsNumber, slideCount) : undefined,
		customShowId: actionType === 'customShow' ? customShowSelect.value || undefined : undefined,
		returnAfter: actionType === 'customShow' ? returnAfter.checked : undefined,
	});
	const commit = (): void => {
		const actionType = type.value as ElementActionType;
		handlers.setElementAction(trigger, { trigger, type: actionType, ...currentTarget(actionType) });
	};
	const rebuildCustomShowOptions = (): void => {
		const selected = customShowSelect.value;
		customShowSelect.replaceChildren(customShowEmpty);
		for (const show of customShows) {
			const node = doc.createElement('option');
			node.value = show.id;
			node.textContent = show.name;
			customShowSelect.appendChild(node);
		}
		customShowSelect.value = customShows.some((show) => show.id === selected) ? selected : '';
	};
	const syncTarget = (): void => {
		const actionType = type.value as ElementActionType;
		const isSlide = actionType === 'slide';
		const isCustomShow = actionType === 'customShow';
		target.hidden = !(textTargetTypes.has(actionType) || isSlide);
		target.type = isSlide ? 'number' : 'url';
		target.placeholder = isSlide ? t('pptx.action.slideNumberPlaceholder') : 'https://';
		if (isSlide) {
			target.min = '1';
			target.max = String(Math.max(1, slideCount));
			target.step = '1';
		}
		customShowSelect.hidden = !isCustomShow;
		returnAfterRow.hidden = !isCustomShow;
	};
	type.addEventListener('change', () => {
		syncTarget();
		// "Go to URL" / "Go to Slide" / "Custom Show" with an empty target
		// serialises to an empty OOXML action, which parses back as "none" and
		// would immediately reset this select and hide the field the user still
		// has to fill in. So the type alone is only committed once it carries a
		// target (the shared rule every binding's action panel applies).
		const actionType = type.value as ElementActionType;
		if (canCommitActionType(actionType, currentTarget(actionType))) {
			commit();
		}
	});
	target.addEventListener('change', commit);
	customShowSelect.addEventListener('change', commit);
	returnAfter.addEventListener('change', commit);
	el.append(legend, type, target, customShowSelect, returnAfterRow);
	return {
		el,
		update(
			action: ElementAction | undefined,
			slides: number,
			shows: readonly ActionCustomShowOption[],
		) {
			slideCount = Math.max(1, slides);
			customShows = shows;
			type.value = action?.type ?? 'none';
			target.value =
				action?.type === 'slide' ? String((action.slideIndex ?? 0) + 1) : (action?.url ?? '');
			rebuildCustomShowOptions();
			customShowSelect.value = action?.customShowId ?? '';
			returnAfter.checked = action?.returnAfter === true;
			syncTarget();
		},
	};
}
