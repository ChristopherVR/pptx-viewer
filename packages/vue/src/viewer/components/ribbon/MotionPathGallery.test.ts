import { mount } from '@vue/test-utils';
import { MOTION_PATH_FAMILIES, MOTION_PATH_PRESETS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { translationsEn } from '../../../i18n';
import MotionPathGallery from './MotionPathGallery.vue';

/**
 * MotionPathGallery: the Animations tab's motion-path gallery.
 *
 * Asserted by rendered LABEL and by catalogue count, because the defect these
 * guard is the binding silently offering fewer paths than the React reference:
 * an e2e spec diffs every binding's accessible names against React's, so a
 * caption that drifts here fails there.
 */
function mountGallery(overrides: Record<string, unknown> = {}) {
	return mount(MotionPathGallery, { props: { disabled: false, ...overrides } });
}

describe('motionPathGallery', () => {
	it('renders every catalogue path as a real button', () => {
		expect(mountGallery().findAll('button')).toHaveLength(MOTION_PATH_PRESETS.length);
	});

	it('groups the buttons under the five PowerPoint families', () => {
		const headings = mountGallery()
			.findAll('span.font-semibold')
			.map((span) => span.text());
		expect(headings).toStrictEqual(
			MOTION_PATH_FAMILIES.map(
				(family) => translationsEn[`pptx.animation.motionPath.family.${family}`],
			),
		);
		expect(headings).toStrictEqual(['Lines', 'Arcs', 'Turns', 'Shapes', 'Loops']);
	});

	it('names each path identically in its caption and its tooltip', () => {
		const buttons = mountGallery().findAll('button');
		for (const [index, preset] of MOTION_PATH_PRESETS.entries()) {
			const label = translationsEn[`pptx.animation.motionPath.preset.${preset.id}`];
			expect(buttons[index].text()).toBe(label);
			expect(buttons[index].attributes('title')).toBe(label);
		}
	});

	it('applies the clicked preset by id', async () => {
		const onApplyMotionPath = vi.fn();
		const wrapper = mountGallery({ onApplyMotionPath });

		await wrapper.findAll('button')[0].trigger('click');
		expect(onApplyMotionPath).toHaveBeenCalledWith(MOTION_PATH_PRESETS[0].id);

		const circle = wrapper
			.findAll('button')
			.find(
				(button) => button.text() === translationsEn['pptx.animation.motionPath.preset.circle'],
			);
		await circle?.trigger('click');
		expect(onApplyMotionPath).toHaveBeenCalledWith('circle');
	});

	it('disables every button when no element is selected', () => {
		const buttons = mountGallery({ disabled: true }).findAll('button');
		expect(buttons.every((button) => button.attributes('disabled') !== undefined)).toBeTruthy();
	});

	it('names the gallery for assistive technology', () => {
		expect(mountGallery().attributes('aria-label')).toBe(
			translationsEn['pptx.animations.motionPathGalleryAria'],
		);
	});

	/** A caption that answers to a click is a control the tab does not offer. */
	it('renders the family captions as inert text, not buttons', () => {
		const wrapper = mountGallery();
		const buttonNames = wrapper.findAll('button').map((button) => button.text());
		for (const caption of ['Lines', 'Arcs', 'Turns', 'Shapes', 'Loops']) {
			expect(buttonNames).not.toContain(caption);
			expect(wrapper.text()).toContain(caption);
		}
	});
});
