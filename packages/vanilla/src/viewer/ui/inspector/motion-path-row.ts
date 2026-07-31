import {
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetIdForPath,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/** What the row reflects: the applied path and whether editing is allowed. */
export interface MotionPathRowState {
	motionPath: string | undefined;
	editable: boolean;
}

export interface MotionPathRow {
	el: HTMLElement;
	update(state: MotionPathRowState): void;
}

/**
 * The animation panel's motion-path row: pick a catalogue path, clear it, or
 * see that the applied path was hand-dragged.
 *
 * WHY the "Custom Path" option only exists while a hand-dragged path is
 * applied: a dragged path no longer matches any catalogue entry, and without
 * this the select would snap back to the preset the drag started from, which
 * misreports what will actually play. Re-picking it is a no-op (handled by the
 * action), so the marker can never overwrite the geometry it describes.
 */
export function createMotionPathRow(
	doc: Document,
	t: Translator,
	onChange: (presetId: string) => void,
): MotionPathRow {
	// Deliberately NOT `.pptxv-anim-field`: the panel's preset/timing fields are
	// addressed positionally within that class, and a fourth row appearing in the
	// middle of the list would silently retarget them. The stylesheet gives this
	// row the same look under its own class instead.
	const el = createEl(doc, 'label', 'pptxv-motion-path-row');
	const caption = createEl(doc, 'span');
	caption.textContent = t('pptx.animation.motionPath.label');

	const select = doc.createElement('select');
	const none = doc.createElement('option');
	none.value = 'none';
	none.textContent = t('pptx.animation.motionPath.none');
	select.appendChild(none);

	// Held out of the DOM until a custom path is applied, so the option list a
	// screen reader enumerates never offers a path that does not exist.
	const custom = doc.createElement('option');
	custom.value = 'custom';
	custom.textContent = t('pptx.animation.motionPath.custom');

	for (const family of MOTION_PATH_FAMILIES) {
		const group = doc.createElement('optgroup');
		group.label = t(motionPathFamilyLabelKey(family));
		for (const preset of motionPathPresetsByFamily(family)) {
			const option = doc.createElement('option');
			option.value = preset.id;
			option.textContent = t(motionPathPresetLabelKey(preset.id));
			group.appendChild(option);
		}
		select.appendChild(group);
	}
	select.addEventListener('change', () => onChange(select.value));

	const hint = createEl(doc, 'span', 'pptxv-motion-path-hint');
	hint.textContent = t('pptx.animation.motionPath.editHint');
	hint.hidden = true;

	el.append(caption, select, hint);

	return {
		el,
		update(state) {
			const presetId = motionPathPresetIdForPath(state.motionPath);
			const isCustom = Boolean(state.motionPath) && !presetId;
			if (isCustom) {
				if (custom.parentElement !== select) {
					select.insertBefore(custom, none.nextSibling);
				}
			} else {
				custom.remove();
			}
			select.value = isCustom ? 'custom' : (presetId ?? 'none');
			select.disabled = !state.editable;
			hint.hidden = !state.motionPath;
		},
	};
}
