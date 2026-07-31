import {
	MOTION_PATH_FAMILIES,
	MOTION_PATH_PRESETS,
	motionPathFamilyLabelKey,
	motionPathPresetById,
} from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createMotionPathRow } from './motion-path-row';

const t = createTranslator();

function selectOf(el: HTMLElement): HTMLSelectElement {
	const select = el.querySelector('select');
	if (!select) {
		throw new Error('motion path row has no select');
	}
	return select;
}

describe('createMotionPathRow', () => {
	it('captions the row and groups the catalogue by family', () => {
		const row = createMotionPathRow(document, t, vi.fn());
		expect(row.el.querySelector('span')?.textContent).toBe(t('pptx.animation.motionPath.label'));
		const select = selectOf(row.el);
		expect([...select.querySelectorAll('optgroup')].map((group) => group.label)).toStrictEqual(
			MOTION_PATH_FAMILIES.map((family) => t(motionPathFamilyLabelKey(family))),
		);
		expect(select.options[0].value).toBe('none');
		expect(select.options[0].textContent).toBe(t('pptx.animation.motionPath.none'));
		expect(select.options).toHaveLength(MOTION_PATH_PRESETS.length + 1);
	});

	it('selects the applied preset and shows the drag hint only while a path is set', () => {
		const row = createMotionPathRow(document, t, vi.fn());
		const select = selectOf(row.el);
		const hint = row.el.querySelector<HTMLElement>('.pptxv-motion-path-hint');

		row.update({ motionPath: undefined, editable: true });
		expect(select.value).toBe('none');
		expect(hint?.hidden).toBeTruthy();

		row.update({ motionPath: motionPathPresetById('arcDown')?.path, editable: true });
		expect(select.value).toBe('arcDown');
		expect(hint?.hidden).toBeFalsy();
		expect(hint?.textContent).toBe(t('pptx.animation.motionPath.editHint'));
	});

	it('surfaces a hand-dragged path as Custom Path instead of snapping to a preset', () => {
		const row = createMotionPathRow(document, t, vi.fn());
		const select = selectOf(row.el);
		expect([...select.options].some((option) => option.value === 'custom')).toBeFalsy();

		row.update({ motionPath: 'M 0 0 L 0.42 0.17', editable: true });
		const custom = [...select.options].find((option) => option.value === 'custom');
		expect(custom?.textContent).toBe(t('pptx.animation.motionPath.custom'));
		expect(select.value).toBe('custom');

		// Back to a catalogue path: the marker must disappear again, or the list
		// would advertise a path the element no longer has.
		row.update({ motionPath: motionPathPresetById('lineUp')?.path, editable: true });
		expect(select.value).toBe('lineUp');
		expect([...select.options].some((option) => option.value === 'custom')).toBeFalsy();
	});

	it('reports the chosen preset id and disables itself when read-only', () => {
		const onChange = vi.fn();
		const row = createMotionPathRow(document, t, onChange);
		const select = selectOf(row.el);
		row.update({ motionPath: undefined, editable: true });
		expect(select.disabled).toBeFalsy();

		select.value = 'turnLeft';
		select.dispatchEvent(new Event('change'));
		expect(onChange).toHaveBeenCalledWith('turnLeft');

		select.value = 'none';
		select.dispatchEvent(new Event('change'));
		expect(onChange).toHaveBeenLastCalledWith('none');

		row.update({ motionPath: undefined, editable: false });
		expect(select.disabled).toBeTruthy();
	});
});
