import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { createRibbonPropsFixture } from '../ribbon/ribbon-props-fixture';
import ToolbarPrimaryRow from '../ribbon/ToolbarPrimaryRow.vue';

/**
 * The AI assistant Sparkles toggle in the ribbon's quick-action strip is gated
 * behind the host-set `aiEnabled` flag (which mirrors the viewer's optional
 * `ai` prop). It must be absent when the host has not opted in, present in
 * edit/master mode when opted in, and route clicks to `onToggleAiPanel`.
 */
function findAiButton(wrapper: ReturnType<typeof mount>) {
	return wrapper
		.findAll('button')
		.find((b) => b.attributes('aria-label') === 'Toggle AI assistant');
}

describe('ai toolbar toggle', () => {
	it('is hidden when the host has not enabled AI', () => {
		const wrapper = mount(ToolbarPrimaryRow, {
			props: createRibbonPropsFixture({ aiEnabled: false }),
		});
		expect(findAiButton(wrapper)).toBeUndefined();
	});

	it('renders in edit mode when AI is enabled', () => {
		const wrapper = mount(ToolbarPrimaryRow, {
			props: createRibbonPropsFixture({ aiEnabled: true, mode: 'edit' }),
		});
		expect(findAiButton(wrapper)).toBeTruthy();
	});

	it('is hidden in present mode even when AI is enabled', () => {
		const wrapper = mount(ToolbarPrimaryRow, {
			props: createRibbonPropsFixture({ aiEnabled: true, mode: 'present' }),
		});
		expect(findAiButton(wrapper)).toBeUndefined();
	});

	it('routes a click to onToggleAiPanel', async () => {
		const onToggleAiPanel = vi.fn();
		const wrapper = mount(ToolbarPrimaryRow, {
			props: createRibbonPropsFixture({ aiEnabled: true, onToggleAiPanel }),
		});
		await findAiButton(wrapper)?.trigger('click');
		expect(onToggleAiPanel).toHaveBeenCalledOnce();
	});

	it('reflects the open state with the active token colour', () => {
		const wrapper = mount(ToolbarPrimaryRow, {
			props: createRibbonPropsFixture({ aiEnabled: true, isAiPanelOpen: true }),
		});
		expect(findAiButton(wrapper)?.classes()).toContain('text-primary');
	});
});
