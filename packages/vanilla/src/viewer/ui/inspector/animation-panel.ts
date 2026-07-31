import type {
	PptxAnimationPreset,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import {
	DIRECTIONAL_PRESETS,
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
	SEQUENCE_VALUES,
	TRIGGER_VALUES,
} from 'pptx-viewer-shared';

import { playAnimationPreview } from '../../animation';
import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import {
	animField,
	animNumber,
	animSelect,
	CURVES,
	DIRECTIONS,
	REPEAT_MODES,
} from './animation-panel-fields';
import { elementDisplayLabel, renderOrderRow, renderTimelineBar } from './animation-panel-parts';
import { createMotionPathRow } from './motion-path-row';
import type { InspectorHandlers } from './types';

/** Docked panel state, derived from the deck-level inspector state. */
export interface AnimationPanelState {
	editable: boolean;
	selectedElementId: string | undefined;
	elements: readonly PptxElement[];
	animations: readonly PptxElementAnimation[];
}

export interface AnimationPanel {
	el: HTMLElement;
	update(state: AnimationPanelState): void;
}

type PanelHandlers = Pick<
	InspectorHandlers,
	'setAnimationEffect' | 'applyMotionPath' | 'setAnimationTiming' | 'reorderAnimation'
>;

/**
 * The per-element Animation panel docked at the bottom of the inspector pane
 * whenever an element is selected (React's `AnimationPanel` +
 * `AnimationTimelineSection` in `InspectorPane`): entrance/emphasis/exit
 * preset selects, direction/sequence effect options, timing (trigger, trigger
 * shape, duration, delay, curve, repeat), a proportional timeline bar, and a
 * reorderable play-order list. All mutations flow through the shared
 * `animation-authoring` helpers via the history-integrated edit actions.
 */
export function createAnimationPanel(
	doc: Document,
	t: Translator,
	handlers: PanelHandlers,
): AnimationPanel {
	const el = createEl(doc, 'div', 'pptxv-inspector-animation');
	el.setAttribute('data-pptx-animation-panel', '');

	let current: AnimationPanelState = {
		editable: false,
		selectedElementId: undefined,
		elements: [],
		animations: [],
	};
	const selectedAnimation = (): PptxElementAnimation | undefined =>
		current.animations.find((entry) => entry.elementId === current.selectedElementId);

	// -- Header ---------------------------------------------------------------
	const header = createEl(doc, 'div', 'pptxv-anim-header');
	const title = createEl(doc, 'span', 'pptxv-inspector-section-title');
	title.textContent = t('pptx.animation.title');
	const previewBtn = createEl(doc, 'button', 'pptxv-anim-preview-btn');
	previewBtn.type = 'button';
	previewBtn.textContent = t('pptx.animation.preview');
	previewBtn.addEventListener('click', () => playAnimationPreview(doc, selectedAnimation()));
	header.append(title, previewBtn);
	el.appendChild(header);

	// -- Effect bucket selects ------------------------------------------------
	const presetSelect = (
		group: AnimationGroup,
		labelKey: string,
		presets: readonly PptxAnimationPreset[],
	): HTMLSelectElement =>
		animSelect(
			doc,
			t(labelKey),
			[
				{ value: 'none', label: t('pptx.animation.none') },
				...presets.map((preset) => ({
					value: preset,
					label: t(`pptx.animation.preset.${preset}`),
				})),
			],
			(value) => handlers.setAnimationEffect(group, value as PptxAnimationPreset | 'none'),
			el,
		);
	const entrance = presetSelect('entrance', 'pptx.animation.entrance', ENTRANCE_PRESET_VALUES);
	const emphasis = presetSelect('emphasis', 'pptx.animation.emphasis', EMPHASIS_PRESET_VALUES);
	const exit = presetSelect('exit', 'pptx.animation.exit', EXIT_PRESET_VALUES);

	// Motion path: geometry, not a preset, so it gets its own row.
	const motionPath = createMotionPathRow(doc, t, (presetId) => handlers.applyMotionPath(presetId));
	el.appendChild(motionPath.el);

	// -- Effect options + timing (visible only with an active animation) ------
	const options = createEl(doc, 'div', 'pptxv-anim-options');
	el.appendChild(options);

	const commit = (patch: Parameters<PanelHandlers['setAnimationTiming']>[1]): void => {
		if (current.selectedElementId) {
			handlers.setAnimationTiming(current.selectedElementId, patch);
		}
	};

	const directionWrap = animField(doc, t('pptx.animation.direction'), options);
	directionWrap.classList.add('pptxv-anim-direction');
	const directionButtons = DIRECTIONS.map((value) => {
		const btn = createEl(doc, 'button', 'pptxv-anim-direction-btn');
		btn.type = 'button';
		btn.textContent = t(`pptx.animation.direction.${value}`);
		btn.addEventListener('click', () => commit({ direction: value }));
		directionWrap.appendChild(btn);
		return { value, btn };
	});

	const sequence = animSelect(
		doc,
		t('pptx.animation.sequence'),
		SEQUENCE_VALUES.map((value) => ({ value, label: t(`pptx.animation.sequence.${value}`) })),
		(value) => commit({ sequence: value as PptxAnimationSequence }),
		options,
	);

	const timingTitle = createEl(doc, 'span', 'pptxv-inspector-section-title');
	timingTitle.textContent = t('pptx.animation.timing');
	options.appendChild(timingTitle);

	const trigger = animSelect(
		doc,
		t('pptx.animation.trigger'),
		TRIGGER_VALUES.map((value) => ({ value, label: t(`pptx.animation.trigger.${value}`) })),
		(value) => commit({ trigger: value as PptxAnimationTrigger, triggerShapeId: '' }),
		options,
	);
	const triggerShape = animSelect(
		doc,
		t('pptx.animation.trigger.shapeLabel'),
		[],
		(value) => commit({ triggerShapeId: value }),
		options,
	);
	const triggerShapeWrap = triggerShape.parentElement as HTMLElement;
	const duration = animNumber(
		doc,
		t('pptx.animation.duration'),
		{ min: 100, max: 10000, step: 50 },
		(value) => commit({ durationMs: value }),
		options,
	);
	const delay = animNumber(
		doc,
		t('pptx.animation.delay'),
		{ min: 0, max: 10000, step: 50 },
		(value) => commit({ delayMs: value }),
		options,
	);
	const curve = animSelect(
		doc,
		t('pptx.animation.timingCurve'),
		CURVES.map((entry) => ({ value: entry.value, label: t(entry.labelKey) })),
		(value) => commit({ timingCurve: value as PptxAnimationTimingCurve }),
		options,
	);
	const repeatCount = animNumber(
		doc,
		t('pptx.animation.repeatCount'),
		{ min: 1, max: 100, step: 1 },
		(value) => commit({ repeatCount: value }),
		options,
	);
	const repeatMode = animSelect(
		doc,
		t('pptx.animation.repeatUntil'),
		REPEAT_MODES.map((value) => ({ value, label: t(`pptx.animation.repeatUntil.${value}`) })),
		(value) => commit({ repeatMode: value as PptxAnimationRepeatMode | 'none' }),
		options,
	);

	// -- Timeline bar + play-order list ---------------------------------------
	const timeline = createEl(doc, 'div', 'pptxv-anim-timeline');
	const barTitle = createEl(doc, 'span', 'pptxv-inspector-section-title');
	barTitle.textContent = t('pptx.animation.timelineBar');
	const bar = createEl(doc, 'div', 'pptxv-anim-bar');
	const listTitle = createEl(doc, 'span', 'pptxv-inspector-section-title');
	listTitle.textContent = t('pptx.animation.timeline');
	const list = createEl(doc, 'div', 'pptxv-animation-timeline-list');
	timeline.append(barTitle, bar, listTitle, list);
	el.appendChild(timeline);

	return {
		el,
		update(state) {
			current = state;
			el.hidden = !state.selectedElementId;
			if (el.hidden) {
				return;
			}
			const animation = selectedAnimation();
			// A motion path is an effect in its own right: it must keep the timing
			// controls and the Preview button reachable even with no preset set.
			const hasEffect = Boolean(
				animation?.entrance || animation?.emphasis || animation?.exit || animation?.motionPath,
			);
			entrance.value = animation?.entrance ?? 'none';
			emphasis.value = animation?.emphasis ?? 'none';
			exit.value = animation?.exit ?? 'none';
			motionPath.update({ motionPath: animation?.motionPath, editable: state.editable });
			previewBtn.hidden = !hasEffect;
			options.hidden = !hasEffect;
			const directional =
				DIRECTIONAL_PRESETS.has(animation?.entrance ?? '') ||
				DIRECTIONAL_PRESETS.has(animation?.exit ?? '');
			directionWrap.hidden = !directional;
			for (const { value, btn } of directionButtons) {
				btn.classList.toggle('is-active', animation?.direction === value);
				btn.disabled = !state.editable;
			}
			sequence.value = animation?.sequence ?? 'asOne';
			trigger.value = animation?.trigger ?? 'onClick';
			triggerShapeWrap.hidden = trigger.value !== 'onShapeClick';
			triggerShape.replaceChildren(
				...[
					{ id: '', label: t('pptx.animation.trigger.selectShape') },
					...state.elements
						.filter((entry) => entry.id !== state.selectedElementId)
						.map((entry) => ({ id: entry.id, label: elementDisplayLabel(entry) })),
				].map((entry) => {
					const option = doc.createElement('option');
					option.value = entry.id;
					option.textContent = entry.label;
					return option;
				}),
			);
			triggerShape.value = animation?.triggerShapeId ?? '';
			duration.value = String(animation?.durationMs ?? 450);
			delay.value = String(animation?.delayMs ?? 0);
			curve.value = animation?.timingCurve ?? 'ease';
			repeatCount.value = String(animation?.repeatCount ?? 1);
			repeatMode.value = animation?.repeatMode ?? 'none';
			for (const control of [
				entrance,
				emphasis,
				exit,
				sequence,
				trigger,
				triggerShape,
				curve,
				repeatMode,
			] as const) {
				control.disabled = !state.editable;
			}
			duration.disabled = delay.disabled = repeatCount.disabled = !state.editable;

			const ordered = [...state.animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
			timeline.hidden = ordered.length === 0;
			renderTimelineBar(doc, t, bar, ordered, state.elements, state.selectedElementId);
			list.replaceChildren(
				...ordered.map((entry, index) =>
					renderOrderRow(
						doc,
						t,
						entry,
						index,
						ordered.length,
						state.elements,
						state.selectedElementId,
						state.editable,
						handlers.reorderAnimation,
					),
				),
			);
		},
	};
}
