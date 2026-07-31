import { mount } from '@vue/test-utils';
import {
	DEFAULT_MOTION_PATH_PRESET_ID,
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
	MOTION_PATH_PRESETS,
} from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { translationsEn } from '../../../i18n';
import AnimationsSection from './AnimationsSection.vue';

function mountAnimations(overrides: Record<string, unknown> = {}) {
	return mount(AnimationsSection, {
		props: {
			canEdit: true,
			selectedElement: { id: 'e1', type: 'text' },
			isInspectorPaneOpen: false,
			onToggleInspector: () => {},
			...overrides,
		},
	});
}

/**
 * AnimationsSection: the Animations ribbon tab.
 *
 * These assertions are by rendered LABEL rather than by index or class, because
 * the defect they guard is the tab silently offering fewer controls than the
 * React reference: every name below is one a user (or `ribbon-control-inventory`)
 * can look for and fail to find.
 */
describe('animationsSection', () => {
	it('offers every preset in the gallery without needing a hover menu', () => {
		const text = mountAnimations().text();
		for (const preset of ['Appear', 'Fade In', 'Fly In', 'Pulse', 'Spin', 'Fade Out']) {
			expect(text).toContain(preset);
		}
	});

	/**
	 * The tab used to hard-code six of the shared catalogue's twenty-seven
	 * presets, so twenty-one effects the editor can apply were unreachable from
	 * the ribbon. Asserted by count as well as by name so adding a preset to
	 * `pptx-viewer-shared` cannot quietly skip this binding.
	 */
	it('renders the whole shared catalogue, each name exactly once', () => {
		const wrapper = mountAnimations();
		const names = wrapper
			.findAll('button')
			.map((b) => b.text())
			.filter((name) =>
				[...ENTRANCE_PRESET_VALUES, ...EMPHASIS_PRESET_VALUES, ...EXIT_PRESET_VALUES].some(
					(preset) => name === translationsEn[`pptx.animation.preset.${preset}`],
				),
			);
		const catalogue =
			ENTRANCE_PRESET_VALUES.length + EMPHASIS_PRESET_VALUES.length + EXIT_PRESET_VALUES.length;

		expect(catalogue).toBe(27);
		expect(names).toHaveLength(catalogue);
		expect(new Set(names).size).toBe(catalogue);
	});

	/** A caption that answers to a click is a control the tab does not offer. */
	it('renders the category captions as inert text, not buttons', () => {
		const wrapper = mountAnimations();
		const buttonNames = wrapper.findAll('button').map((b) => b.text());
		for (const caption of ['Entrance', 'Emphasis', 'Exit']) {
			expect(buttonNames).not.toContain(caption);
			expect(wrapper.text()).toContain(caption);
		}
	});

	it('offers the advanced-animation commands', () => {
		const text = mountAnimations().text();
		for (const command of [
			'Exit Effects',
			'Path Animation',
			'Effect Options',
			'Trigger',
			'Painter',
		]) {
			expect(text).toContain(command);
		}
	});

	it('names the timing fields so they are reachable by name', () => {
		const wrapper = mountAnimations();
		expect(wrapper.find('label[for="pptx-animation-start"]').text()).toBe('Start');
		expect(wrapper.find('#pptx-animation-start').exists()).toBeTruthy();
		expect(wrapper.find('input[aria-label="Duration"]').exists()).toBeTruthy();
	});

	it('applies the clicked preset with its own effect group', async () => {
		const onAddAnimation = vi.fn();
		const wrapper = mountAnimations({ onAddAnimation });

		const flyIn = wrapper.findAll('button').find((b) => b.text() === 'Fly In');
		await flyIn?.trigger('click');
		expect(onAddAnimation).toHaveBeenCalledWith('flyIn', 'entrance');

		const fadeOut = wrapper.findAll('button').find((b) => b.text() === 'Fade Out');
		await fadeOut?.trigger('click');
		expect(onAddAnimation).toHaveBeenCalledWith('fadeOut', 'exit');
	});

	/**
	 * A motion path is geometry, not one of the three preset buckets, so it gets
	 * its own captioned group holding the whole shared catalogue.
	 */
	it('offers the motion-path gallery in its own captioned group', () => {
		const wrapper = mountAnimations();
		const gallery = wrapper.get(
			`[aria-label="${translationsEn['pptx.animations.motionPathGalleryAria']}"]`,
		);

		expect(gallery.findAll('button')).toHaveLength(MOTION_PATH_PRESETS.length);
		expect(wrapper.text()).toContain(translationsEn['pptx.animation.motionPath']);
	});

	it('applies a clicked motion path under the motionPath bucket', async () => {
		const onAddAnimation = vi.fn();
		const wrapper = mountAnimations({ onAddAnimation });
		const gallery = wrapper.get(
			`[aria-label="${translationsEn['pptx.animations.motionPathGalleryAria']}"]`,
		);

		await gallery.findAll('button')[0].trigger('click');
		expect(onAddAnimation).toHaveBeenCalledWith(MOTION_PATH_PRESETS[0].id, 'motionPath');
	});

	/** It used to apply a Fly In entrance, which is not a path at all. */
	it('makes "Path Animation" apply the default motion path, not an entrance', async () => {
		const onAddAnimation = vi.fn();
		const wrapper = mountAnimations({ onAddAnimation });

		const pathAnimation = wrapper.findAll('button').find((b) => b.text() === 'Path Animation');
		await pathAnimation?.trigger('click');

		expect(onAddAnimation).toHaveBeenCalledWith(DEFAULT_MOTION_PATH_PRESET_ID, 'motionPath');
		expect(onAddAnimation).not.toHaveBeenCalledWith('flyIn', 'entrance');
	});

	it('disables the authoring commands when nothing is selected', () => {
		const wrapper = mountAnimations({ selectedElement: null });
		const appear = wrapper.findAll('button').find((b) => b.text() === 'Appear');
		expect(appear?.attributes('disabled')).toBeDefined();

		const gallery = wrapper.get(
			`[aria-label="${translationsEn['pptx.animations.motionPathGalleryAria']}"]`,
		);
		expect(
			gallery.findAll('button').every((b) => b.attributes('disabled') !== undefined),
		).toBeTruthy();
	});
});
