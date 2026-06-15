import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { SlideVersion } from '../composables/useVersionHistory';
import type { CanvasSize } from '../types';
import VersionHistoryPanel from './VersionHistoryPanel.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function slide(id: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [] };
}

function version(id: string, label: string, timestamp: number): SlideVersion {
	const slides = [slide(`${id}-a`)];
	return { id, label, timestamp, slideCount: slides.length, slides };
}

function mountPanel(versions: SlideVersion[], open = true) {
	return mount(VersionHistoryPanel, {
		props: {
			open,
			versions,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
		},
		global: { stubs: { SlideStage: true } },
	});
}

describe('versionHistoryPanel', () => {
	it('renders nothing when closed', () => {
		const wrapper = mountPanel([version('v1', 'A', 1)], false);
		expect(wrapper.find('.pptx-vue-version-panel').exists()).toBeFalsy();
	});

	it('shows an empty message when there are no versions', () => {
		const wrapper = mountPanel([]);
		expect(wrapper.find('.pptx-vue-version-empty').exists()).toBeTruthy();
	});

	it('renders one item per version, newest first', () => {
		const wrapper = mountPanel([version('v1', 'First', 1), version('v2', 'Second', 2)]);
		const labels = wrapper.findAll('.pptx-vue-version-label').map((n) => n.text());
		expect(labels).toStrictEqual(['Second', 'First']);
	});

	it('emits restore / compare / delete with the version id', async () => {
		const wrapper = mountPanel([version('v1', 'A', 1)]);
		const buttons = wrapper.findAll('.pptx-vue-version-btn');
		await buttons[0]!.trigger('click');
		await buttons[1]!.trigger('click');
		await buttons[2]!.trigger('click');
		expect(wrapper.emitted('restore')).toStrictEqual([['v1']]);
		expect(wrapper.emitted('compare')).toStrictEqual([['v1']]);
		expect(wrapper.emitted('delete')).toStrictEqual([['v1']]);
	});

	it('emits close from the header button', async () => {
		const wrapper = mountPanel([version('v1', 'A', 1)]);
		await wrapper.find('.pptx-vue-version-close').trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('toggles a preview when the row is clicked', async () => {
		const wrapper = mountPanel([version('v1', 'A', 1)]);
		expect(wrapper.find('.pptx-vue-version-preview').exists()).toBeFalsy();
		await wrapper.find('.pptx-vue-version-row').trigger('click');
		expect(wrapper.find('.pptx-vue-version-preview').exists()).toBeTruthy();
	});
});
