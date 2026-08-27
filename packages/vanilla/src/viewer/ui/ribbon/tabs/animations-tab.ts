import type {
	PptxAnimationDirection,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimelineAnchor,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import { buildAnimationTimelineRows } from 'pptx-viewer-shared';

import { playAnimationPreview } from '../../../animation';
import type { AnimationActions } from '../../../editor/editor-animation-actions';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { createAnimationPresetGallery } from './animation-preset-gallery';
import {
	animationRow,
	nativeAnimationRow,
	optionSelect,
	timingField,
} from './animation-timeline-controls';
import { createAdvancedAnimationGroup } from './animations-advanced';
import { createTimingGroup } from './animations-timing';
import { createMotionPathGallery } from './motion-path-gallery';

export interface AnimationsTabState {
	editable: boolean;
	/** Whether an element is currently selected on the slide (Add/Remove need a target). */
	hasSelection: boolean;
	selectedElementId?: string;
	animations: readonly PptxElementAnimation[];
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
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	let selectedAnimation: PptxElementAnimation | undefined;

	/**
	 * Preview the selected element's effect on the canvas.
	 *
	 * This used to be a hand-rolled `element.animate()` fade, which showed the
	 * wrong thing for every effect and nothing at all for a motion path (the one
	 * effect whose whole point is the travel). It now plays the SAME shared
	 * descriptor the inspector's Preview button does, motion path included.
	 */
	const playPreview = (): void => {
		playAnimationPreview(doc, selectedAnimation);
	};

	const preview = makeButton(doc, {
		label: t('pptx.animations.preview'),
		icon: 'play',
		textLabel: t('pptx.animations.preview'),
		onClick: playPreview,
	});
	preview.btn.title = t('pptx.animations.previewTooltip');
	const previewGroup = createEl(doc, 'div', 'pptxv-rgroup');
	const previewRow = createEl(doc, 'div', 'pptxv-rgroup-row');
	previewRow.appendChild(preview.btn);
	const previewLabel = createEl(doc, 'span', 'pptxv-rgroup-label');
	previewLabel.textContent = t('pptx.animations.preview');
	previewGroup.append(previewRow, previewLabel);
	el.appendChild(previewGroup);

	const galleryGroup = createEl(doc, 'div', 'pptxv-rgroup');
	const galleryLabel = createEl(doc, 'span', 'pptxv-rgroup-label');
	galleryLabel.textContent = t('pptx.animations.animation');
	const gallery = createAnimationPresetGallery(doc, t, (group, preset) =>
		handlers.addAnimation(group, preset),
	);
	galleryGroup.append(gallery.el, galleryLabel);
	el.appendChild(galleryGroup);

	// Motion paths get their own group: a path coexists with an entrance /
	// emphasis / exit preset on the same entry rather than replacing one.
	const motionGroup = createEl(doc, 'div', 'pptxv-rgroup');
	const motionLabel = createEl(doc, 'span', 'pptxv-rgroup-label');
	motionLabel.textContent = t('pptx.animation.motionPath');
	const motionGallery = createMotionPathGallery(doc, t, (presetId) =>
		handlers.applyMotionPath(presetId),
	);
	motionGroup.append(motionGallery.el, motionLabel);
	el.appendChild(motionGroup);

	const advanced = createAdvancedAnimationGroup(doc, t, {
		addAnimation: handlers.addAnimation,
		applyMotionPath: handlers.applyMotionPath,
		removeAnimation: handlers.removeAnimation,
		openAnimationPanel: onOpenAnimationPanel,
	});
	el.appendChild(advanced.el);
	el.appendChild(createTimingGroup(doc, t).el);

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
			triggerShapeId: triggerShape.input.value,
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
		update({ editable, hasSelection, selectedElementId, animations, animationTimelineAnchors }) {
			const disabled = !editable || !hasSelection;
			gallery.setDisabled(disabled);
			motionGallery.setDisabled(disabled);
			preview.setDisabled(disabled);
			advanced.setDisabled(disabled);
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
				triggerShape.input,
			]) {
				control.disabled = !editable;
			}
		},
	};
}
