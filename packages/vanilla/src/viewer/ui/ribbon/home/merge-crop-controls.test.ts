import { CROP_ASPECT_PRESETS } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createMergeCropControls } from './merge-crop-controls';

const t = createTranslator('en');

function handlers() {
	return {
		mergeShapes: vi.fn(),
		toggleCropMode: vi.fn(),
		cropToAspect: vi.fn(),
		cropFill: vi.fn(),
		cropFit: vi.fn(),
	};
}

const control = (root: HTMLElement, id: string): HTMLButtonElement | null =>
	root.querySelector<HTMLButtonElement>(`[data-pptx-ribbon-control="${id}"]`);

afterEach(() => {
	document.body.replaceChildren();
});

describe('createMergeCropControls', () => {
	it('enables Merge Shapes only for an editable mergeable selection', () => {
		const controls = createMergeCropControls(document, t, handlers());
		const merge = control(controls.el, 'merge-shapes')!;
		expect(merge.getAttribute('aria-label')).toBe('Merge Shapes');

		controls.update({ editable: true, canMergeShapes: false, canCrop: false, cropActive: false });
		expect(merge.disabled).toBeTruthy();
		expect(merge.title).toBe('Select two or more shapes to merge them');

		controls.update({ editable: false, canMergeShapes: true, canCrop: false, cropActive: false });
		expect(merge.disabled).toBeTruthy();

		controls.update({ editable: true, canMergeShapes: true, canCrop: false, cropActive: false });
		expect(merge.disabled).toBeFalsy();
		expect(merge.title).toBe('Merge Shapes');
	});

	it('lists the five operations as a menu and runs the chosen one', () => {
		const spies = handlers();
		const controls = createMergeCropControls(document, t, spies);
		document.body.appendChild(controls.el);
		controls.update({ editable: true, canMergeShapes: true, canCrop: false, cropActive: false });
		control(controls.el, 'merge-shapes')!.click();
		const menu = controls.el.querySelector('[role="menu"]')!;
		const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
		expect(items.map((item) => item.dataset.pptxMergeOp)).toStrictEqual([
			'union',
			'combine',
			'fragment',
			'intersect',
			'subtract',
		]);
		expect(items.map((item) => item.textContent)).toStrictEqual([
			'Union',
			'Combine',
			'Fragment',
			'Intersect',
			'Subtract',
		]);
		items[3].click();
		expect(spies.mergeShapes).toHaveBeenCalledWith('intersect');
	});

	it('offers a pressed Crop toggle and the aspect / Fill / Fit menu for a croppable picture', () => {
		const spies = handlers();
		const controls = createMergeCropControls(document, t, spies);
		document.body.appendChild(controls.el);
		const crop = control(controls.el, 'crop')!;
		const menu = control(controls.el, 'crop-menu')!;
		expect(crop.getAttribute('aria-label')).toBe('Crop');
		expect(menu.getAttribute('aria-label')).toBe('Crop to Aspect Ratio');

		controls.update({ editable: true, canMergeShapes: false, canCrop: false, cropActive: false });
		expect(crop.disabled).toBeTruthy();
		expect(menu.disabled).toBeTruthy();

		controls.update({ editable: true, canMergeShapes: false, canCrop: true, cropActive: true });
		expect(crop.disabled).toBeFalsy();
		expect(crop.getAttribute('aria-pressed')).toBe('true');
		crop.click();
		expect(spies.toggleCropMode).toHaveBeenCalledOnce();

		menu.click();
		const aspects = [...controls.el.querySelectorAll<HTMLElement>('[data-pptx-crop-aspect]')];
		expect(aspects.map((item) => item.textContent)).toStrictEqual(
			CROP_ASPECT_PRESETS.map((preset) => preset.id),
		);
		const headings = [...controls.el.querySelectorAll('.pptxv-dropdown-group')].map(
			(node) => node.textContent,
		);
		expect(headings).toStrictEqual(['Square', 'Portrait', 'Landscape']);
		controls.el.querySelector<HTMLElement>('[data-pptx-crop-aspect="16:9"]')!.click();
		expect(spies.cropToAspect).toHaveBeenCalledWith(16, 9);
		menu.click();
		controls.el.querySelector<HTMLElement>('[data-pptx-crop-action="fill"]')!.click();
		menu.click();
		controls.el.querySelector<HTMLElement>('[data-pptx-crop-action="fit"]')!.click();
		expect(spies.cropFill).toHaveBeenCalledOnce();
		expect(spies.cropFit).toHaveBeenCalledOnce();
	});

	it('never builds a control the host hides', () => {
		const controls = createMergeCropControls(document, t, handlers(), ['mergeShapes', 'crop']);
		expect(control(controls.el, 'merge-shapes')).toBeNull();
		expect(control(controls.el, 'crop')).toBeNull();
		expect(control(controls.el, 'crop-menu')).toBeNull();
	});
});
