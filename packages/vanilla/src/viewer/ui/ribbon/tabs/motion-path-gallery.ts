import {
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { ButtonHandle } from '../../controls';
import { makeButton } from '../../controls';

export interface MotionPathGallery {
	el: HTMLElement;
	setDisabled(disabled: boolean): void;
}

/**
 * The Animations tab's motion-path gallery: PowerPoint's Lines / Arcs / Turns /
 * Shapes / Loops families, every path a real button.
 *
 * WHY it is a sibling of the entrance/emphasis/exit gallery rather than a
 * fourth column of it: a motion path is not one of those three buckets. It is
 * geometry that coexists with them on the SAME animation entry, so folding it
 * into the preset columns would imply a mutual exclusivity the model does not
 * have.
 *
 * Every preset is a real `<button>` carrying its translated label as both the
 * accessible name and its visible text, matching the React gallery character
 * for character: an e2e spec diffs the two bindings' accessible names, and a
 * gallery a screen-reader user cannot enumerate is a gallery they do not have.
 * The family captions stay plain spans so "Lines" is never announced as a
 * command that cannot be run.
 */
export function createMotionPathGallery(
	doc: Document,
	t: Translator,
	onApply: (presetId: string) => void,
): MotionPathGallery {
	const el = createEl(doc, 'div', 'pptxv-motion-path-gallery');
	el.setAttribute('aria-label', t('pptx.animations.motionPathGalleryAria'));

	const buttons: ButtonHandle[] = [];
	for (const family of MOTION_PATH_FAMILIES) {
		const column = createEl(doc, 'div', 'pptxv-motion-path-gallery-column');
		const caption = createEl(doc, 'span', 'pptxv-motion-path-gallery-caption');
		caption.textContent = t(motionPathFamilyLabelKey(family));
		const items = createEl(doc, 'div', 'pptxv-motion-path-gallery-items');
		for (const preset of motionPathPresetsByFamily(family)) {
			const label = t(motionPathPresetLabelKey(preset.id));
			const button = makeButton(doc, {
				label,
				text: label,
				className: 'pptxv-motion-path-preset',
				onClick: () => onApply(preset.id),
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
