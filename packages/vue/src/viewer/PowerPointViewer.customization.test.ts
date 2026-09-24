import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import type { ViewerCustomization } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it } from 'vitest';

import PowerPointViewer from './PowerPointViewer.vue';
import type { PowerPointViewerExpose } from './types';

/**
 * The `customization` prop and the imperative helpers on the component handle,
 * wired through the whole viewer (the failure these guard against is a
 * template that never consults the resolved customisation, which a unit test
 * of the shared decision functions cannot see).
 */
function tabLabels(wrapper: VueWrapper): string[] {
	return wrapper.findAll('[role="tab"]').map((tab) => tab.text().trim());
}

async function mountViewer(customization?: ViewerCustomization): Promise<VueWrapper> {
	const wrapper = mount(PowerPointViewer, {
		props: { content: null, canEdit: true, customization },
	});
	await flushPromises();
	return wrapper;
}

let mounted: VueWrapper | undefined;
afterEach(() => {
	mounted?.unmount();
	mounted = undefined;
	localStorage.clear();
});

describe('powerPointViewer UI customization', () => {
	it('never renders a ribbon tab hidden through the customization prop', async () => {
		mounted = await mountViewer({ ribbon: { hiddenTabs: ['draw'] } });
		const labels = tabLabels(mounted);
		expect(labels).toContain('Insert');
		expect(labels).not.toContain('Draw');
	});

	it('hides and restores a ribbon tab live through the imperative handle', async () => {
		mounted = await mountViewer();
		const viewer = mounted.vm as unknown as PowerPointViewerExpose;
		expect(tabLabels(mounted)).toContain('Insert');

		viewer.hideRibbonTab('insert');
		await flushPromises();
		expect(tabLabels(mounted)).not.toContain('Insert');
		expect(viewer.getCustomization().ribbon?.hiddenTabs).toStrictEqual(['insert']);

		viewer.showRibbonTab('insert');
		await flushPromises();
		expect(tabLabels(mounted)).toContain('Insert');
	});

	it('a new customization prop replaces imperative edits', async () => {
		mounted = await mountViewer();
		const viewer = mounted.vm as unknown as PowerPointViewerExpose;
		viewer.hideRibbonTab('insert');
		await mounted.setProps({ customization: { ribbon: { hiddenTabs: ['design'] } } });
		await flushPromises();
		const labels = tabLabels(mounted);
		expect(labels).toContain('Insert');
		expect(labels).not.toContain('Design');
	});

	it('drops the AI toggle when the host disables the ai feature', async () => {
		const ai = { connection: { kind: 'endpoint' as const, api: '/ai' } };
		mounted = mount(PowerPointViewer, { props: { content: null, canEdit: true, ai } });
		await flushPromises();
		expect(mounted.find('button[aria-label="Toggle AI assistant"]').exists()).toBeTruthy();

		(mounted.vm as unknown as PowerPointViewerExpose).setFeatureEnabled('ai', false);
		await flushPromises();
		expect(mounted.find('button[aria-label="Toggle AI assistant"]').exists()).toBeFalsy();
	});

	it('removes the title bar and the settings gear when the host hides them', async () => {
		mounted = await mountViewer();
		expect(mounted.find('[data-pptx-title-bar]').exists()).toBeTruthy();
		expect(mounted.find('button[aria-label="Settings"]').exists()).toBeTruthy();

		const viewer = mounted.vm as unknown as PowerPointViewerExpose;
		viewer.setPanelVisible('titleBar', false);
		viewer.setDialogAvailable('options', false);
		await flushPromises();
		expect(mounted.find('[data-pptx-title-bar]').exists()).toBeFalsy();
		expect(mounted.find('button[aria-label="Settings"]').exists()).toBeFalsy();
	});
});
