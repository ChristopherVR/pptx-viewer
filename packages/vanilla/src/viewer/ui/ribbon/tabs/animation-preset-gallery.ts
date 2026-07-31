import type { PptxAnimationPreset } from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import {
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { ButtonHandle } from '../../controls';
import { makeButton } from '../../controls';

/** One gallery column: a bucket's caption plus the presets that belong to it. */
interface PresetCategory {
	group: AnimationGroup;
	labelKey: string;
	presets: readonly PptxAnimationPreset[];
}

/**
 * The whole shared catalogue, not a sample of it.
 *
 * The ribbon used to hard-code six presets while `pptx-viewer-shared` already
 * published twenty-seven, so twenty-one effects this editor can actually apply
 * were reachable only from the inspector's Animation panel. Sourcing the
 * buttons from the shared arrays keeps every binding's gallery identical by
 * construction, and keeps a preset added to the catalogue from needing five
 * separate follow-ups.
 *
 * Order is the catalogue's own, which already leads each bucket with the
 * effects PowerPoint puts first (Appear / Fade In / Fly In, Spin / Pulse, Fade
 * Out), so the previously featured six still read as the primary set without
 * being rendered twice.
 */
const CATEGORIES: readonly PresetCategory[] = [
	{ group: 'entrance', labelKey: 'pptx.animation.entrance', presets: ENTRANCE_PRESET_VALUES },
	{ group: 'emphasis', labelKey: 'pptx.animation.emphasis', presets: EMPHASIS_PRESET_VALUES },
	{ group: 'exit', labelKey: 'pptx.animation.exit', presets: EXIT_PRESET_VALUES },
];

export interface AnimationPresetGallery {
	el: HTMLElement;
	setDisabled(disabled: boolean): void;
}

/**
 * The Animations tab's preset gallery.
 *
 * Every preset is a real button in the accessibility tree rather than an entry
 * behind a hover menu: a gallery a screen-reader user cannot enumerate is a
 * gallery they do not have. The bucket captions are plain spans, not disabled
 * buttons, so "Entrance" is never announced as a command that cannot be run.
 * The column scrolls (see `.pptxv-animation-gallery` in the stylesheet) rather
 * than growing, so the ribbon keeps the single-row height the layout-parity
 * spec guards.
 */
export function createAnimationPresetGallery(
	doc: Document,
	t: Translator,
	onAdd: (group: AnimationGroup, preset: PptxAnimationPreset) => void,
): AnimationPresetGallery {
	const el = createEl(doc, 'div', 'pptxv-animation-gallery');
	el.setAttribute('aria-label', t('pptx.animations.addAnimation'));

	const buttons: ButtonHandle[] = [];
	for (const category of CATEGORIES) {
		const column = createEl(doc, 'div', 'pptxv-animation-gallery-column');
		const caption = createEl(doc, 'span', 'pptxv-animation-gallery-caption');
		caption.textContent = t(category.labelKey);
		const items = createEl(doc, 'div', 'pptxv-animation-gallery-items');
		for (const preset of category.presets) {
			const label = t(`pptx.animation.preset.${preset}`);
			const button = makeButton(doc, {
				label,
				text: label,
				className: 'pptxv-animation-preset',
				onClick: () => onAdd(category.group, preset),
			});
			items.appendChild(button.btn);
			buttons.push(button);
		}
		column.append(caption, items);
		el.appendChild(column);
	}

	return {
		el,
		setDisabled(disabled) {
			for (const button of buttons) {
				button.setDisabled(disabled);
			}
		},
	};
}
