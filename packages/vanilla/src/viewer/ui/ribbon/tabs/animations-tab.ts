import type { PptxAnimationPreset } from 'pptx-viewer-core';
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
	handlers: Pick<AnimationActions, 'addAnimation' | 'removeAnimation'>,
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

	return {
		el,
		update({ editable, hasSelection }) {
			const disabled = !editable || !hasSelection;
			for (const b of buttons) {
				b.setDisabled(disabled);
			}
		},
	};
}
