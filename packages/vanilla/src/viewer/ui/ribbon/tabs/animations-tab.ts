import type {
	PptxAnimationPreset,
	PptxAnimationDirection,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import {
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from 'pptx-viewer-shared';

import type { AnimationActions } from '../../../editor/editor-animation-actions';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';

/** One preset-gallery category: label key, group bucket, and its preset catalogue. */
const CATEGORIES: readonly {
	group: AnimationGroup;
	labelKey: string;
	presets: readonly PptxAnimationPreset[];
}[] = [
	{ group: 'entrance', labelKey: 'pptx.animation.entrance', presets: ENTRANCE_PRESET_VALUES },
	{ group: 'emphasis', labelKey: 'pptx.animation.emphasis', presets: EMPHASIS_PRESET_VALUES },
	{ group: 'exit', labelKey: 'pptx.animation.exit', presets: EXIT_PRESET_VALUES },
];

export interface AnimationsTabState {
	editable: boolean;
	/** Whether an element is currently selected on the slide (Add/Remove need a target). */
	hasSelection: boolean;
	selectedElementId?: string;
	animations: readonly PptxElementAnimation[];
}

export interface AnimationsTab {
	el: HTMLElement;
	update(state: AnimationsTabState): void;
}

/**
 * The Animations ribbon tab: Entrance/Emphasis/Exit preset galleries that add
 * one of the three effect buckets to the currently selected element, plus a
 * "Remove Animation" action. Both route through {@link AnimationActions},
 * which writes `PptxSlide.animations` (keyed by `elementId`), the exact field
 * the presentation-mode click-stepped playback already reads (see
 * `buildClickGroups` in `animation/presentation-playback.ts`).
 *
 * A minimal "current slide's animations in play order" list is not
 * implemented this wave (stretch goal); every button here is a write-only
 * applier, same as the Design/Transitions tabs.
 */
export function createAnimationsTab(
	doc: Document,
	t: Translator,
	handlers: Pick<
		AnimationActions,
		'addAnimation' | 'removeAnimation' | 'reorderAnimation' | 'setAnimationTiming'
	>,
): AnimationsTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	const buttons: Array<{ setDisabled(disabled: boolean): void }> = [];

	for (const category of CATEGORIES) {
		const section = createEl(doc, 'div', 'pptxv-rgroup');
		const label = createEl(doc, 'span', 'pptxv-rgroup-label');
		label.textContent = t(category.labelKey);
		section.appendChild(label);

		const gallery = createEl(doc, 'div', 'pptxv-animation-gallery');
		for (const preset of category.presets) {
			const btn = makeButton(doc, {
				label: t(`pptx.animation.preset.${preset}`),
				text: t(`pptx.animation.preset.${preset}`),
				onClick: () => handlers.addAnimation(category.group, preset),
			});
			gallery.appendChild(btn.btn);
			buttons.push(btn);
		}
		section.appendChild(gallery);
		el.appendChild(section);
	}

	const removeBtn = makeButton(doc, {
		label: t('pptx.animation.remove'),
		text: t('pptx.animation.remove'),
		onClick: () => handlers.removeAnimation(),
	});
	el.appendChild(removeBtn.btn);
	buttons.push(removeBtn);

	const timeline = createEl(doc, 'div', 'pptxv-animation-timeline');
	const timelineLabel = createEl(doc, 'span', 'pptxv-rgroup-label');
	timelineLabel.textContent = t('pptx.animation.timeline');
	const list = createEl(doc, 'div', 'pptxv-animation-timeline-list');
	const timing = createEl(doc, 'div', 'pptxv-animation-timing-controls');

	const trigger = doc.createElement('select');
	trigger.setAttribute('aria-label', t('pptx.animation.trigger'));
	const triggers: readonly PptxAnimationTrigger[] = [
		'onClick',
		'withPrevious',
		'afterPrevious',
		'onShapeClick',
		'onHover',
	];
	for (const value of triggers) {
		const option = doc.createElement('option');
		option.value = value;
		option.textContent = t(`pptx.animation.trigger.${value}`);
		trigger.appendChild(option);
	}
	const duration = timingField(doc, t('pptx.animation.duration'), 500);
	const delay = timingField(doc, t('pptx.animation.delay'), 0);
	const direction = optionSelect(doc, t, 'pptx.animation.direction', [
		'fromTop',
		'fromBottom',
		'fromLeft',
		'fromRight',
	]);
	const sequence = optionSelect(doc, t, 'pptx.animation.sequence', [
		'asOne',
		'byParagraph',
		'byWord',
		'byLetter',
	]);
	const easing = optionSelect(doc, t, 'pptx.animation.timingCurve', [
		'ease',
		'ease-in',
		'ease-out',
		'linear',
	]);
	const repeatMode = optionSelect(doc, t, 'pptx.animation.repeatUntil', [
		'none',
		'untilNextClick',
		'untilEndOfSlide',
	]);
	const repeatCount = timingField(doc, t('pptx.animation.repeatCount'), 1);
	timing.append(
		trigger,
		duration.label,
		delay.label,
		direction.label,
		sequence.label,
		easing.label,
		repeatCount.label,
		repeatMode.label,
	);
	timeline.append(timelineLabel, list, timing);
	el.appendChild(timeline);

	let selectedAnimation: PptxElementAnimation | undefined;
	const commitTiming = (): void => {
		if (!selectedAnimation) {
			return;
		}
		handlers.setAnimationTiming(selectedAnimation.elementId, {
			trigger: trigger.value as PptxAnimationTrigger,
			durationMs: duration.input.valueAsNumber,
			delayMs: delay.input.valueAsNumber,
			direction: direction.select.value as PptxAnimationDirection,
			sequence: sequence.select.value as PptxAnimationSequence,
			timingCurve: easing.select.value as PptxAnimationTimingCurve,
			repeatCount: repeatCount.input.valueAsNumber,
			repeatMode: repeatMode.select.value as PptxAnimationRepeatMode | 'none',
		});
	};
	for (const control of [
		trigger,
		direction.select,
		sequence.select,
		easing.select,
		repeatMode.select,
	]) {
		control.addEventListener('change', commitTiming);
	}
	duration.input.addEventListener('change', commitTiming);
	delay.input.addEventListener('change', commitTiming);
	repeatCount.input.addEventListener('change', commitTiming);

	return {
		el,
		update({ editable, hasSelection, selectedElementId, animations }) {
			const disabled = !editable || !hasSelection;
			for (const b of buttons) {
				b.setDisabled(disabled);
			}
			const ordered = [...animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
			selectedAnimation = ordered.find(({ elementId }) => elementId === selectedElementId);
			list.replaceChildren(
				...ordered.map((animation, index) =>
					animationRow(
						doc,
						t,
						animation,
						index,
						ordered.length,
						selectedElementId,
						editable,
						handlers,
					),
				),
			);
			timeline.hidden = ordered.length === 0;
			timing.hidden = !selectedAnimation;
			trigger.value = selectedAnimation?.trigger ?? 'onClick';
			duration.input.value = String(selectedAnimation?.durationMs ?? 500);
			delay.input.value = String(selectedAnimation?.delayMs ?? 0);
			direction.select.value = selectedAnimation?.direction ?? 'fromTop';
			sequence.select.value = selectedAnimation?.sequence ?? 'asOne';
			easing.select.value = selectedAnimation?.timingCurve ?? 'ease';
			repeatMode.select.value = selectedAnimation?.repeatMode ?? 'none';
			repeatCount.input.value = String(selectedAnimation?.repeatCount ?? 1);
			for (const control of [
				trigger,
				duration.input,
				delay.input,
				direction.select,
				sequence.select,
				easing.select,
				repeatMode.select,
				repeatCount.input,
			]) {
				control.disabled = !editable;
			}
		},
	};
}

function timingField(doc: Document, text: string, value: number) {
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

function optionSelect(doc: Document, t: Translator, labelText: string, values: readonly string[]) {
	const label = doc.createElement('label');
	label.textContent = t(labelText);
	const select = doc.createElement('select');
	for (const value of values) {
		const option = doc.createElement('option');
		option.value = value;
		option.textContent = t(`${labelText}.${value}`);
		select.appendChild(option);
	}
	label.appendChild(select);
	return { label, select };
}

function animationRow(
	doc: Document,
	t: Translator,
	animation: PptxElementAnimation,
	index: number,
	total: number,
	selectedElementId: string | undefined,
	editable: boolean,
	handlers: Pick<AnimationActions, 'reorderAnimation'>,
): HTMLElement {
	const row = createEl(doc, 'div', 'pptxv-animation-timeline-row');
	row.classList.toggle('is-selected', animation.elementId === selectedElementId);
	const label = createEl(doc, 'span', 'pptxv-animation-timeline-name');
	const effect = animation.entrance ?? animation.emphasis ?? animation.exit ?? 'custom';
	label.textContent = `${index + 1}. ${effect}`;
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
