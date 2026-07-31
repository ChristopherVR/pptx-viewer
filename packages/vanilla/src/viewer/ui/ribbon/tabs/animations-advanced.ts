import type { PptxAnimationPreset } from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import { DEFAULT_MOTION_PATH_PRESET_ID } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { ButtonHandle } from '../../controls';
import { makeButton } from '../../controls';

export interface AdvancedAnimationHandlers {
	addAnimation(group: AnimationGroup, preset: PptxAnimationPreset): void;
	/** Apply a catalogue motion path by preset id (one-click Path Animation). */
	applyMotionPath(presetId: string): void;
	removeAnimation(): void;
	openAnimationPanel(): void;
}

export interface AdvancedAnimationGroup {
	el: HTMLElement;
	setDisabled(disabled: boolean): void;
}

/**
 * The Animations tab's Advanced Animation group: Exit Effects, Path Animation,
 * Effect Options, Animation Panel, Trigger, Animation Painter and Remove.
 *
 * Each shortcut applies the one preset React applies (the full entrance /
 * emphasis / exit catalogues live in the inspector's Animation panel in every
 * binding); Animation Painter is a placeholder nobody has implemented, so it
 * ships permanently disabled rather than pretending otherwise.
 */
export function createAdvancedAnimationGroup(
	doc: Document,
	t: Translator,
	handlers: AdvancedAnimationHandlers,
): AdvancedAnimationGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.animations.advanced');
	el.appendChild(label);

	const exitEffects = makeButton(doc, {
		label: t('pptx.animations.exitEffects'),
		icon: 'sparkles',
		textLabel: t('pptx.animations.exitEffects'),
		onClick: () => handlers.addAnimation('exit', 'fadeOut'),
	});
	const pathAnimation = makeButton(doc, {
		label: t('pptx.animations.pathAnimation'),
		icon: 'move-right',
		textLabel: t('pptx.animations.pathAnimation'),
		// One-click default path (Lines: Right). It used to apply a Fly In
		// entrance, which is not a path at all.
		onClick: () => handlers.applyMotionPath(DEFAULT_MOTION_PATH_PRESET_ID),
	});
	const effectOptions = makeButton(doc, {
		label: t('pptx.animations.effectOptions'),
		icon: 'wrench',
		textLabel: t('pptx.animations.effectOptions'),
		onClick: handlers.openAnimationPanel,
	});
	const animationPanel = makeButton(doc, {
		label: t('pptx.animations.animationPanel'),
		icon: 'panel-right',
		textLabel: t('pptx.animations.animationPanel'),
		onClick: handlers.openAnimationPanel,
	});
	animationPanel.btn.title = t('pptx.animations.openPanelTooltip');
	const trigger = makeButton(doc, {
		label: t('pptx.animations.trigger'),
		icon: 'cursor',
		textLabel: t('pptx.animations.trigger'),
		onClick: handlers.openAnimationPanel,
	});
	const painter = makeButton(doc, {
		label: t('pptx.animations.painter'),
		icon: 'copy',
		textLabel: t('pptx.animations.painter'),
		onClick: () => {},
	});
	const remove = makeButton(doc, {
		label: t('pptx.animations.remove'),
		icon: 'trash',
		textLabel: t('pptx.animations.remove'),
		onClick: handlers.removeAnimation,
	});
	remove.btn.title = t('pptx.animations.removeTooltip');

	row.append(
		exitEffects.btn,
		pathAnimation.btn,
		effectOptions.btn,
		animationPanel.btn,
		trigger.btn,
		painter.btn,
		remove.btn,
	);

	const selectionGated: ButtonHandle[] = [
		exitEffects,
		pathAnimation,
		effectOptions,
		trigger,
		remove,
	];

	return {
		el,
		setDisabled(disabled) {
			for (const button of selectionGated) {
				button.setDisabled(disabled);
			}
			painter.setDisabled(true);
		},
	};
}
