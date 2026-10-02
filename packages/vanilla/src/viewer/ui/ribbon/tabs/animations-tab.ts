import type {
	PptxAnimationDirection,
	PptxAnimationPreset,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimelineAnchor,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import type { RibbonAnimationsRequestEvent, RibbonAnimationsViewState } from 'pptx-viewer-shared';
import {
	buildAnimationTimelineRows,
	directionValuesFor,
	effectiveDirection,
	effectiveTimingCurve,
	registerPptxWebControls,
} from 'pptx-viewer-shared';

import { playAnimationPreview } from '../../../animation';
import type { AnimationActions } from '../../../editor/editor-animation-actions';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { createInspectorSelect } from '../../inspector/controls-extra';
import {
	animationRow,
	nativeAnimationRow,
	optionSelect,
	timingField,
} from './animation-timeline-controls';

export interface AnimationsTabState {
	editable: boolean;
	/** Whether an element is currently selected on the slide (Add/Remove need a target). */
	hasSelection: boolean;
	selectedElementId?: string;
	animations: readonly PptxElementAnimation[];
	/** Whether the inspector is open (the Animation Pane command's pressed state). */
	paneOpen?: boolean;
	/** Read-only anchors for the deck's own effect groups; see {@link PptxAnimationTimelineAnchor}. */
	animationTimelineAnchors?: readonly PptxAnimationTimelineAnchor[];
}

export interface AnimationsTab {
	el: HTMLElement;
	update(state: AnimationsTabState): void;
}

/**
 * The Animations ribbon tab: Preview, a preset gallery that adds an effect to
 * the selected element, the Advanced Animation shortcuts, the Timing
 * placeholders, and this binding's own play-order timeline.
 *
 * Every applier routes through {@link AnimationActions}, which writes
 * `PptxSlide.animations` (keyed by `elementId`), the exact field the
 * presentation-mode click-stepped playback already reads (see
 * `buildClickGroups` in `animation/presentation-playback.ts`).
 */
export function createAnimationsTab(
	doc: Document,
	t: Translator,
	handlers: Pick<
		AnimationActions,
		| 'addAnimation'
		| 'applyMotionPath'
		| 'removeAnimation'
		| 'reorderAnimation'
		| 'setAnimationTiming'
		| 'moveAnimation'
	>,
	onOpenAnimationPanel: () => void,
): AnimationsTab {
	registerPptxWebControls();
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const shell = doc.createElement('pptx-ui-ribbon-animations');
	el.appendChild(shell);

	let selectedAnimation: PptxElementAnimation | undefined;
	let view: RibbonAnimationsViewState = {
		editable: false,
		hasSelection: false,
		translate: t,
	};
	const syncShell = (): void => {
		shell.state = view;
	};
	/**
	 * Preview the selected element's effect on the canvas through the SAME shared
	 * descriptor the inspector's Preview button plays, motion path included.
	 */
	shell.addEventListener('animations-request', (event) => {
		const intent = (event as RibbonAnimationsRequestEvent).detail;
		if (intent.kind === 'add') {
			if (intent.group === 'motionPath') {
				handlers.applyMotionPath(intent.preset);
			} else {
				handlers.addAnimation(intent.group, intent.preset as PptxAnimationPreset);
			}
		} else if (intent.value === 'preview') {
			playAnimationPreview(doc, selectedAnimation);
		} else if (intent.value === 'remove') {
			handlers.removeAnimation();
		} else {
			onOpenAnimationPanel();
		}
	});
	syncShell();

	const timeline = createEl(doc, 'div', 'pptxv-animation-timeline');
	const timelineLabel = createEl(doc, 'span', 'pptxv-rgroup-label');
	timelineLabel.textContent = t('pptx.animation.timeline');
	const list = createEl(doc, 'div', 'pptxv-animation-timeline-list');
	const timing = createEl(doc, 'div', 'pptxv-animation-timing-controls');

	const trigger = createInspectorSelect(doc);
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
	const triggerShape = timingField(doc, t('pptx.animations.triggerShape'), 0);
	triggerShape.input.type = 'text';
	triggerShape.input.min = '';
	triggerShape.input.max = '';
	timing.append(
		trigger,
		duration.label,
		delay.label,
		direction.label,
		sequence.label,
		easing.label,
		repeatCount.label,
		repeatMode.label,
		triggerShape.label,
	);
	timeline.append(timelineLabel, list, timing);
	el.appendChild(timeline);

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
			// Only a shape-click trigger owns this field: re-sending it for any other
			// trigger cleared the media element an "On bookmark" trigger points at.
			triggerShapeId: trigger.value === 'onShapeClick' ? triggerShape.input.value : undefined,
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
	triggerShape.input.addEventListener('change', commitTiming);

	return {
		el,
		update({
			editable,
			hasSelection,
			selectedElementId,
			animations,
			animationTimelineAnchors,
			paneOpen,
		}) {
			view = { ...view, editable, hasSelection, paneOpen };
			syncShell();
			const ordered = [...animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
			selectedAnimation = ordered.find(({ elementId }) => elementId === selectedElementId);
			// Merges the editor's own animations with the deck's read-only native
			// anchors into one full-sequence drag-and-drop timeline.
			const rows = buildAnimationTimelineRows(ordered, animationTimelineAnchors ?? []);
			const animationByElementId = new Map(
				ordered.map((animation) => [animation.elementId, animation]),
			);
			list.replaceChildren(
				...rows.flatMap((row, index) => {
					if (row.kind === 'native') {
						return [nativeAnimationRow(doc, t, row.targetIds, index, handlers)];
					}
					const animation = animationByElementId.get(row.elementId);
					return animation
						? [
								animationRow(
									doc,
									t,
									animation,
									index,
									rows.length,
									selectedElementId,
									editable,
									handlers,
								),
							]
						: [];
				}),
			);
			timeline.hidden = ordered.length === 0;
			timing.hidden = !selectedAnimation;
			trigger.value = selectedAnimation?.trigger ?? 'onClick';
			triggerShape.input.value = selectedAnimation?.triggerShapeId ?? '';
			triggerShape.label.hidden = trigger.value !== 'onShapeClick';
			duration.input.value = String(selectedAnimation?.durationMs ?? 500);
			delay.input.value = String(selectedAnimation?.delayMs ?? 0);
			// Only the directions PowerPoint has a variant for (shared catalogue).
			const directions = selectedAnimation
				? directionValuesFor([selectedAnimation], selectedAnimation.elementId)
				: [];
			direction.label.hidden = directions.length === 0;
			for (const option of direction.select.options) {
				option.hidden = !directions.includes(option.value as PptxAnimationDirection);
			}
			direction.select.value = effectiveDirection(selectedAnimation, directions) ?? 'fromBottom';
			sequence.select.value = selectedAnimation?.sequence ?? 'asOne';
			easing.select.value = effectiveTimingCurve(selectedAnimation?.timingCurve);
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
				triggerShape.input,
			]) {
				control.disabled = !editable;
			}
		},
	};
}
