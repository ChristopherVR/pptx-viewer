import {
	MOTION_PATH_FAMILIES,
	MOTION_PATH_PRESETS,
	motionPathFamilyLabelKey,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createMotionPathGallery } from './motion-path-gallery';

const t = createTranslator();

describe('createMotionPathGallery', () => {
	it('names the gallery and captions one column per PowerPoint family', () => {
		const gallery = createMotionPathGallery(document, t, vi.fn());
		expect(gallery.el.getAttribute('aria-label')).toBe(t('pptx.animations.motionPathGalleryAria'));
		const captions = [...gallery.el.querySelectorAll('.pptxv-motion-path-gallery-caption')].map(
			(node) => node.textContent,
		);
		expect(captions).toStrictEqual(
			MOTION_PATH_FAMILIES.map((family) => t(motionPathFamilyLabelKey(family))),
		);
		// A caption rendered as a permanently disabled button would read as a
		// command nobody can run; they must stay plain spans.
		for (const caption of captions) {
			expect(
				[...gallery.el.querySelectorAll('button')].some((button) => button.textContent === caption),
			).toBeFalsy();
		}
	});

	it('renders every catalogue preset once, named by its translated label', () => {
		const gallery = createMotionPathGallery(document, t, vi.fn());
		const buttons = [...gallery.el.querySelectorAll<HTMLButtonElement>('button')];
		expect(buttons).toHaveLength(MOTION_PATH_PRESETS.length);
		for (const preset of MOTION_PATH_PRESETS) {
			const label = t(motionPathPresetLabelKey(preset.id));
			const matches = buttons.filter((button) => button.getAttribute('aria-label') === label);
			expect(matches).toHaveLength(1);
			// React sets both `title` and the visible text to the same label; the
			// cross-binding accessible-name diff depends on all three agreeing.
			expect(matches[0].title).toBe(label);
			expect(matches[0].textContent).toBe(label);
		}
	});

	it('keeps the columns in catalogue order within each family', () => {
		const gallery = createMotionPathGallery(document, t, vi.fn());
		const columns = [...gallery.el.querySelectorAll('.pptxv-motion-path-gallery-column')];
		expect(columns).toHaveLength(MOTION_PATH_FAMILIES.length);
		MOTION_PATH_FAMILIES.forEach((family, index) => {
			const labels = [...columns[index].querySelectorAll('button')].map((node) => node.textContent);
			expect(labels).toStrictEqual(
				motionPathPresetsByFamily(family).map((preset) => t(motionPathPresetLabelKey(preset.id))),
			);
		});
	});

	it('applies the preset a clicked button names, and gates on selection', () => {
		const onApply = vi.fn();
		const gallery = createMotionPathGallery(document, t, onApply);
		const button = [...gallery.el.querySelectorAll<HTMLButtonElement>('button')].find(
			(node) => node.getAttribute('aria-label') === t('pptx.animation.motionPath.preset.spiral'),
		);
		button?.click();
		expect(onApply).toHaveBeenCalledWith('spiral');

		gallery.setDisabled(true);
		expect(
			[...gallery.el.querySelectorAll<HTMLButtonElement>('button')].every((node) => node.disabled),
		).toBeTruthy();
		gallery.setDisabled(false);
		expect(
			[...gallery.el.querySelectorAll<HTMLButtonElement>('button')].some((node) => node.disabled),
		).toBeFalsy();
	});
});
